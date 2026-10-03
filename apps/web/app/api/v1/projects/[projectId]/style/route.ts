import { db } from "@continuity/db";
import { styleBibleSchema } from "@continuity/shared";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const style = await db.styleBibleVersion.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    return Response.json({ style });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const input = styleBibleSchema.parse(await request.json());

    const style = await db.$transaction(async (tx) => {
      const latest = await tx.styleBibleVersion.findFirst({
        where: { projectId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      return tx.styleBibleVersion.create({
        data: {
          projectId,
          version: (latest?.version ?? 0) + 1,
          name: input.name,
          visualStyle: input.visualStyle,
          mediumRules: input.mediumRules ?? null,
          cameraRules: input.cameraRules ?? null,
          lightingRules: input.lightingRules ?? null,
          colorRules: input.colorRules ?? null,
          compositionRules: input.compositionRules ?? null,
          historicalRules: input.historicalRules ?? null,
          wardrobeRules: input.wardrobeRules ?? null,
          technologyRules: input.technologyRules ?? null,
          negativeConstraints: input.negativeConstraints,
          promptPrefix: input.promptPrefix ?? null,
          promptSuffix: input.promptSuffix ?? null,
          locked: input.locked,
        },
      });
    });

    return Response.json({ style }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
