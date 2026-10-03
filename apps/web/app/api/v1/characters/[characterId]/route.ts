import { db } from "@continuity/db";
import { characterSchema } from "@continuity/shared";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ characterId: string }> };

async function ownedCharacter(characterId: string) {
  const user = await requireAppUser();
  const character = await db.character.findFirst({
    where: { id: characterId, project: { ownerId: user.id, deletedAt: null } },
  });
  if (!character) throw new Error("NOT_FOUND");
  return character;
}

export async function PUT(request: Request, context: Context) {
  try {
    const { characterId } = await context.params;
    await ownedCharacter(characterId);
    const input = characterSchema.parse(await request.json());

    const result = await db.$transaction(async (tx) => {
      const latest = await tx.characterVersion.findFirst({
        where: { characterId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.character.update({
        where: { id: characterId },
        data: { name: input.name, role: input.role, locked: input.locked },
      });
      return tx.characterVersion.create({
        data: {
          characterId,
          version: (latest?.version ?? 0) + 1,
          description: input.description,
          physicalTraits: input.physicalTraits,
          ageDescription: input.ageDescription,
          hairRules: input.hairRules,
          wardrobeRules: input.wardrobeRules,
          accessoryRules: input.accessoryRules,
          expressionRules: input.expressionRules,
          prohibitedChanges: input.prohibitedChanges,
        },
      });
    });

    return Response.json({ version: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
