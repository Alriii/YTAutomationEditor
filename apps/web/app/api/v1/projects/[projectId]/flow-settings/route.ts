import { z } from "zod";
import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

const schema = z.object({
  model: z.enum([
    "Nano Banana 2 Lite",
    "Nano Banana 2",
    "Nano Banana Pro",
  ]),
});

type Context = { params: Promise<{ projectId: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireOwnedProject(projectId);
    const input = schema.parse(await request.json());

    await db.project.update({
      where: { id: projectId },
      data: {
        defaultImageProvider: "flow.google.com",
        defaultImageModel: input.model,
      },
    });

    return Response.json({ model: input.model });
  } catch (error) {
    return errorResponse(error);
  }
}
