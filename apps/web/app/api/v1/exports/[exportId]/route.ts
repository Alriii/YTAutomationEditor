import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { signR2Get } from "@/lib/storage/r2";

type Context = { params: Promise<{ exportId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { exportId } = await context.params;
    const record = await db.export.findFirst({
      where: {
        id: exportId,
        project: { ownerId: user.id, deletedAt: null },
      },
      select: {
        id: true,
        type: true,
        status: true,
        storageKey: true,
        createdAt: true,
        completedAt: true,
        generationJob: {
          select: { id: true, status: true, errorMessage: true, progress: true },
        },
      },
    });
    if (!record) throw new Error("NOT_FOUND");

    return Response.json({
      export: {
        ...record,
        downloadUrl:
          record.status === "SUCCEEDED" && record.storageKey
            ? await signR2Get(record.storageKey, 900)
            : null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
