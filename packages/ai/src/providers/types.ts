export type ImageReference = {
  assetId: string;
  url: string;
  mimeType: string;
};

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type ImageGenerationRequest = {
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  references: ImageReference[];
  idempotencyKey: string;
};

export type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  providerAssetId?: string;
};

export type ProviderUsage = {
  providerCostUsd?: number;
  metadata?: Record<string, unknown>;
};

export type ImageGenerationResult = {
  providerJobId?: string;
  images: GeneratedImage[];
  usage?: ProviderUsage;
};

export type CostEstimate = {
  estimatedUsd: number;
  estimatedCredits: number;
};

export interface ImageProvider {
  readonly id: string;
  estimate(request: ImageGenerationRequest): CostEstimate;
  generate(request: ImageGenerationRequest, apiKey: string): Promise<ImageGenerationResult>;
}
