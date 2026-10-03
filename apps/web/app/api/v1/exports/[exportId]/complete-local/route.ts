import { z } from "zod";
import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

const schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("SUCCEEDED"),
    fileSizeBytes: z.number().int().positive(),
    durationMs: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("FAILED"),
    error: z.string().trim().min(1).max(4000),
  }),
]);

type Context = { params: Promise<{ exportId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { exportId } = await context.params;
    const input = schema.parse(await request.json());

    const record = await db.export.findFirst({
      where: {
        id: exportId,
        type: "VIDEO_MP4",
        project: { ownerId: user.id, deletedAt: null },
      },
      select: { id: true },
    });
    if (!record) throw new Error("NOT_FOUND");

    const updated = await db.export.update({
      where: { id: record.id },
      data:
        input.status === "SUCCEEDED"
          ? {
              status: "SUCCEEDED",
              completedAt: new Date(),
              manifest: {
                renderer: "local-docker-ffmpeg",
                fileSizeBytes: input.fileSizeBytes,
                durationMs: input.durationMs,
              },
            }
          : {
              status: "FAILED",
              completedAt: new Date(),
              manifest: {
                renderer: "local-docker-ffmpeg",
                error: input.error,
              },
            },
      select: { id: true, status: true },
    });

    return Response.json({ export: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
