import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { CaptionEditor } from "./caption-editor";

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

const DEFAULT_STYLE: CaptionStyle = {
  preset: "DOCUMENTARY",
  fontSize: 22,
  textColor: "#FFFFFF",
  backgroundOpacity: 0.68,
  position: "BOTTOM",
  fontWeight: "SEMIBOLD",
  outline: false,
  maxWidthPct: 88,
};

function subtitleStyle(settings: unknown): CaptionStyle {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return DEFAULT_STYLE;
  }

  const style = (settings as Record<string, unknown>).style;
  if (!style || typeof style !== "object" || Array.isArray(style)) {
    return DEFAULT_STYLE;
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
      typeof raw.fontSize === "number" ? raw.fontSize : DEFAULT_STYLE.fontSize,
    textColor:
      typeof raw.textColor === "string"
        ? raw.textColor
        : DEFAULT_STYLE.textColor,
    backgroundOpacity:
      typeof raw.backgroundOpacity === "number"
        ? raw.backgroundOpacity
        : DEFAULT_STYLE.backgroundOpacity,
    position:
      raw.position === "TOP" || raw.position === "CENTER"
        ? raw.position
        : "BOTTOM",
    fontWeight:
      raw.fontWeight === "NORMAL" || raw.fontWeight === "BOLD"
        ? raw.fontWeight
        : "SEMIBOLD",
    outline:
      typeof raw.outline === "boolean" ? raw.outline : DEFAULT_STYLE.outline,
    maxWidthPct:
      typeof raw.maxWidthPct === "number"
        ? raw.maxWidthPct
        : DEFAULT_STYLE.maxWidthPct,
  };
}

export default async function CaptionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);

  const [cues, scenes, track, voiceTrack] = await Promise.all([
    db.subtitleCue.findMany({
      where: { projectId },
      orderBy: [{ startMs: "asc" }, { order: "asc" }],
    }),
    db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      select: {
        sceneNumber: true,
        narration: true,
        durationHintMs: true,
      },
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
    db.projectTrack.findUnique({
      where: {
        projectId_type: {
          projectId,
          type: "VOICEOVER",
        },
      },
      include: { asset: { select: { durationMs: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Production stage
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Captions</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Import SRT/VTT, build a free first pass from storyboard narration, edit every cue, and style the subtitles before review.
      </p>
      <CaptionEditor
        projectId={projectId}
        initialCues={cues.map((cue) => ({
          order: cue.order,
          startMs: cue.startMs,
          endMs: cue.endMs,
          text: cue.text,
        }))}
        initialStyle={subtitleStyle(track?.settings)}
        voiceoverDurationMs={voiceTrack?.asset?.durationMs ?? null}
        scenes={scenes.map((scene) => ({
          sceneNumber: scene.sceneNumber,
          narration: scene.narration,
          durationMs: scene.durationHintMs ?? 4500,
        }))}
      />
    </div>
  );
}
