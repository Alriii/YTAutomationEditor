import { describe, expect, it } from "vitest";
import { sceneBreakdownItemSchema } from "./scene";

describe("sceneBreakdownItemSchema", () => {
  it("accepts a continuity-ready scene", () => {
    const parsed = sceneBreakdownItemSchema.parse({
      sceneNumber: 1,
      narration: "Before GeForce, NVIDIA had the NV1.",
      visualIntent: "Macro shot of an NV1-era board on a 1995 engineering bench.",
      characterIds: [],
      locationId: null,
      continuityNotes: ["period-correct PC hardware only"],
    });

    expect(parsed.sceneNumber).toBe(1);
    expect(parsed.characterIds).toEqual([]);
    expect(parsed.continuityNotes).toHaveLength(1);
  });

  it("rejects an empty visual intent", () => {
    expect(() =>
      sceneBreakdownItemSchema.parse({
        sceneNumber: 1,
        narration: "Narration",
        visualIntent: "",
        characterIds: [],
        continuityNotes: [],
      }),
    ).toThrow();
  });
});
