export type BreakdownCharacter = {
  id: string;
  name: string;
  description: string;
};

export type BreakdownLocation = {
  id: string;
  name: string;
  description: string;
  era?: string;
};

export type ScriptBreakdownScene = {
  sceneNumber: number;
  title: string;
  narration: string;
  visualIntent: string;
  action: string;
  shotType: string;
  camera: string;
  lighting: string;
  durationHintMs: number;
  characterIds: string[];
  locationId: string;
  continuityNotes: string[];
};

export type ScriptBreakdownResult = {
  scenes: ScriptBreakdownScene[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

type GeminiInteraction = {
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
  };
};

function outputText(payload: GeminiInteraction): string {
  return (payload.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

const sceneSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scenes: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sceneNumber: { type: "integer", minimum: 1 },
          title: { type: "string" },
          narration: { type: "string" },
          visualIntent: { type: "string" },
          action: { type: "string" },
          shotType: { type: "string" },
          camera: { type: "string" },
          lighting: { type: "string" },
          durationHintMs: { type: "integer", minimum: 500, maximum: 60000 },
          characterIds: { type: "array", items: { type: "string" } },
          locationId: { type: "string" },
          continuityNotes: { type: "array", items: { type: "string" } },
        },
        required: [
          "sceneNumber",
          "title",
          "narration",
          "visualIntent",
          "action",
          "shotType",
          "camera",
          "lighting",
          "durationHintMs",
          "characterIds",
          "locationId",
          "continuityNotes",
        ],
      },
    },
  },
  required: ["scenes"],
} as const;

export async function breakDownScriptWithGemini(input: {
  apiKey: string;
  model: string;
  projectTitle: string;
  script: string;
  aspectRatio: string;
  targetDurationSec?: number;
  characters: BreakdownCharacter[];
  locations: BreakdownLocation[];
}): Promise<ScriptBreakdownResult> {
  const registry = JSON.stringify(
    {
      characters: input.characters,
      locations: input.locations,
    },
    null,
    2,
  );

  const prompt = `You are the scene-planning engine for Continuity Studio.

Break the supplied documentary script into visual scenes for image generation.

Rules:
- The narration field must contain the exact script passage covered by that scene. Do not rewrite narration.
- visualIntent describes what the viewer should SEE, not a paraphrase of narration.
- Prefer concrete, filmable visual concepts.
- Preserve chronological and historical accuracy.
- Use only character IDs and location IDs from the supplied registry.
- If a scene needs no known character, characterIds must be [].
- If no registered location fits, locationId must be "".
- Keep shots varied but continuity-friendly.
- Target 3–8 seconds per still unless narration density requires longer.
- The output is for HUMAN REVIEW. Do not imply assets have been generated.
- Aspect ratio: ${input.aspectRatio}.
${input.targetDurationSec ? `- Target total duration: approximately ${input.targetDurationSec} seconds.` : ""}

PROJECT:
${input.projectTitle}

KNOWN CONTINUITY REGISTRY:
${registry}

SCRIPT:
${input.script}`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": input.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: prompt,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: sceneSchema,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gemini breakdown failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as GeminiInteraction;
  const raw = outputText(payload);
  if (!raw) throw new Error("Gemini returned no structured scene breakdown.");

  const parsed = JSON.parse(raw) as { scenes?: ScriptBreakdownScene[] };
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("Scene breakdown was empty.");
  }

  return {
    scenes: parsed.scenes,
    usage: {
      ...(payload.usage?.total_input_tokens !== undefined
        ? { inputTokens: payload.usage.total_input_tokens }
        : {}),
      ...(payload.usage?.total_output_tokens !== undefined
        ? { outputTokens: payload.usage.total_output_tokens }
        : {}),
    },
  };
}
