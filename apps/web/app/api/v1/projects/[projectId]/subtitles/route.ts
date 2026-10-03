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

const styleSchema = z.object({
  preset: z.enum(["DOCUMENTARY", "SHORTS", "MINIMAL", "CUSTOM"]),
  fontSize: z.number().int().min(12).max(72),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundOpacity: z.number().min(0).max(1),
  position: z.enum(["TOP", "CENTER", "BOTTOM"]),
  fontWeight: z.enum(["NORMAL", "SEMIBOLD", "BOLD"]),
  outline: z.boolean(),
  maxWidthPct: z.number().int().min(40).max(100),
});

const saveSchema = z.object({
  cues: z.array(cueSchema).max(5000),
  style: styleSchema,
});

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const [cues, track] = await Promise.all([
      db.subtitleCue.findMany({
        where: { projectId },
        orderBy: [{ startMs: "asc" }, { order: "asc" }],
      }),
      db.projectTrack.findUnique({
        where: {
          projectId_type: {
            projectId,
            type: "SUBTITLES",
          },
        },
        select: { settings: true },
      }),
    ]);

    return Response.json({ cues, settings: track?.settings ?? null });
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
          settings: {
            source: "editable-cues",
            count: input.cues.length,
            style: input.style,
          },
        },
        create: {
          projectId,
          type: "SUBTITLES",
          settings: {
            source: "editable-cues",
            count: input.cues.length,
            style: input.style,
          },
        },
      });
    });

    return Response.json({ saved: input.cues.length, style: input.style });
  } catch (error) {
    return errorResponse(error);
  }
}
