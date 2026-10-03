import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { CaptionEditor } from "./caption-editor";

export default async function CaptionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);

  const [cues, scenes] = await Promise.all([
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
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Production stage
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Captions</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Import SRT/VTT, build a free first pass from storyboard narration, then edit every cue and timing before review.
      </p>
      <CaptionEditor
        projectId={projectId}
        initialCues={cues.map((cue) => ({
          order: cue.order,
          startMs: cue.startMs,
          endMs: cue.endMs,
          text: cue.text,
        }))}
        scenes={scenes.map((scene) => ({
          sceneNumber: scene.sceneNumber,
          narration: scene.narration,
          durationMs: scene.durationHintMs ?? 4500,
        }))}
      />
    </div>
  );
}
