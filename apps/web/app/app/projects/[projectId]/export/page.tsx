import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { ExportPanel } from "./export-panel";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);

  const [sceneCount, selectedCount, latestZip, latestVideo] =
    await Promise.all([
      db.scene.count({ where: { projectId } }),
      db.scene.count({
        where: { projectId, selectedAssetId: { not: null } },
      }),
      db.export.findFirst({
        where: { projectId, type: "ASSET_ZIP" },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      }),
      db.export.findFirst({
        where: { projectId, type: "VIDEO_MP4" },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      }),
    ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Take it with you
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Export</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Render the reviewed project to MP4 locally with FFmpeg, or build the
        portable source package with selected images, voiceover, subtitles,
        and timeline metadata.
      </p>

      <ExportPanel
        projectId={projectId}
        sceneCount={sceneCount}
        selectedCount={selectedCount}
        initialExport={latestZip}
        initialVideo={latestVideo}
      />
    </div>
  );
}
