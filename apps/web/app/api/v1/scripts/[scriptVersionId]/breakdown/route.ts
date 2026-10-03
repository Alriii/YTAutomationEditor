import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { inngest } from "@/inngest/client";

type Context = { params: Promise<{ scriptVersionId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { scriptVersionId } = await context.params;

    const scriptVersion = await db.scriptVersion.findFirst({
      where: {
        id: scriptVersionId,
        script: { project: { ownerId: user.id, deletedAt: null } },
      },
      include: { script: { include: { project: true } } },
    });

    if (!scriptVersion) throw new Error("NOT_FOUND");

    const project = scriptVersion.script.project;
    const provider = "google";
    const model = project.defaultTextModel ?? "gemini-3.1-flash-lite";
    const idempotencyKey =
      `script-breakdown:${scriptVersion.id}:${model}`;

    const existing = await db.generationJob.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return Response.json(
        { job: existing },
        { status: existing.status === "SUCCEEDED" ? 200 : 202 },
      );
    }

    const job = await db.generationJob.create({
      data: {
        userId: user.id,
        projectId: project.id,
        type: "SCRIPT_BREAKDOWN",
        provider,
        model,
        status: "QUEUED",
        idempotencyKey,
        inputSnapshot: { scriptVersionId: scriptVersion.id },
        estimatedCredits: 0,
        progress: 0,
      },
    });

    await inngest.send({
      name: "continuity/script.breakdown.requested",
      data: { jobId: job.id },
    });

    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
