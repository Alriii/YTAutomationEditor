import { db } from "@continuity/db";
import { saveScriptSchema } from "@continuity/shared";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const script = await db.script.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    return Response.json({ script });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const input = saveScriptSchema.parse(await request.json());
    const wordCount = input.content.trim().split(/\s+/).filter(Boolean).length;

    const version = await db.$transaction(async (tx) => {
      let script = await tx.script.findFirst({
        where: { projectId },
        orderBy: { createdAt: "asc" },
      });

      if (!script) {
        script = await tx.script.create({
          data: { projectId, title: input.title },
        });
      } else if (script.title !== input.title) {
        script = await tx.script.update({
          where: { id: script.id },
          data: { title: input.title },
        });
      }

      const latest = await tx.scriptVersion.findFirst({
        where: { scriptId: script.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      return tx.scriptVersion.create({
        data: {
          scriptId: script.id,
          version: (latest?.version ?? 0) + 1,
          source: "MANUAL",
          status: input.locked ? "LOCKED" : "DRAFT",
          content: input.content,
          language: "en",
          wordCount,
          targetDurationSec: input.targetDurationSec ?? null,
          locked: input.locked,
        },
      });
    });

    return Response.json({ version }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
