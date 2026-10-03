import { z } from "zod";
import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { encryptSecret, secretHint } from "@/lib/security/credentials";

const credentialSchema = z.object({
  provider: z.enum(["openai", "fal"]),
  apiKey: z.string().trim().min(8).max(1000),
});

export async function GET() {
  try {
    const user = await requireAppUser();
    const credentials = await db.providerCredential.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        keyHint: true,
        status: true,
        lastValidatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { provider: "asc" },
    });
    return Response.json({ credentials });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const input = credentialSchema.parse(await request.json());
    const encryptedSecret = encryptSecret(input.apiKey);
    const keyHint = secretHint(input.apiKey);

    const credential = await db.providerCredential.upsert({
      where: { userId_provider: { userId: user.id, provider: input.provider } },
      update: { encryptedSecret, keyHint, status: "ACTIVE", lastValidatedAt: null },
      create: { userId: user.id, provider: input.provider, encryptedSecret, keyHint },
      select: { provider: true, keyHint: true, status: true },
    });

    return Response.json({ credential });
  } catch (error) {
    return errorResponse(error);
  }
}
