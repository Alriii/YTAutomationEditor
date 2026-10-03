import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { buildProjectGenerationEstimate } from "@/lib/generation/estimate";
import { db } from "@continuity/db";

type Context = { params: Promise<{ projectId: string }> };

const ALLOWED_MODELS = new Set([
  "gemini-3.1-flash-lite-image",
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
]);

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user, project } = await requireOwnedProject(projectId);

    const body = (await request.json().catch(() => ({}))) as {
      model?: string;
    };

    const provider = "google";
    const model =
      body.model ??
      project.defaultImageModel ??
      "gemini-3.1-flash-image";

    if (!ALLOWED_MODELS.has(model)) {
      return Response.json({ error: "Unsupported Nano Banana model." }, { status: 400 });
    }

    const estimate = await buildProjectGenerationEstimate({
      projectId,
      userId: user.id,
      provider,
      model,
    });

    await db.project.update({
      where: { id: projectId },
      data: {
        workflowState: "READY_FOR_GENERATION",
        defaultImageProvider: provider,
        defaultImageModel: model,
      },
    });

    return Response.json({
      estimate: {
        sceneCount: estimate.compiled.length,
        provider,
        model,
        estimatedUsd: Number(estimate.estimatedUsd.toFixed(4)),
        estimatedCredits: estimate.estimatedCredits,
        byok: estimate.hasByok,
        estimateHash: estimate.estimateHash,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SCENES_NOT_APPROVED") {
      return Response.json(
        { error: "All scenes must be explicitly approved before cost estimation." },
        { status: 409 },
      );
    }
    return errorResponse(error);
  }
}
