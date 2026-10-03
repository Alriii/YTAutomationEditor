import { z } from "zod";
import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { compileSceneFromDatabase } from "@/lib/continuity/load";
import { signR2Get } from "@/lib/storage/r2";

const schema = z.object({
  model: z.enum([
    "Nano Banana 2 Lite",
    "Nano Banana 2",
    "Nano Banana Pro",
  ]),
});

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { project } = await requireOwnedProject(projectId);
    const input = schema.parse(await request.json());

    const scenes = await db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      select: {
        id: true,
        sceneNumber: true,
        status: true,
        locked: true,
        selectedAssetId: true,
      },
    });

    if (!scenes.length) {
      return Response.json({ error: "No scenes found." }, { status: 400 });
    }

    if (scenes.some((scene) => !["APPROVED", "COMPLETE"].includes(scene.status))) {
      return Response.json(
        { error: "Review and approve every scene before Flow generation." },
        { status: 409 },
      );
    }

    const aspectRatio =
      project.aspectRatio === "VERTICAL_9_16"
        ? "9:16"
        : project.aspectRatio === "SQUARE_1_1"
          ? "1:1"
          : "16:9";

    const plan = [];

    for (const scene of scenes) {
      const continuity = await compileSceneFromDatabase({
        projectId,
        sceneId: scene.id,
        provider: "flow.google.com",
        model: input.model,
      });

      const referenceUrls = await Promise.all(
        continuity.references.slice(0, 8).map((reference) =>
          signR2Get(reference.storageKey, 1800),
        ),
      );

      plan.push({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        locked: scene.locked,
        hasSelectedAsset: Boolean(scene.selectedAssetId),
        fingerprint: continuity.fingerprint,
        prompt:
          continuity.compiledPrompt +
          (continuity.negativePrompt
            ? `\n\nSTRICT NEGATIVE CONSTRAINTS:\n${continuity.negativePrompt}`
            : ""),
        referenceUrls,
      });
    }

    return Response.json({
      model: input.model,
      aspectRatio,
      scenes: plan,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
