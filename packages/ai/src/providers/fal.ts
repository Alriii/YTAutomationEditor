import { estimateImageCost } from "../pricing/catalog";
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "./types";

type FalQueueResponse = {
  request_id?: string;
  response_url?: string;
};

type FalResult = {
  images?: Array<{ url?: string; content_type?: string; width?: number; height?: number }>;
};

export class FalImageProvider implements ImageProvider {
  readonly id = "fal";

  estimate(request: ImageGenerationRequest) {
    return estimateImageCost(this.id, request);
  }

  async generate(
    request: ImageGenerationRequest,
    apiKey: string,
  ): Promise<ImageGenerationResult> {
    const endpoint = `https://queue.fal.run/${request.model}`;
    const submit = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: request.prompt,
        negative_prompt: request.negativePrompt,
        aspect_ratio: request.aspectRatio,
        num_images: 1,
        image_urls: request.references.map((reference) => reference.url),
      }),
    });

    if (!submit.ok) {
      throw new Error(`fal.ai submit failed (${submit.status}): ${await submit.text()}`);
    }

    const queued = (await submit.json()) as FalQueueResponse;
    if (!queued.response_url) {
      throw new Error("fal.ai did not return a response_url.");
    }

    let resultResponse: Response | undefined;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const polled = await fetch(queued.response_url, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      if (polled.status === 202) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      resultResponse = polled;
      break;
    }

    if (!resultResponse) {
      throw new Error("fal.ai generation timed out.");
    }
    if (!resultResponse.ok) {
      throw new Error(
        `fal.ai result failed (${resultResponse.status}): ${await resultResponse.text()}`,
      );
    }

    const result = (await resultResponse.json()) as FalResult;
    const images = await Promise.all(
      (result.images ?? []).map(async (image) => {
        if (!image.url) throw new Error("fal.ai returned an image without a URL.");
        const fetched = await fetch(image.url);
        if (!fetched.ok) throw new Error("Unable to download generated fal.ai image.");
        return {
          bytes: new Uint8Array(await fetched.arrayBuffer()),
          mimeType: image.content_type ?? "image/jpeg",
          ...(image.width ? { width: image.width } : {}),
          ...(image.height ? { height: image.height } : {}),
        };
      }),
    );

    if (!images.length) {
      throw new Error("fal.ai returned no generated images.");
    }

    return {
      ...(queued.request_id ? { providerJobId: queued.request_id } : {}),
      images,
      usage: { providerCostUsd: this.estimate(request).estimatedUsd },
    };
  }
}
