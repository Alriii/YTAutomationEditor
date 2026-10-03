import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { buildProjectGenerationEstimate } from "@/lib/generation/estimate";
import { db } from "@continuity/db";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user, project } = await requireOwnedProject(projectId);
    const body = (await request.json().catch(() => ({}))) as {
      provider?: string;
      model?: string;
    };
    const provider = body.provider ?? project.defaultImageProvider ?? "openai";
    const model =
      body.model ??
      project.defaultImageModel ??
      (provider === "openai"
        ? "gpt-image-2.5-flare"
        : "fal-ai/flux-pro/kontext");

    const estimate = await buildProjectGenerationEstimate({
      projectId,
      userId: user.id,
      provider,
      model,
    });

    await db.project.update({
      where: { id: projectId },
      data: { workflowState: "READY_FOR_GENERATION" },
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
