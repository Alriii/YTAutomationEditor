import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const scenes = await db.scene.findMany({ where: { projectId }, orderBy: { sceneNumber: "asc" } });
    if (!scenes.length) return Response.json({ error: "No scenes to approve." }, { status: 400 });
    if (scenes.some((scene) => !scene.narration.trim() || !scene.visualIntent.trim())) {
      return Response.json({ error: "Every scene needs narration and a visual intent before approval." }, { status: 400 });
    }

    await db.$transaction([
      db.scene.updateMany({
        where: { projectId },
        data: { status: "APPROVED", approvedAt: new Date() },
      }),
      db.project.update({
        where: { id: projectId },
        data: { workflowState: "READY_FOR_ESTIMATE" },
      }),
    ]);

    return Response.json({ approved: scenes.length });
  } catch (error) {
    return errorResponse(error);
  }
}
