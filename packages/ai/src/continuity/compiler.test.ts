import { describe, expect, it } from "vitest";
import { compileContinuity } from "./compiler";

describe("compileContinuity", () => {
  it("injects locked style, character, location and scene constraints", async () => {
    const result = await compileContinuity({
      aspectRatio: "16:9",
      provider: "openai",
      model: "gpt-image-1.5",
      style: {
        id: "style-v1",
        version: 1,
        visualStyle: "1990s cinematic tech-history documentary",
        historicalRules: "Period-authentic technology only.",
        negativeConstraints: ["no smartphones"],
        references: [],
      },
      characters: [
        {
          characterId: "char-1",
          versionId: "char-v2",
          name: "Founder",
          canonicalDescription: "Lean founder in early-1990s business casual.",
          prohibitedChanges: ["no modern leather jacket"],
          references: [],
        },
      ],
      location: {
        locationId: "loc-1",
        versionId: "loc-v1",
        name: "Startup office",
        description: "Small 1995 engineering office.",
        prohibitedElements: ["LCD displays"],
        references: [],
      },
      scene: {
        projectId: "project-1",
        sceneId: "scene-1",
        sceneNumber: 7,
        visualIntent: "Founder studies a prototype board beside a CRT.",
        continuityNotes: ["same desk as previous scene"],
      },
    });

    expect(result.mode).toBe("STRICT");
    expect(result.compiledPrompt).toContain("STYLE BIBLE v1");
    expect(result.compiledPrompt).toContain("CHARACTER LOCK: Founder");
    expect(result.compiledPrompt).toContain("LOCATION LOCK: Startup office");
    expect(result.compiledPrompt).toContain("SCENE 007");
    expect(result.negativePrompt).toContain("no smartphones");
    expect(result.fingerprint).toHaveLength(64);
  });
});
