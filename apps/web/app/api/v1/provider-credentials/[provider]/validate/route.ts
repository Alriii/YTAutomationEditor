import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getProviderApiKey } from "@/lib/providers/credentials";

type Context = { params: Promise<{ provider: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { provider } = await context.params;

    if (provider !== "google") {
      return Response.json({ error: "Unsupported provider." }, { status: 400 });
    }

    const apiKey = await getProviderApiKey(user.id, provider);
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      {
        headers: { "x-goog-api-key": apiKey },
      },
    );

    const valid = response.ok;
    await db.providerCredential.updateMany({
      where: { userId: user.id, provider },
      data: {
        status: valid ? "ACTIVE" : "INVALID",
        lastValidatedAt: new Date(),
      },
    });

    return Response.json({ valid, status: response.status });
  } catch (error) {
    return errorResponse(error);
  }
}
