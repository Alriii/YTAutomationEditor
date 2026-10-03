import { randomUUID } from "node:crypto";
import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { inngest } from "@/inngest/client";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user } = await requireOwnedProject(projectId);

    const scenes = await db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      select: { id: true, selectedAssetId: true },
    });
    if (!scenes.length) {
      return Response.json({ error: "No scenes to export." }, { status: 400 });
    }
    if (scenes.some((scene) => !scene.selectedAssetId)) {
      return Response.json(
        { error: "Every scene needs a selected render before export." },
        { status: 409 },
      );
    }

    const created = await db.$transaction(async (tx) => {
      const exportRecord = await tx.export.create({
        data: {
          projectId,
          type: "ASSET_ZIP",
          status: "PENDING",
        },
      });
      const job = await tx.generationJob.create({
        data: {
          userId: user.id,
          projectId,
          type: "EXPORT",
          provider: "internal",
          model: "asset-zip-v1",
          status: "QUEUED",
          idempotencyKey: `export:${projectId}:${randomUUID()}`,
          inputSnapshot: { exportId: exportRecord.id },
          estimatedCredits: 0,
        },
      });
      await tx.export.update({
        where: { id: exportRecord.id },
        data: { generationJobId: job.id },
      });
      return { exportRecord, job };
    });

    await inngest.send({
      name: "continuity/export.requested",
      data: { jobId: created.job.id },
    });

    return Response.json(
      {
        export: {
          id: created.exportRecord.id,
          status: "PENDING",
          jobId: created.job.id,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
