import { compileContinuity, type CompileContinuityInput } from "@continuity/ai";
import { db } from "@continuity/db";
import type { ContinuityReference } from "@continuity/shared";

function assetReference(asset: {
  id: string;
  storageKey: string;
  role: string;
  sha256: string | null;
}): ContinuityReference {
  return {
    assetId: asset.id,
    storageKey: asset.storageKey,
    role: asset.role as ContinuityReference["role"],
    ...(asset.sha256 ? { sha256: asset.sha256 } : {}),
  };
}

export async function compileSceneFromDatabase(input: {
  projectId: string;
  sceneId: string;
  provider: string;
  model: string;
}) {
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    include: {
      styleBibleVersions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { assets: true },
      },
    },
  });
  if (!project) throw new Error("Project not found.");
  const style = project.styleBibleVersions[0];
  if (!style) throw new Error("Style Bible is required before continuity compilation.");

  const scene = await db.scene.findFirst({
    where: { id: input.sceneId, projectId: input.projectId },
    include: {
      characters: {
        include: {
          character: true,
          characterVersion: { include: { assets: true } },
        },
      },
      locationVersion: {
        include: { location: true, assets: true },
      },
    },
  });
  if (!scene) throw new Error("Scene not found.");

  const aspectRatio =
    project.aspectRatio === "VERTICAL_9_16"
      ? "9:16"
      : project.aspectRatio === "SQUARE_1_1"
        ? "1:1"
        : "16:9";

  const compileInput: CompileContinuityInput = {
    scene: {
      projectId: project.id,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      visualIntent: scene.visualIntent,
      continuityNotes: scene.continuityNotes,
      ...(scene.action ? { action: scene.action } : {}),
      ...(scene.shotType ? { shotType: scene.shotType } : {}),
      ...(scene.camera ? { camera: scene.camera } : {}),
      ...(scene.lighting ? { lighting: scene.lighting } : {}),
      ...(scene.promptOverride ? { promptOverride: scene.promptOverride } : {}),
    },
    style: {
      id: style.id,
      version: style.version,
      visualStyle: style.visualStyle,
      negativeConstraints: style.negativeConstraints,
      references: style.assets.map(assetReference),
      ...(style.mediumRules ? { mediumRules: style.mediumRules } : {}),
      ...(style.cameraRules ? { cameraRules: style.cameraRules } : {}),
      ...(style.lightingRules ? { lightingRules: style.lightingRules } : {}),
      ...(style.colorRules ? { colorRules: style.colorRules } : {}),
      ...(style.compositionRules ? { compositionRules: style.compositionRules } : {}),
      ...(style.historicalRules ? { historicalRules: style.historicalRules } : {}),
      ...(style.wardrobeRules ? { wardrobeRules: style.wardrobeRules } : {}),
      ...(style.technologyRules ? { technologyRules: style.technologyRules } : {}),
      ...(style.promptPrefix ? { promptPrefix: style.promptPrefix } : {}),
      ...(style.promptSuffix ? { promptSuffix: style.promptSuffix } : {}),
    },
    characters: scene.characters.map((entry) => ({
      characterId: entry.character.id,
      versionId: entry.characterVersion.id,
      name: entry.character.name,
      canonicalDescription: entry.characterVersion.description,
      prohibitedChanges: entry.characterVersion.prohibitedChanges,
      references: entry.characterVersion.assets.map(assetReference),
      ...(entry.characterVersion.physicalTraits ? { physicalTraits: entry.characterVersion.physicalTraits } : {}),
      ...(entry.characterVersion.wardrobeRules ? { wardrobeRules: entry.characterVersion.wardrobeRules } : {}),
    })),
    aspectRatio,
    provider: input.provider,
    model: input.model,
    ...(scene.locationVersion
      ? {
          location: {
            locationId: scene.locationVersion.location.id,
            versionId: scene.locationVersion.id,
            name: scene.locationVersion.location.name,
            description: scene.locationVersion.description,
            prohibitedElements: scene.locationVersion.prohibitedElements,
            references: scene.locationVersion.assets.map(assetReference),
            ...(scene.locationVersion.era ? { era: scene.locationVersion.era } : {}),
            ...(scene.locationVersion.technologyRules ? { technologyRules: scene.locationVersion.technologyRules } : {}),
          },
        }
      : {}),
  };

  return compileContinuity(compileInput);
}
