import type { CostEstimate, ImageGenerationRequest } from "../providers/types";

const CREDIT_USD = 0.01;

type PricingRule = {
  provider: string;
  model: string;
  usdPerImage: number;
};

const RULES: PricingRule[] = [
  { provider: "openai", model: "gpt-image-1.5", usdPerImage: 0.04 },
  { provider: "openai", model: "gpt-image-1", usdPerImage: 0.04 },
  { provider: "fal", model: "fal-ai/flux-pro/kontext", usdPerImage: 0.05 },
];

export function estimateImageCost(
  provider: string,
  request: ImageGenerationRequest,
): CostEstimate {
  const exact = RULES.find(
    (rule) => rule.provider === provider && rule.model === request.model,
  );
  const fallbackUsd = provider === "fal" ? 0.06 : 0.05;
  const estimatedUsd = exact?.usdPerImage ?? fallbackUsd;

  return {
    estimatedUsd,
    estimatedCredits: Math.ceil(estimatedUsd / CREDIT_USD),
  };
}
