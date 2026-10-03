import { getImageProvider } from "@continuity/ai";
import type { ContinuityPackage } from "@continuity/shared";
import { db } from "@continuity/db";
import { inngest } from "../client";
import { getProviderApiKey } from "@/lib/providers/credentials";
import { putR2Object, signR2Get } from "@/lib/storage/r2";

async function releaseFailedReservation(jobId: string, message: string) {
  await db.$transaction(async (tx) => {
    const job = await tx.generationJob.findUnique({ where: { id: jobId } });
    if (!job || ["SUCCEEDED", "FAILED", "CANCELLED"].includes(job.status)) return;

    await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorCode: "GENERATION_FAILED",
        errorMessage: message.slice(0, 4000),
        completedAt: new Date(),
      },
    });

    if (job.sceneId) {
      await tx.scene.update({
        where: { id: job.sceneId },
        data: { status: "FAILED" },
      });
    }

    if (job.estimatedCredits > 0) {
      await tx.user.update({
        where: { id: job.userId },
        data: { creditBalanceCached: { increment: job.estimatedCredits } },
      });
      await tx.usageLedger.create({
        data: {
          userId: job.userId,
          projectId: job.projectId,
          generationJobId: job.id,
          type: "RELEASE",
          credits: job.estimatedCredits,
          metadata: { reason: "generation_failed" },
        },
      });
    }
  });
}

export const imageGenerationFunction = inngest.createFunction(
  {
    id: "image-generation",
    retries: 2,
    triggers: [{ event: "continuity/image.generate.requested" }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event as { data?: { jobId?: string } } | undefined;
      const jobId = original?.data?.jobId;
      if (jobId) await releaseFailedReservation(jobId, error.message);
    },
  },
  async ({ event, step }) => {
    const jobId = String(event.data.jobId);

    const job = await step.run("load-generation-job", async () => {
      const found = await db.generationJob.findUnique({
        where: { id: jobId },
        include: {
          scene: { select: { sceneNumber: true } },
        },
      });
      if (!found || found.type !== "IMAGE_GENERATION" || !found.sceneId || !found.scene) {
        throw new Error("Image generation job not found.");
      }

      await db.generationJob.update({
        where: { id: found.id },
        data: {
          status: "RUNNING",
          startedAt: found.startedAt ?? new Date(),
          attemptCount: { increment: 1 },
          progress: 10,
          errorCode: null,
          errorMessage: null,
        },
      });
      await db.scene.update({
        where: { id: found.sceneId },
        data: { status: "GENERATING" },
      });

      return {
        id: found.id,
        userId: found.userId,
        projectId: found.projectId,
        sceneId: found.sceneId,
        sceneNumber: found.scene.sceneNumber,
        provider: found.provider,
        model: found.model,
        estimatedCredits: found.estimatedCredits,
        continuity: found.continuitySnapshot as unknown as ContinuityPackage,
        input: found.inputSnapshot as { aspectRatio?: "16:9" | "9:16" | "1:1" },
      };
    });

    const generated = await step.run("generate-image", async () => {
      const apiKey = await getProviderApiKey(job.userId, job.provider);
      const provider = getImageProvider(job.provider);
      const references = await Promise.all(
        job.continuity.references.map(async (reference) => ({
          assetId: reference.assetId,
          mimeType: "image/png",
          url: await signR2Get(reference.storageKey, 1200),
        })),
      );

      return provider.generate(
        {
          model: job.model,
          prompt: job.continuity.compiledPrompt,
          negativePrompt: job.continuity.negativePrompt,
          aspectRatio: job.input.aspectRatio ?? "16:9",
          references,
          idempotencyKey: job.continuity.fingerprint,
        },
        apiKey,
      );
    });

    const stored = await step.run("persist-image", async () => {
      const image = generated.images[0];
      if (!image) throw new Error("Provider returned no image.");

      const extension =
        image.mimeType === "image/png"
          ? "png"
          : image.mimeType === "image/webp"
            ? "webp"
            : "jpg";
      const storageKey =
        `users/${job.userId}/projects/${job.projectId}/scenes/` +
        `${String(job.sceneNumber).padStart(3, "0")}/${job.id}.${extension}`;

      await putR2Object({
        storageKey,
        bytes: image.bytes,
        contentType: image.mimeType,
      });

      const actualCredits = job.estimatedCredits;
      const providerCostUsd =
        generated.usage?.providerCostUsd ??
        undefined;

      return db.$transaction(async (tx) => {
        const asset = await tx.asset.create({
          data: {
            projectId: job.projectId,
            sceneId: job.sceneId,
            generationJobId: job.id,
            type: "IMAGE",
            role: "SCENE_RENDER",
            provider: job.provider,
            model: job.model,
            storageKey,
            mimeType: image.mimeType,
            width: image.width,
            height: image.height,
            sourcePrompt: job.continuity.compiledPrompt,
            providerAssetId: image.providerAssetId,
          },
        });

        await tx.scene.update({
          where: { id: job.sceneId },
          data: {
            status: "COMPLETE",
            selectedAssetId: asset.id,
          },
        });

        await tx.generationJob.update({
          where: { id: job.id },
          data: {
            status: "SUCCEEDED",
            progress: 100,
            completedAt: new Date(),
            actualCredits,
            actualUsd: providerCostUsd,
            providerJobId: generated.providerJobId,
          },
        });

        if (job.estimatedCredits > 0) {
          await tx.usageLedger.create({
            data: {
              userId: job.userId,
              projectId: job.projectId,
              generationJobId: job.id,
              type: "CAPTURE",
              credits: -actualCredits,
              providerCostUsd,
            },
          });
        }

        return { assetId: asset.id };
      });
    });

    await step.run("finish-project-if-complete", async () => {
      const remaining = await db.scene.count({
        where: {
          projectId: job.projectId,
          locked: false,
          status: { not: "COMPLETE" },
        },
      });
      if (remaining === 0) {
        await db.project.update({
          where: { id: job.projectId },
          data: { workflowState: "COMPLETE" },
        });
      }
    });

    return stored;
  },
);
