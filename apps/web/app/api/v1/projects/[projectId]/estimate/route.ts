import { createGenerationFingerprint, getImageProvider } from "@continuity/ai";
import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { compileSceneFromDatabase } from "@/lib/continuity/load";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user, project } = await requireOwnedProject(projectId);
    const body = (await request.json().catch(() => ({}))) as { provider?: string; model?: string };
    const providerId = body.provider ?? project.defaultImageProvider ?? "openai";
    const model = body.model ?? project.defaultImageModel ?? (providerId === "openai" ? "gpt-image-2.5-flare" : "fal-ai/flux-pro/kontext");
    const provider = getImageProvider(providerId);

    const scenes = await db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
    });
    if (!scenes.length || scenes.some((scene) => scene.status !== "APPROVED")) {
      return Response.json({ error: "All scenes must be explicitly approved before cost estimation." }, { status: 409 });
    }

    const hasByok = Boolean(
      await db.providerCredential.findUnique({
        where: { userId_provider: { userId: user.id, provider: providerId } },
      }),
    );

    const compiled = [];
    let estimatedUsd = 0;
    let meteredCredits = 0;

    for (const scene of scenes) {
      const continuity = await compileSceneFromDatabase({
        projectId,
        sceneId: scene.id,
        provider: providerId,
        model,
      });
      const estimate = provider.estimate({
        model,
        prompt: continuity.compiledPrompt,
        negativePrompt: continuity.negativePrompt,
        aspectRatio:
          project.aspectRatio === "VERTICAL_9_16" ? "9:16" : project.aspectRatio === "SQUARE_1_1" ? "1:1" : "16:9",
        references: [],
        idempotencyKey: continuity.fingerprint,
      });
      estimatedUsd += estimate.estimatedUsd;
      meteredCredits += hasByok ? 0 : estimate.estimatedCredits;
      compiled.push({ sceneId: scene.id, fingerprint: continuity.fingerprint });
    }

    const estimateHash = await createGenerationFingerprint({
      compiledPrompt: JSON.stringify(compiled),
      negativePrompt: "",
      referenceHashes: [],
      provider: providerId,
      model,
      aspectRatio: project.aspectRatio,
    });

    await db.project.update({
      where: { id: projectId },
      data: { workflowState: "READY_FOR_GENERATION" },
    });

    return Response.json({
      estimate: {
        sceneCount: scenes.length,
        provider: providerId,
        model,
        estimatedUsd: Number(estimatedUsd.toFixed(4)),
        estimatedCredits: meteredCredits,
        byok: hasByok,
        estimateHash,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
