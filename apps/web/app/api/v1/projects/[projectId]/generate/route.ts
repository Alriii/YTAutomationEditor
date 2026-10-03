import { z } from "zod";
import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { buildProjectGenerationEstimate } from "@/lib/generation/estimate";
import { inngest } from "@/inngest/client";

const schema = z.object({
  provider: z.enum(["openai", "fal"]),
  model: z.string().trim().min(1).max(200),
  estimateHash: z.string().regex(/^[a-f0-9]{64}$/i),
});

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user } = await requireOwnedProject(projectId);
    const input = schema.parse(await request.json());

    const estimate = await buildProjectGenerationEstimate({
      projectId,
      userId: user.id,
      provider: input.provider,
      model: input.model,
    });

    if (estimate.estimateHash !== input.estimateHash) {
      return Response.json(
        { error: "Continuity changed after cost approval. Recalculate the estimate before generating." },
        { status: 409 },
      );
    }

    if (!estimate.hasByok) {
      const freshUser = await db.user.findUnique({
        where: { id: user.id },
        select: { creditBalanceCached: true },
      });
      if (!freshUser || freshUser.creditBalanceCached < estimate.estimatedCredits) {
        return Response.json(
          {
            error: "Insufficient platform credits. Add a BYOK provider key or grant credits before generation.",
            requiredCredits: estimate.estimatedCredits,
            availableCredits: freshUser?.creditBalanceCached ?? 0,
          },
          { status: 402 },
        );
      }
    }

    const jobsToSend: string[] = [];

    await db.$transaction(async (tx) => {
      if (!estimate.hasByok && estimate.estimatedCredits > 0) {
        const updated = await tx.user.updateMany({
          where: {
            id: user.id,
            creditBalanceCached: { gte: estimate.estimatedCredits },
          },
          data: { creditBalanceCached: { decrement: estimate.estimatedCredits } },
        });
        if (updated.count !== 1) throw new Error("INSUFFICIENT_CREDITS");
      }

      let reservedCredits = 0;

      for (const item of estimate.compiled) {
        const scene = await tx.scene.findUnique({
          where: { id: item.sceneId },
          select: { id: true, locked: true, status: true },
        });
        if (!scene || scene.locked) continue;

        const idempotencyKey = `image:${item.sceneId}:${item.fingerprint}`;
        const existing = await tx.generationJob.findUnique({ where: { idempotencyKey } });
        if (existing) continue;

        const job = await tx.generationJob.create({
          data: {
            userId: user.id,
            projectId,
            sceneId: item.sceneId,
            type: "IMAGE_GENERATION",
            provider: input.provider,
            model: input.model,
            status: "QUEUED",
            idempotencyKey,
            inputSnapshot: {
              aspectRatio:
                estimate.project.aspectRatio === "VERTICAL_9_16"
                  ? "9:16"
                  : estimate.project.aspectRatio === "SQUARE_1_1"
                    ? "1:1"
                    : "16:9",
            },
            continuitySnapshot: item.continuity,
            estimatedCredits: item.estimatedCredits,
            estimatedUsd: item.estimatedUsd,
          },
        });
        jobsToSend.push(job.id);
        reservedCredits += item.estimatedCredits;

        await tx.scene.update({
          where: { id: item.sceneId },
          data: { status: "QUEUED" },
        });
      }

      if (!estimate.hasByok && reservedCredits > 0) {
        if (reservedCredits < estimate.estimatedCredits) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              creditBalanceCached: {
                increment: estimate.estimatedCredits - reservedCredits,
              },
            },
          });
        }

        await tx.usageLedger.create({
          data: {
            userId: user.id,
            projectId,
            type: "RESERVE",
            credits: -reservedCredits,
            metadata: {
              provider: input.provider,
              model: input.model,
              estimateHash: input.estimateHash,
            },
          },
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data: { workflowState: jobsToSend.length ? "GENERATING" : "READY_FOR_GENERATION" },
      });
    });

    if (jobsToSend.length) {
      await inngest.send(
        jobsToSend.map((jobId) => ({
          name: "continuity/image.generate.requested",
          data: { jobId },
        })),
      );
    }

    return Response.json(
      {
        queued: jobsToSend.length,
        jobIds: jobsToSend,
      },
      { status: jobsToSend.length ? 202 : 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return Response.json({ error: "Insufficient platform credits." }, { status: 402 });
    }
    return errorResponse(error);
  }
}
