import { db } from "@continuity/db";
import { createProjectSchema } from "@continuity/shared";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireAppUser();
    const projects = await db.project.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { scenes: true, assets: true } } },
    });
    return Response.json({ projects });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const input = createProjectSchema.parse(await request.json());
    const project = await db.project.create({
      data: {
        ownerId: user.id,
        title: input.title,
        description: input.description,
        aspectRatio: input.aspectRatio,
        language: input.language,
        targetDurationSec: input.targetDurationSec,
      },
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
