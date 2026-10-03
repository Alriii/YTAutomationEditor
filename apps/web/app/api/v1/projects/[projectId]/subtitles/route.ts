import { z } from "zod";
import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

const cueSchema = z.object({
  order: z.number().int().positive(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().positive(),
  text: z.string().trim().min(1).max(1000),
});

const saveSchema = z.object({
  cues: z.array(cueSchema).max(5000),
});

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const cues = await db.subtitleCue.findMany({
      where: { projectId },
      orderBy: [{ startMs: "asc" }, { order: "asc" }],
    });
    return Response.json({ cues });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const input = saveSchema.parse(await request.json());

    for (const cue of input.cues) {
      if (cue.endMs <= cue.startMs) {
        return Response.json(
          { error: `Subtitle cue ${cue.order} ends before it starts.` },
          { status: 400 },
        );
      }
    }

    await db.$transaction(async (tx) => {
      await tx.subtitleCue.deleteMany({ where: { projectId } });
      if (input.cues.length) {
        await tx.subtitleCue.createMany({
          data: input.cues.map((cue, index) => ({
            projectId,
            order: index + 1,
            startMs: cue.startMs,
            endMs: cue.endMs,
            text: cue.text,
          })),
        });
      }

      await tx.projectTrack.upsert({
        where: {
          projectId_type: {
            projectId,
            type: "SUBTITLES",
          },
        },
        update: {
          settings: { source: "editable-cues", count: input.cues.length },
        },
        create: {
          projectId,
          type: "SUBTITLES",
          settings: { source: "editable-cues", count: input.cues.length },
        },
      });
    });

    return Response.json({ saved: input.cues.length });
  } catch (error) {
    return errorResponse(error);
  }
}
