import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { signR2Get } from "@/lib/storage/r2";
import { RoughCutPlayer } from "./rough-cut-player";

type CaptionStyle = {
  preset: "DOCUMENTARY" | "SHORTS" | "MINIMAL" | "CUSTOM";
  fontSize: number;
  textColor: string;
  backgroundOpacity: number;
  position: "TOP" | "CENTER" | "BOTTOM";
  fontWeight: "NORMAL" | "SEMIBOLD" | "BOLD";
  outline: boolean;
  maxWidthPct: number;
};

const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  preset: "DOCUMENTARY",
  fontSize: 22,
  textColor: "#FFFFFF",
  backgroundOpacity: 0.68,
  position: "BOTTOM",
  fontWeight: "SEMIBOLD",
  outline: false,
  maxWidthPct: 88,
};

function readCaptionStyle(settings: unknown): CaptionStyle {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return DEFAULT_CAPTION_STYLE;
  }

  const style = (settings as Record<string, unknown>).style;
  if (!style || typeof style !== "object" || Array.isArray(style)) {
    return DEFAULT_CAPTION_STYLE;
  }

  const raw = style as Record<string, unknown>;
  return {
    preset:
      raw.preset === "SHORTS" ||
      raw.preset === "MINIMAL" ||
      raw.preset === "CUSTOM"
        ? raw.preset
        : "DOCUMENTARY",
    fontSize:
      typeof raw.fontSize === "number"
        ? raw.fontSize
        : DEFAULT_CAPTION_STYLE.fontSize,
    textColor:
      typeof raw.textColor === "string"
        ? raw.textColor
        : DEFAULT_CAPTION_STYLE.textColor,
    backgroundOpacity:
      typeof raw.backgroundOpacity === "number"
        ? raw.backgroundOpacity
        : DEFAULT_CAPTION_STYLE.backgroundOpacity,
    position:
      raw.position === "TOP" || raw.position === "CENTER"
        ? raw.position
        : "BOTTOM",
    fontWeight:
      raw.fontWeight === "NORMAL" || raw.fontWeight === "BOLD"
        ? raw.fontWeight
        : "SEMIBOLD",
    outline:
      typeof raw.outline === "boolean"
        ? raw.outline
        : DEFAULT_CAPTION_STYLE.outline,
    maxWidthPct:
      typeof raw.maxWidthPct === "number"
        ? raw.maxWidthPct
        : DEFAULT_CAPTION_STYLE.maxWidthPct,
  };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await requireOwnedProject(projectId);

  const [scenes, cues, voiceTrack, subtitleTrack] = await Promise.all([
    db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      include: {
        selectedAsset: {
          select: {
            id: true,
            storageKey: true,
            mimeType: true,
          },
        },
      },
    }),
    db.subtitleCue.findMany({
      where: { projectId },
      orderBy: [{ startMs: "asc" }, { order: "asc" }],
    }),
    db.projectTrack.findUnique({
      where: {
        projectId_type: {
          projectId,
          type: "VOICEOVER",
        },
      },
      include: { asset: true },
    }),
    db.projectTrack.findUnique({
      where: {
        projectId_type: {
          projectId,
          type: "SUBTITLES",
        },
      },
      select: { settings: true },
    }),
  ]);

  const preparedScenes = await Promise.all(
    scenes.map(async (scene) => {
      const raw =
        scene.mediaSettings &&
        typeof scene.mediaSettings === "object" &&
        !Array.isArray(scene.mediaSettings)
          ? (scene.mediaSettings as Record<string, unknown>)
          : {};

      const fit: "cover" | "contain" =
        raw.fit === "contain" ? "contain" : "cover";

      return {
        id: scene.id,
        sceneNumber: scene.sceneNumber,
        title: scene.title ?? "",
        narration: scene.narration,
        durationMs: scene.durationHintMs ?? 4500,
        imageUrl: scene.selectedAsset
          ? await signR2Get(scene.selectedAsset.storageKey, 1800)
          : null,
        framing: {
          fit,
          scale: typeof raw.scale === "number" ? raw.scale : 1,
          x: typeof raw.x === "number" ? raw.x : 0,
          y: typeof raw.y === "number" ? raw.y : 0,
        },
      };
    }),
  );

  const voiceUrl =
    voiceTrack?.asset?.storageKey
      ? await signR2Get(voiceTrack.asset.storageKey, 1800)
      : null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Final review
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Review player</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Review the selected scene images, master voiceover, editable captions, and subtitle styling together before export.
      </p>

      <RoughCutPlayer
        aspectRatio={project.aspectRatio}
        voiceUrl={voiceUrl}
        scenes={preparedScenes}
        captionStyle={readCaptionStyle(subtitleTrack?.settings)}
        cues={cues.map((cue) => ({
          order: cue.order,
          startMs: cue.startMs,
          endMs: cue.endMs,
          text: cue.text,
        }))}
      />
    </div>
  );
}
