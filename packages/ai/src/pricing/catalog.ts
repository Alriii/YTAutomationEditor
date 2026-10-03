import type { CostEstimate, ImageGenerationRequest } from "../providers/types";

const CREDIT_USD = 0.01;

type PricingRule = {
  provider: string;
  model: string;
  estimatedUsdPerImage: number;
};

const RULES: PricingRule[] = [
  {
    provider: "google",
    model: "gemini-3.1-flash-lite-image",
    estimatedUsdPerImage: 0.0336,
  },
  {
    provider: "google",
    model: "gemini-3.1-flash-image",
    estimatedUsdPerImage: 0.067,
  },
  {
    provider: "google",
    model: "gemini-3-pro-image",
    estimatedUsdPerImage: 0.134,
  },
];

export function estimateImageCost(
  provider: string,
  request: ImageGenerationRequest,
): CostEstimate {
  const exact = RULES.find(
    (rule) => rule.provider === provider && rule.model === request.model,
  );

  const estimatedUsd = exact?.estimatedUsdPerImage ?? 0.067;
  return {
    estimatedUsd,
    estimatedCredits: Math.ceil(estimatedUsd / CREDIT_USD),
  };
}
