"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw, Unlock } from "lucide-react";
import { SceneImageUploader } from "@/components/media-uploader";

type Asset = {
  id: string;
  url: string;
  mimeType: string;
  provider: string;
  model: string;
  createdAt: string;
  locked: boolean;
};

type Job = {
  id: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
};

type Scene = {
  id: string;
  sceneNumber: number;
  title: string;
  narration: string;
  visualIntent: string;
  durationHintMs: number;
  status: string;
  locked: boolean;
  selectedAssetId: string | null;
  assets: Asset[];
  jobs: Job[];
};

export function StoryboardGrid({
  projectId,
  scenes: initialScenes,
}: {
  projectId: string;
  scenes: Scene[];
}) {
  const router = useRouter();
  const [scenes, setScenes] = useState(initialScenes);
  const [busy, setBusy] = useState<string>();
  const active = scenes.some((scene) =>
    ["QUEUED", "GENERATING"].includes(scene.status),
  );

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, router]);

  useEffect(() => {
    setScenes(initialScenes);
  }, [initialScenes]);

  async function select(sceneId: string, assetId: string) {
    setBusy(sceneId);
    const response = await fetch(`/api/v1/scenes/${sceneId}/select-asset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    setBusy(undefined);
    if (!response.ok) return;

    setScenes((current) =>
      current.map((scene) =>
        scene.id === sceneId ? { ...scene, selectedAssetId: assetId } : scene,
      ),
    );
  }

  async function toggleLock(scene: Scene) {
    setBusy(scene.id);
    const response = await fetch(`/api/v1/scenes/${scene.id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked: !scene.locked }),
    });
    setBusy(undefined);
    if (!response.ok) return;

    setScenes((current) =>
      current.map((item) =>
        item.id === scene.id ? { ...item, locked: !scene.locked } : item,
      ),
    );
  }

  async function retry(jobId: string) {
    setBusy(jobId);
    await fetch(`/api/v1/jobs/${jobId}/retry`, { method: "POST" });
    setBusy(undefined);
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {scenes.map((scene) => {
        const selected =
          scene.assets.find((asset) => asset.id === scene.selectedAssetId) ??
          scene.assets[0];
        const latestJob = scene.jobs[0];

        return (
          <article
            key={scene.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]"
          >
            <div className="relative aspect-video bg-black/35">
              {selected ? (
                <img
                  src={selected.url}
                  alt={`Scene ${scene.sceneNumber}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-xs uppercase tracking-wider text-white/25">
                  {scene.status}
                </div>
              )}

              <div className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold">
                {String(scene.sceneNumber).padStart(3, "0")}
              </div>
              <div className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] uppercase text-white/65">
                {scene.status}
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">
                    {scene.title || `Scene ${scene.sceneNumber}`}
                  </h2>
                  <p className="mt-1 text-xs text-white/35">
                    {(scene.durationHintMs / 1000).toFixed(1)}s ·{" "}
                    {scene.assets.length} render
                    {scene.assets.length === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  onClick={() => void toggleLock(scene)}
                  disabled={busy === scene.id}
                  title={scene.locked ? "Unlock scene" : "Lock selected asset"}
                  className="rounded-lg border border-white/10 p-2 text-white/50"
                >
                  {scene.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
              </div>

              <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/40">
                {scene.visualIntent}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <SceneImageUploader projectId={projectId} sceneId={scene.id} />
                <span className="text-[10px] text-white/25">
                  Uploaded images join generation history.
                </span>
              </div>

              {scene.assets.length > 1 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {scene.assets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => void select(scene.id, asset.id)}
                      className={
                        "h-14 w-20 shrink-0 overflow-hidden rounded-lg border " +
                        (asset.id === scene.selectedAssetId
                          ? "border-violet-300"
                          : "border-white/10")
                      }
                    >
                      <img
                        src={asset.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {latestJob?.status === "FAILED" && (
                <div className="mt-4 rounded-xl border border-rose-400/15 bg-rose-400/[.06] p-3">
                  <p className="line-clamp-2 text-xs text-rose-200/70">
                    {latestJob.errorMessage || "Generation failed."}
                  </p>
                  <button
                    onClick={() => void retry(latestJob.id)}
                    disabled={busy === latestJob.id}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-rose-200"
                  >
                    <RefreshCw size={12} /> Retry job
                  </button>
                </div>
              )}

              {latestJob &&
                ["QUEUED", "RUNNING"].includes(latestJob.status) && (
                  <div className="mt-4">
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-violet-400 transition-all"
                        style={{
                          width: `${Math.max(5, latestJob.progress)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-white/30">
                      {latestJob.status} · {latestJob.progress}%
                    </p>
                  </div>
                )}
            </div>
          </article>
        );
      })}

      {scenes.length === 0 && (
        <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/40">
          No scenes yet.
        </div>
      )}
    </div>
  );
}
