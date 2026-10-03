import { describe, expect, it } from "vitest";
import { fitDurationsToTotal } from "./timing";

describe("fitDurationsToTotal", () => {
  it("preserves proportions while matching the exact voiceover duration", () => {
    const result = fitDurationsToTotal([4000, 6000, 10000], 30000);
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(30000);
    expect(result[2]).toBeGreaterThan(result[1]!);
    expect(result[1]).toBeGreaterThan(result[0]!);
  });

  it("keeps existing durations when there is no voiceover duration", () => {
    expect(fitDurationsToTotal([1000, 2000], null)).toEqual([1000, 2000]);
  });
});
