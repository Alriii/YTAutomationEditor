import type { CostEstimate, ImageGenerationRequest } from "../providers/types";

const CREDIT_USD = 0.01;

type PricingRule = {
  provider: string;
  model: string;
  estimatedUsdPerImage: number;
};

const RULES: PricingRule[] = [
  { provider: "openai", model: "gpt-image-2.5-flare", estimatedUsdPerImage: 0.06 },
  { provider: "openai", model: "gpt-image-2.5-sunburst", estimatedUsdPerImage: 0.09 },
  { provider: "fal", model: "fal-ai/flux-pro/kontext", estimatedUsdPerImage: 0.05 },
];

export function estimateImageCost(
  provider: string,
  request: ImageGenerationRequest,
): CostEstimate {
  const exact = RULES.find(
    (rule) => rule.provider === provider && rule.model === request.model,
  );
  const estimatedUsd = exact?.estimatedUsdPerImage ?? (provider === "fal" ? 0.06 : 0.08);
  return {
    estimatedUsd,
    estimatedCredits: Math.ceil(estimatedUsd / CREDIT_USD),
  };
}
