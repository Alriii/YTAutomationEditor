import { db } from "@continuity/db";
import { locationSchema } from "@continuity/shared";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const locations = await db.location.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    return Response.json({ locations });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const input = locationSchema.parse(await request.json());

    const location = await db.location.create({
      data: {
        projectId,
        name: input.name,
        locked: input.locked,
        versions: {
          create: {
            version: 1,
            description: input.description,
            era: input.era ?? null,
            architectureRules: input.architectureRules ?? null,
            technologyRules: input.technologyRules ?? null,
            lightingRules: input.lightingRules ?? null,
            environmentalRules: input.environmentalRules ?? null,
            prohibitedElements: input.prohibitedElements,
          },
        },
      },
      include: { versions: true },
    });

    return Response.json({ location }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
