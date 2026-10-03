import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { jobId } = await context.params;
    const job = await db.generationJob.findFirst({
      where: { id: jobId, userId: user.id },
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (!job) throw new Error("NOT_FOUND");
    return Response.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
