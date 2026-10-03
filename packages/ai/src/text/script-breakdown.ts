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


function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sceneTitle(narration: string, sceneNumber: number): string {
  const words = narration
    .replace(/[“”"']/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(" ");

  return words ? words.replace(/[.,;:!?]+$/, "") : `Scene ${sceneNumber}`;
}

function scriptChunks(script: string): string[] {
  const paragraphs = script
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let current: string[] = [];

    for (const word of words) {
      current.push(word);
      const sentenceEnd = /[.!?][”"'’)]?$/.test(word);

      if (
        (current.length >= 16 && sentenceEnd) ||
        current.length >= 24
      ) {
        chunks.push(current.join(" "));
        current = [];
      }
    }

    if (current.length) {
      if (
        current.length < 7 &&
        chunks.length > 0 &&
        wordCount(chunks[chunks.length - 1]!) < 30
      ) {
        chunks[chunks.length - 1] =
          `${chunks[chunks.length - 1]} ${current.join(" ")}`;
      } else {
        chunks.push(current.join(" "));
      }
    }
  }

  return chunks.slice(0, 200);
}

function matchingIds(
  narration: string,
  entries: Array<{ id: string; name: string }>,
): string[] {
  const haystack = narration.toLocaleLowerCase();
  return entries
    .filter((entry) =>
      haystack.includes(entry.name.toLocaleLowerCase()),
    )
    .map((entry) => entry.id);
}

export function breakDownScriptLocally(input: {
  projectTitle: string;
  script: string;
  targetDurationSec?: number;
  characters: BreakdownCharacter[];
  locations: BreakdownLocation[];
}): ScriptBreakdownResult {
  const chunks = scriptChunks(input.script);
  if (!chunks.length) {
    throw new Error("Script is empty.");
  }

  const shotCycle = [
    "medium documentary shot",
    "close-up detail",
    "wide environmental shot",
    "three-quarter documentary composition",
  ] as const;

  const rawDurations = chunks.map((narration) =>
    Math.round(
      Math.min(12, Math.max(3.5, wordCount(narration) / 2.5)) * 1000,
    ),
  );

  const rawTotalMs = rawDurations.reduce((sum, value) => sum + value, 0);
  const requestedMs =
    input.targetDurationSec !== undefined
      ? input.targetDurationSec * 1000
      : undefined;
  const durationScale =
    requestedMs && rawTotalMs > 0 ? requestedMs / rawTotalMs : 1;

  const scenes = chunks.map((narration, index): ScriptBreakdownScene => {
    const sceneNumber = index + 1;
    const characterIds = matchingIds(narration, input.characters);
    const locationIds = matchingIds(narration, input.locations);
    const durationHintMs = Math.round(
      Math.min(
        20_000,
        Math.max(2_500, rawDurations[index]! * durationScale),
      ),
    );

    const literalExcerpt =
      narration.length > 280
        ? `${narration.slice(0, 277).trimEnd()}...`
        : narration;

    return {
      sceneNumber,
      title: sceneTitle(narration, sceneNumber),
      narration,
      visualIntent:
        `Create a concrete documentary visual that directly represents this exact narration while preserving historical and visual continuity: ${literalExcerpt}`,
      action:
        "Depict the specific event, object, person, or environment described in the narration.",
      shotType: shotCycle[index % shotCycle.length]!,
      camera: "Natural documentary composition with a clear primary subject.",
      lighting: "Motivated lighting consistent with the project's Style Bible and era.",
      durationHintMs,
      characterIds,
      locationId: locationIds[0] ?? "",
      continuityNotes: [
        "Local free breakdown: verify the visual intent, cast, location, era, and factual details before approval.",
      ],
    };
  });

  return { scenes };
}

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
