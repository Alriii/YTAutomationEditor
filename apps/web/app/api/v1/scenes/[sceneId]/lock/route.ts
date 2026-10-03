import { z } from "zod";
import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

const schema = z.object({ locked: z.boolean() });
type Context = { params: Promise<{ sceneId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { sceneId } = await context.params;
    const input = schema.parse(await request.json());

    const scene = await db.scene.findFirst({
      where: {
        id: sceneId,
        project: { ownerId: user.id, deletedAt: null },
      },
      select: { id: true, selectedAssetId: true },
    });
    if (!scene) throw new Error("NOT_FOUND");

    await db.$transaction(async (tx) => {
      await tx.scene.update({
        where: { id: scene.id },
        data: { locked: input.locked },
      });

      if (scene.selectedAssetId) {
        await tx.asset.update({
          where: { id: scene.selectedAssetId },
          data: { locked: input.locked },
        });
      }
    });

    return Response.json({ locked: input.locked });
  } catch (error) {
    return errorResponse(error);
  }
}
