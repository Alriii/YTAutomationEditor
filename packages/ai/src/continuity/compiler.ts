import type {
  CompiledCharacter,
  CompiledLocation,
  ContinuityPackage,
  ContinuityReference,
} from "@continuity/shared";
import { createGenerationFingerprint } from "./fingerprint";

export type StyleBibleInput = {
  id: string;
  version: number;
  visualStyle: string;
  mediumRules?: string;
  cameraRules?: string;
  lightingRules?: string;
  colorRules?: string;
  compositionRules?: string;
  historicalRules?: string;
  wardrobeRules?: string;
  technologyRules?: string;
  negativeConstraints: string[];
  promptPrefix?: string;
  promptSuffix?: string;
  references: ContinuityReference[];
};

export type SceneInput = {
  projectId: string;
  sceneId: string;
  sceneNumber: number;
  visualIntent: string;
  action?: string;
  shotType?: string;
  camera?: string;
  lighting?: string;
  promptOverride?: string;
  continuityNotes: string[];
};

export type CompileContinuityInput = {
  scene: SceneInput;
  style: StyleBibleInput;
  characters: CompiledCharacter[];
  location?: CompiledLocation;
  aspectRatio: "16:9" | "9:16" | "1:1";
  provider: string;
  model: string;
};

function section(label: string, lines: Array<string | undefined>): string {
  const values = lines.filter((line): line is string => Boolean(line?.trim()));
  return values.length ? `${label}\n${values.join("\n")}` : "";
}

export async function compileContinuity(
  input: CompileContinuityInput,
): Promise<ContinuityPackage> {
  const { scene, style } = input;

  const characterBlocks = input.characters.map((character) =>
    section(`CHARACTER LOCK: ${character.name}`, [
      character.canonicalDescription,
      character.physicalTraits,
      character.wardrobeRules,
      character.prohibitedChanges.length
        ? `DO NOT CHANGE: ${character.prohibitedChanges.join("; ")}`
        : undefined,
    ]),
  );

  const locationBlock = input.location
    ? section(`LOCATION LOCK: ${input.location.name}`, [
        input.location.description,
        input.location.era ? `ERA: ${input.location.era}` : undefined,
        input.location.technologyRules,
        input.location.prohibitedElements.length
          ? `FORBIDDEN: ${input.location.prohibitedElements.join("; ")}`
          : undefined,
      ])
    : "";

  const sceneBlock = section(`SCENE ${String(scene.sceneNumber).padStart(3, "0")}`, [
    scene.promptOverride ?? scene.visualIntent,
    scene.action,
    scene.shotType ? `SHOT: ${scene.shotType}` : undefined,
    scene.camera ? `CAMERA: ${scene.camera}` : undefined,
    scene.lighting ? `LIGHTING: ${scene.lighting}` : undefined,
    scene.continuityNotes.length
      ? `CONTINUITY NOTES: ${scene.continuityNotes.join("; ")}`
      : undefined,
  ]);

  const compiledPrompt = [
    style.promptPrefix,
    section("OUTPUT CONTRACT", [
      `${input.aspectRatio} documentary frame`,
      "No border. No watermark. No captions unless the scene explicitly requires text.",
    ]),
    section(`STYLE BIBLE v${style.version}`, [
      style.visualStyle,
      style.mediumRules,
      style.cameraRules,
      style.lightingRules,
      style.colorRules,
      style.compositionRules,
      style.historicalRules,
      style.wardrobeRules,
      style.technologyRules,
    ]),
    ...characterBlocks,
    locationBlock,
    sceneBlock,
    style.promptSuffix,
  ]
    .filter(Boolean)
    .join("\n\n");

  const negativePrompt = [
    ...style.negativeConstraints,
    "unrequested readable text",
    "watermark",
    "anachronistic objects",
    "duplicate primary characters",
  ]
    .filter(Boolean)
    .join(", ");

  // Reference capacity is finite on image models. Identity continuity wins first,
  // then scene/world continuity, then global style references.
  const references = [
    ...input.characters.flatMap((character) => character.references),
    ...(input.location?.references ?? []),
    ...style.references,
  ];

  const fingerprint = await createGenerationFingerprint({
    compiledPrompt,
    negativePrompt,
    referenceHashes: references.map((reference) => reference.sha256 ?? reference.assetId),
    provider: input.provider,
    model: input.model,
    aspectRatio: input.aspectRatio,
  });

  return {
    mode: "STRICT",
    projectId: scene.projectId,
    sceneId: scene.sceneId,
    styleBibleVersionId: style.id,
    compiledPrompt,
    negativePrompt,
    references,
    characters: input.characters,
    ...(input.location ? { location: input.location } : {}),
    fingerprint,
  };
}
