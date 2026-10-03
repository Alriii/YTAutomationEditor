import { estimateImageCost } from "../pricing/catalog";
import type {
  GeneratedImage,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "./types";

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string; revised_prompt?: string }>;
};

function sizeForRatio(ratio: ImageGenerationRequest["aspectRatio"]): string {
  if (ratio === "9:16") return "1024x1536";
  if (ratio === "1:1") return "1024x1024";
  return "1536x1024";
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

async function parseImages(response: Response): Promise<GeneratedImage[]> {
  if (!response.ok) {
    throw new Error(`OpenAI image request failed (${response.status}): ${await response.text()}`);
  }
  const body = (await response.json()) as OpenAIImageResponse;
  const images = (body.data ?? [])
    .filter((item): item is { b64_json: string } => Boolean(item.b64_json))
    .map((item) => ({ bytes: decodeBase64(item.b64_json), mimeType: "image/png" }));

  if (!images.length) throw new Error("OpenAI returned no image data.");
  return images;
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id = "openai";

  estimate(request: ImageGenerationRequest) {
    return estimateImageCost(this.id, request);
  }

  async generate(request: ImageGenerationRequest, apiKey: string): Promise<ImageGenerationResult> {
    const prompt = request.negativePrompt
      ? `${request.prompt}\n\nNEGATIVE CONSTRAINTS:\n${request.negativePrompt}`
      : request.prompt;

    let response: Response;
    if (request.references.length === 0) {
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          prompt,
          size: sizeForRatio(request.aspectRatio),
          quality: "medium",
          output_format: "png",
          n: 1,
        }),
      });
    } else {
      const form = new FormData();
      form.set("model", request.model);
      form.set("prompt", prompt);
      form.set("size", sizeForRatio(request.aspectRatio));
      form.set("quality", "medium");
      form.set("output_format", "png");
      form.set("n", "1");

      for (const [index, reference] of request.references.entries()) {
        const fetched = await fetch(reference.url);
        if (!fetched.ok) throw new Error(`Could not fetch reference asset ${reference.assetId}.`);
        const blob = await fetched.blob();
        form.append("image[]", blob, `reference-${index}.png`);
      }

      response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    }

    return {
      images: await parseImages(response),
      usage: { providerCostUsd: this.estimate(request).estimatedUsd },
    };
  }
}
