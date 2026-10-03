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

  const cues = await db.subtitleCue.findMany({
    where: { projectId },
    orderBy: [{ startMs: "asc" }, { order: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Production stage
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Captions</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Import SRT/VTT or edit cues manually. Timing and wording stay editable before final review.
      </p>
      <CaptionEditor
        projectId={projectId}
        initialCues={cues.map((cue) => ({
          order: cue.order,
          startMs: cue.startMs,
          endMs: cue.endMs,
          text: cue.text,
        }))}
      />
    </div>
  );
}
