import { FalImageProvider } from "./fal";
import { OpenAIImageProvider } from "./openai";
import type { ImageProvider } from "./types";

const providers: Record<string, ImageProvider> = {
  openai: new OpenAIImageProvider(),
  fal: new FalImageProvider(),
};

export function getImageProvider(providerId: string): ImageProvider {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unsupported image provider: ${providerId}`);
  }
  return provider;
}

export function listImageProviders(): string[] {
  return Object.keys(providers);
}
