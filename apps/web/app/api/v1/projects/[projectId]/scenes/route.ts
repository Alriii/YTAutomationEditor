import { db } from "@continuity/db";
import { sceneBreakdownItemSchema } from "@continuity/shared";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const scenes = await db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      include: {
        characters: { include: { character: true, characterVersion: true } },
        location: true,
        selectedAsset: true,
        _count: { select: { assets: true } },
      },
    });
    return Response.json({ scenes });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const input = sceneBreakdownItemSchema.parse(await request.json());

    const [characters, location] = await Promise.all([
      db.character.findMany({
        where: { projectId, id: { in: input.characterIds } },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      }),
      input.locationId
        ? db.location.findFirst({
            where: { id: input.locationId, projectId },
            include: { versions: { orderBy: { version: "desc" }, take: 1 } },
          })
        : null,
    ]);

    const scene = await db.scene.create({
      data: {
        projectId,
        sceneNumber: input.sceneNumber,
        title: input.title ?? null,
        narration: input.narration,
        visualIntent: input.visualIntent,
        action: input.action ?? null,
        shotType: input.shotType ?? null,
        camera: input.camera ?? null,
        lighting: input.lighting ?? null,
        durationHintMs: input.durationHintMs ?? null,
        continuityNotes: input.continuityNotes,
        status: "REVIEW",
        ...(location?.versions[0]
          ? {
              locationId: location.id,
              locationVersionId: location.versions[0].id,
            }
          : {}),
        characters: {
          create: characters
            .filter((character) => character.versions[0])
            .map((character) => ({
              characterId: character.id,
              characterVersionId: character.versions[0]!.id,
            })),
        },
      },
    });

    return Response.json({ scene }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
