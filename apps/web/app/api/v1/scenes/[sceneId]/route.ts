import { db } from "@continuity/db";
import { updateSceneSchema } from "@continuity/shared";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ sceneId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { sceneId } = await context.params;
    const scene = await db.scene.findFirst({
      where: { id: sceneId, project: { ownerId: user.id, deletedAt: null } },
    });
    if (!scene) throw new Error("NOT_FOUND");

    const input = updateSceneSchema.parse(await request.json());
    const characterIds = input.characterIds;
    const locationId = input.locationId;

    const [characters, location] = await Promise.all([
      characterIds
        ? db.character.findMany({
            where: { projectId: scene.projectId, id: { in: characterIds } },
            include: { versions: { orderBy: { version: "desc" }, take: 1 } },
          })
        : Promise.resolve(undefined),
      locationId
        ? db.location.findFirst({
            where: { id: locationId, projectId: scene.projectId },
            include: { versions: { orderBy: { version: "desc" }, take: 1 } },
          })
        : Promise.resolve(locationId === null ? null : undefined),
    ]);

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.scene.update({
        where: { id: scene.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.narration !== undefined ? { narration: input.narration } : {}),
          ...(input.visualIntent !== undefined ? { visualIntent: input.visualIntent } : {}),
          ...(input.action !== undefined ? { action: input.action } : {}),
          ...(input.shotType !== undefined ? { shotType: input.shotType } : {}),
          ...(input.camera !== undefined ? { camera: input.camera } : {}),
          ...(input.lighting !== undefined ? { lighting: input.lighting } : {}),
          ...(input.durationHintMs !== undefined ? { durationHintMs: input.durationHintMs } : {}),
          ...(input.continuityNotes !== undefined ? { continuityNotes: input.continuityNotes } : {}),
          ...(location !== undefined
            ? location
              ? { locationId: location.id, locationVersionId: location.versions[0]?.id ?? null }
              : { locationId: null, locationVersionId: null }
            : {}),
          status: "REVIEW",
          approvedAt: null,
        },
      });

      if (characters) {
        await tx.sceneCharacter.deleteMany({ where: { sceneId: scene.id } });
        for (const character of characters) {
          const version = character.versions[0];
          if (!version) continue;
          await tx.sceneCharacter.create({
            data: {
              sceneId: scene.id,
              characterId: character.id,
              characterVersionId: version.id,
            },
          });
        }
      }

      await tx.project.update({
        where: { id: scene.projectId },
        data: { workflowState: "SCENE_REVIEW" },
      });

      return result;
    });

    return Response.json({ scene: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
