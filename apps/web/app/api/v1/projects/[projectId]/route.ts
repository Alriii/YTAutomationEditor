import { db } from "@continuity/db";
import { updateProjectSchema } from "@continuity/shared";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user } = await requireOwnedProject(projectId);
    const project = await db.project.findFirst({
      where: { id: projectId, ownerId: user.id, deletedAt: null },
      include: {
        styleBibleVersions: { orderBy: { version: "desc" }, take: 1 },
        characters: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
        locations: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
        scripts: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
        _count: { select: { scenes: true, assets: true } },
      },
    });
    return Response.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user } = await requireOwnedProject(projectId);
    const input = updateProjectSchema.parse(await request.json());
    const project = await db.project.update({
      where: { id: projectId, ownerId: user.id },
      data: input,
    });
    return Response.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user } = await requireOwnedProject(projectId);
    await db.project.update({
      where: { id: projectId, ownerId: user.id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
