import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getProviderApiKey } from "@/lib/providers/credentials";

type Context = { params: Promise<{ provider: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireAppUser();
    const { provider } = await context.params;
    const apiKey = await getProviderApiKey(user.id, provider);

    let response: Response;
    if (provider === "openai") {
      response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } else if (provider === "fal") {
      response = await fetch("https://api.fal.ai/v1/models?limit=1", {
        headers: { Authorization: `Key ${apiKey}` },
      });
    } else {
      return Response.json({ error: "Unsupported provider." }, { status: 400 });
    }

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
