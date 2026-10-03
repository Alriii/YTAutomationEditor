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

  const [sceneCount, selectedCount, latest] = await Promise.all([
    db.scene.count({ where: { projectId } }),
    db.scene.count({ where: { projectId, selectedAssetId: { not: null } } }),
    db.export.findFirst({
      where: { projectId, type: "ASSET_ZIP" },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">Take it with you</div>
      <h1 className="mt-2 text-3xl font-semibold">Export</h1>
      <p className="mt-2 text-sm text-white/45">
        Build a portable ZIP with normalized scene JPEGs and a timeline-ready manifest.
      </p>
      <ExportPanel
        projectId={projectId}
        sceneCount={sceneCount}
        selectedCount={selectedCount}
        initialExport={latest}
      />
    </div>
  );
}
