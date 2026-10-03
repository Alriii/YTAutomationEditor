import { createGenerationFingerprint, getImageProvider } from "@continuity/ai";
import { db } from "@continuity/db";
import { compileSceneFromDatabase } from "@/lib/continuity/load";

export async function buildProjectGenerationEstimate(input: {
  projectId: string;
  userId: string;
  provider: string;
  model: string;
}) {
  const project = await db.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) throw new Error("Project not found.");

  const scenes = await db.scene.findMany({
    where: { projectId: input.projectId },
    orderBy: { sceneNumber: "asc" },
  });
  if (!scenes.length || scenes.some((scene) => scene.status !== "APPROVED")) {
    throw new Error("SCENES_NOT_APPROVED");
  }

  const provider = getImageProvider(input.provider);
  const hasByok = Boolean(
    await db.providerCredential.findUnique({
      where: {
        userId_provider: {
          userId: input.userId,
          provider: input.provider,
        },
      },
    }),
  );

  const compiled: Array<{
    sceneId: string;
    sceneNumber: number;
    fingerprint: string;
    continuity: Awaited<ReturnType<typeof compileSceneFromDatabase>>;
    estimatedCredits: number;
    estimatedUsd: number;
  }> = [];

  let estimatedUsd = 0;
  let estimatedCredits = 0;

  for (const scene of scenes) {
    const continuity = await compileSceneFromDatabase({
      projectId: input.projectId,
      sceneId: scene.id,
      provider: input.provider,
      model: input.model,
    });
    const cost = provider.estimate({
      model: input.model,
      prompt: continuity.compiledPrompt,
      negativePrompt: continuity.negativePrompt,
      aspectRatio:
        project.aspectRatio === "VERTICAL_9_16"
          ? "9:16"
          : project.aspectRatio === "SQUARE_1_1"
            ? "1:1"
            : "16:9",
      references: [],
      idempotencyKey: continuity.fingerprint,
    });

    estimatedUsd += cost.estimatedUsd;
    const credits = hasByok ? 0 : cost.estimatedCredits;
    estimatedCredits += credits;
    compiled.push({
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      fingerprint: continuity.fingerprint,
      continuity,
      estimatedCredits: credits,
      estimatedUsd: cost.estimatedUsd,
    });
  }

  const estimateHash = await createGenerationFingerprint({
    compiledPrompt: JSON.stringify(
      compiled.map(({ sceneId, fingerprint }) => ({ sceneId, fingerprint })),
    ),
    negativePrompt: "",
    referenceHashes: [],
    provider: input.provider,
    model: input.model,
    aspectRatio: project.aspectRatio,
  });

  return {
    project,
    hasByok,
    compiled,
    estimateHash,
    estimatedUsd,
    estimatedCredits,
  };
}
