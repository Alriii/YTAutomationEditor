export type ContinuityReference = {
  assetId: string;
  storageKey: string;
  role: "STYLE_REFERENCE" | "CHARACTER_REFERENCE" | "LOCATION_REFERENCE" | "SCENE_RENDER";
  sha256?: string;
};

export type CompiledCharacter = {
  characterId: string;
  versionId: string;
  name: string;
  canonicalDescription: string;
  physicalTraits?: string;
  wardrobeRules?: string;
  prohibitedChanges: string[];
  references: ContinuityReference[];
};

export type CompiledLocation = {
  locationId: string;
  versionId: string;
  name: string;
  description: string;
  era?: string;
  technologyRules?: string;
  prohibitedElements: string[];
  references: ContinuityReference[];
};

export type ContinuityPackage = {
  mode: "STRICT";
  projectId: string;
  sceneId: string;
  styleBibleVersionId: string;
  compiledPrompt: string;
  negativePrompt: string;
  references: ContinuityReference[];
  characters: CompiledCharacter[];
  location?: CompiledLocation;
  fingerprint: string;
};
