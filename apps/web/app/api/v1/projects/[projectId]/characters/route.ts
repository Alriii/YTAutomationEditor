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

    const character = await db.$transaction(async (tx) => {
      return tx.character.create({
        data: {
          projectId,
          name: input.name,
          role: input.role,
          locked: input.locked,
          versions: {
            create: {
              version: 1,
              description: input.description,
              physicalTraits: input.physicalTraits,
              ageDescription: input.ageDescription,
              hairRules: input.hairRules,
              wardrobeRules: input.wardrobeRules,
              accessoryRules: input.accessoryRules,
              expressionRules: input.expressionRules,
              prohibitedChanges: input.prohibitedChanges,
            },
          },
        },
        include: { versions: true },
      });
    });

    return Response.json({ character }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
