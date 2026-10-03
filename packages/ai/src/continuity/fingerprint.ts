export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createGenerationFingerprint(input: {
  compiledPrompt: string;
  negativePrompt: string;
  referenceHashes: string[];
  provider: string;
  model: string;
  aspectRatio: string;
}): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      prompt: input.compiledPrompt,
      negative: input.negativePrompt,
      references: [...input.referenceHashes].sort(),
      provider: input.provider,
      model: input.model,
      aspectRatio: input.aspectRatio,
    }),
  );
}
