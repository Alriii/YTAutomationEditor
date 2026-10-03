import { z } from "zod";
import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

const schema = z.object({ assetId: z.string().uuid() });
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
      select: { id: true, projectId: true },
    });
    if (!scene) throw new Error("NOT_FOUND");

    const asset = await db.asset.findFirst({
      where: {
        id: input.assetId,
        sceneId: scene.id,
        projectId: scene.projectId,
        role: "SCENE_RENDER",
      },
      select: { id: true },
    });
    if (!asset) throw new Error("NOT_FOUND");

    await db.scene.update({
      where: { id: scene.id },
      data: { selectedAssetId: asset.id },
    });

    return Response.json({ selectedAssetId: asset.id });
  } catch (error) {
    return errorResponse(error);
  }
}
