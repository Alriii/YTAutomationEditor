import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { inngest } from "@/inngest/client";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { jobId } = await context.params;
    const job = await db.generationJob.findFirst({
      where: { id: jobId, userId: user.id },
    });
    if (!job) throw new Error("NOT_FOUND");
    if (job.type !== "IMAGE_GENERATION" || job.status !== "FAILED") {
      return Response.json({ error: "Only failed image jobs can be retried." }, { status: 409 });
    }

    await db.$transaction(async (tx) => {
      if (job.estimatedCredits > 0) {
        const reserved = await tx.user.updateMany({
          where: {
            id: user.id,
            creditBalanceCached: { gte: job.estimatedCredits },
          },
          data: { creditBalanceCached: { decrement: job.estimatedCredits } },
        });
        if (reserved.count !== 1) throw new Error("INSUFFICIENT_CREDITS");
        await tx.usageLedger.create({
          data: {
            userId: user.id,
            projectId: job.projectId,
            generationJobId: job.id,
            type: "RESERVE",
            credits: -job.estimatedCredits,
            metadata: { reason: "retry" },
          },
        });
      }

      await tx.generationJob.update({
        where: { id: job.id },
        data: {
          status: "QUEUED",
          progress: 0,
          errorCode: null,
          errorMessage: null,
          completedAt: null,
        },
      });
      if (job.sceneId) {
        await tx.scene.update({
          where: { id: job.sceneId },
          data: { status: "QUEUED" },
        });
      }
    });

    await inngest.send({
      name: "continuity/image.generate.requested",
      data: { jobId: job.id },
    });

    return Response.json({ queued: true }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return Response.json({ error: "Insufficient platform credits." }, { status: 402 });
    }
    return errorResponse(error);
  }
}
