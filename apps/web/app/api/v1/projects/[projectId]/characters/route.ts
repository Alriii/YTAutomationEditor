import { db } from "@continuity/db";
import { characterSchema } from "@continuity/shared";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const characters = await db.character.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    return Response.json({ characters });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const input = characterSchema.parse(await request.json());

    const character = await db.character.create({
      data: {
        projectId,
        name: input.name,
        role: input.role ?? null,
        locked: input.locked,
        versions: {
          create: {
            version: 1,
            description: input.description,
            physicalTraits: input.physicalTraits ?? null,
            ageDescription: input.ageDescription ?? null,
            hairRules: input.hairRules ?? null,
            wardrobeRules: input.wardrobeRules ?? null,
            accessoryRules: input.accessoryRules ?? null,
            expressionRules: input.expressionRules ?? null,
            prohibitedChanges: input.prohibitedChanges,
          },
        },
      },
      include: { versions: true },
    });

    return Response.json({ character }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
