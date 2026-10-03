import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { signR2Get } from "@/lib/storage/r2";
import { StoryboardGrid } from "./storyboard-grid";

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);

  const scenes = await db.scene.findMany({
    where: { projectId },
    orderBy: { sceneNumber: "asc" },
    include: {
      assets: {
        where: { role: "SCENE_RENDER" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          storageKey: true,
          mimeType: true,
          provider: true,
          model: true,
          createdAt: true,
          locked: true,
        },
      },
      generationJobs: {
        where: { type: "IMAGE_GENERATION" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          progress: true,
          errorMessage: true,
          createdAt: true,
        },
      },
    },
  });

  const viewModels = await Promise.all(
    scenes.map(async (scene) => ({
      id: scene.id,
      sceneNumber: scene.sceneNumber,
      title: scene.title ?? "",
      narration: scene.narration,
      visualIntent: scene.visualIntent,
      durationHintMs: scene.durationHintMs ?? 4500,
      status: scene.status,
      locked: scene.locked,
      selectedAssetId: scene.selectedAssetId,
      assets: await Promise.all(
        scene.assets.map(async (asset) => ({
          id: asset.id,
          url: await signR2Get(asset.storageKey, 1800),
          mimeType: asset.mimeType,
          provider: asset.provider ?? "",
          model: asset.model ?? "",
          createdAt: asset.createdAt.toISOString(),
          locked: asset.locked,
        })),
      ),
      jobs: scene.generationJobs.map((job) => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt.toISOString(),
      })),
    })),
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">Rough cut</div>
      <h1 className="mt-2 text-3xl font-semibold">Storyboard</h1>
      <p className="mt-2 text-sm text-white/45">
        Each scene preserves generation history. Selecting a new render never deletes the previous one.
      </p>
      <StoryboardGrid projectId={projectId} scenes={viewModels} />
    </div>
  );
}
