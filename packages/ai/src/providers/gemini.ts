import { estimateImageCost } from "../pricing/catalog";
import type {
  GeneratedImage,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "./types";

type GeminiInteraction = {
  id?: string;
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      data?: string;
      mime_type?: string;
      text?: string;
    }>;
  }>;
};

function imageSizeForModel(model: string): "1K" {
  // Keep MVP output predictable and cost-aware. Resolution controls can be added later.
  return "1K";
}

async function referenceInput(reference: ImageGenerationRequest["references"][number]) {
  const response = await fetch(reference.url);
  if (!response.ok) {
    throw new Error(`Could not fetch reference asset ${reference.assetId}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    type: "image",
    mime_type: reference.mimeType,
    data: bytes.toString("base64"),
  };
}

export class GeminiImageProvider implements ImageProvider {
  readonly id = "google";

  estimate(request: ImageGenerationRequest) {
    return estimateImageCost(this.id, request);
  }

  async generate(
    request: ImageGenerationRequest,
    apiKey: string,
  ): Promise<ImageGenerationResult> {
    const prompt = request.negativePrompt
      ? `${request.prompt}\n\nSTRICT NEGATIVE CONSTRAINTS:\n${request.negativePrompt}`
      : request.prompt;

    const refs = await Promise.all(
      request.references.slice(0, 14).map(referenceInput),
    );

    const input =
      refs.length === 0
        ? prompt
        : [
            { type: "text", text: prompt },
            ...refs,
          ];

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          input,
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
            aspect_ratio: request.aspectRatio,
            image_size: imageSizeForModel(request.model),
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Gemini image request failed (${response.status}): ${await response.text()}`,
      );
    }

    const body = (await response.json()) as GeminiInteraction;
    const images: GeneratedImage[] = [];

    for (const step of body.steps ?? []) {
      if (step.type !== "model_output") continue;
      for (const part of step.content ?? []) {
        if (part.type !== "image" || !part.data) continue;
        images.push({
          bytes: Uint8Array.from(Buffer.from(part.data, "base64")),
          mimeType: part.mime_type ?? "image/jpeg",
        });
      }
    }

    if (!images.length) {
      throw new Error("Gemini returned no generated image.");
    }

    return {
      ...(body.id ? { providerJobId: body.id } : {}),
      images,
      usage: {
        providerCostUsd: this.estimate(request).estimatedUsd,
      },
    };
  }
}
