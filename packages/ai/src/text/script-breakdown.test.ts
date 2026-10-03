import { describe, expect, it } from "vitest";
import { breakDownScriptLocally } from "./script-breakdown";

describe("breakDownScriptLocally", () => {
  it("creates editable scenes without an API key", () => {
    const result = breakDownScriptLocally({
      projectTitle: "The Rise of NVIDIA NV1",
      script:
        "Before GeForce and RTX, NVIDIA had the NV1. Released in 1995, it combined 2D graphics, 3D graphics, audio, and game-controller support on one board.\n\nThe problem was its unusual approach to 3D rendering. The industry moved in another direction, forcing NVIDIA back to the drawing board.",
      characters: [],
      locations: [],
    });

    expect(result.scenes.length).toBeGreaterThan(1);
    expect(result.scenes[0]?.narration).toContain("NVIDIA");
    expect(result.scenes[0]?.visualIntent).toContain("documentary visual");
  });

  it("matches known character and location names", () => {
    const result = breakDownScriptLocally({
      projectTitle: "Demo",
      script:
        "Jensen Huang presents the new board inside NVIDIA headquarters. The audience watches as the prototype appears on screen.",
      characters: [
        { id: "character-1", name: "Jensen Huang", description: "Founder" },
      ],
      locations: [
        {
          id: "location-1",
          name: "NVIDIA headquarters",
          description: "Office",
        },
      ],
    });

    expect(result.scenes[0]?.characterIds).toContain("character-1");
    expect(result.scenes[0]?.locationId).toBe("location-1");
  });
});
