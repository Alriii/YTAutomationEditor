import { db } from "@continuity/db";
import { locationSchema } from "@continuity/shared";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ locationId: string }> };

async function ownedLocation(locationId: string) {
  const user = await requireAppUser();
  const location = await db.location.findFirst({
    where: { id: locationId, project: { ownerId: user.id, deletedAt: null } },
  });
  if (!location) throw new Error("NOT_FOUND");
  return location;
}

export async function PUT(request: Request, context: Context) {
  try {
    const { locationId } = await context.params;
    await ownedLocation(locationId);
    const input = locationSchema.parse(await request.json());

    const version = await db.$transaction(async (tx) => {
      const latest = await tx.locationVersion.findFirst({
        where: { locationId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.location.update({
        where: { id: locationId },
        data: { name: input.name, locked: input.locked },
      });
      return tx.locationVersion.create({
        data: {
          locationId,
          version: (latest?.version ?? 0) + 1,
          description: input.description,
          era: input.era,
          architectureRules: input.architectureRules,
          technologyRules: input.technologyRules,
          lightingRules: input.lightingRules,
          environmentalRules: input.environmentalRules,
          prohibitedElements: input.prohibitedElements,
        },
      });
    });

    return Response.json({ version }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
