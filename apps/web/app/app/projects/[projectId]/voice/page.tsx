import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { signR2Get } from "@/lib/storage/r2";
import { VoiceoverUploader } from "@/components/media-uploader";

export default async function VoiceoverPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);

  const track = await db.projectTrack.findUnique({
    where: {
      projectId_type: {
        projectId,
        type: "VOICEOVER",
      },
    },
    include: { asset: true },
  });

  const voiceUrl =
    track?.asset?.storageKey
      ? await signR2Get(track.asset.storageKey, 1800)
      : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Production stage
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Voiceover</h1>
      <p className="mt-2 max-w-2xl text-sm text-white/45">
        Upload your finished narration. Storyboard timing, captions, and review can use this as the master audio track.
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Master narration</h2>
            <p className="mt-1 text-xs text-white/35">
              MP3, WAV, or M4A. Uploading a replacement keeps old assets in project history but changes the active voiceover track.
            </p>
          </div>
          <VoiceoverUploader projectId={projectId} />
        </div>

        {voiceUrl ? (
          <audio
            className="mt-6 w-full"
            controls
            preload="metadata"
            src={voiceUrl}
          />
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">
            No voiceover uploaded yet.
          </div>
        )}
      </div>
    </div>
  );
}
