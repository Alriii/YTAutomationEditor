import { z } from "zod";
import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

const schema = z.object({
  fit: z.enum(["cover", "contain"]),
  scale: z.number().min(0.5).max(3),
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
});

type Context = { params: Promise<{ sceneId: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { sceneId } = await context.params;
    const input = schema.parse(await request.json());

    const scene = await db.scene.findFirst({
      where: {
        id: sceneId,
        project: {
          ownerId: user.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!scene) throw new Error("NOT_FOUND");

    await db.scene.update({
      where: { id: scene.id },
      data: {
        mediaSettings: input,
      },
    });

    return Response.json({ settings: input });
  } catch (error) {
    return errorResponse(error);
  }
}
