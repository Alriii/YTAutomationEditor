import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ provider: string }> };

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { provider } = await context.params;
    await db.providerCredential.deleteMany({ where: { userId: user.id, provider } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
