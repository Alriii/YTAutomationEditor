import { db } from "@continuity/db";
import { decryptSecret } from "@/lib/security/credentials";

export async function getProviderApiKey(userId: string, provider: string): Promise<string> {
  const credential = await db.providerCredential.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (credential?.status === "ACTIVE") return decryptSecret(credential.encryptedSecret);

  const platformKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : provider === "fal"
        ? process.env.FAL_KEY
        : undefined;
  if (!platformKey) throw new Error(`No API key configured for provider: ${provider}`);
  return platformKey;
}
