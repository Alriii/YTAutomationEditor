"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Play, RefreshCw } from "lucide-react";

export type FlowModel =
  | "Nano Banana 2 Lite"
  | "Nano Banana 2"
  | "Nano Banana Pro";

type PlannedScene = {
  sceneId: string;
  sceneNumber: number;
  locked: boolean;
  hasSelectedAsset: boolean;
  fingerprint: string;
  prompt: string;
  referenceUrls: string[];
};

type Plan = {
  model: FlowModel;
  aspectRatio: "16:9" | "9:16" | "1:1";
  scenes: PlannedScene[];
};

type SceneRun = {
  state: "idle" | "running" | "done" | "failed" | "skipped";
  message?: string;
};

const BRIDGE = "/api/v1/local-bridge/flow";

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64File(base64: string, sceneNumber: number): File {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File(
    [bytes],
    `FLOW_SCENE_${String(sceneNumber).padStart(3, "0")}.jpg`,
    { type: "image/jpeg" },
  );
}

export function FlowGeneration({
  projectId,
  initialModel,
}: {
  projectId: string;
  initialModel: FlowModel;
}) {
  const router = useRouter();
  const [model, setModel] = useState<FlowModel>(initialModel);
  const [bridgeOnline, setBridgeOnline] = useState<boolean>();
  const [plan, setPlan] = useState<Plan>();
  const [runs, setRuns] = useState<Record<string, SceneRun>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function saveModel(next: FlowModel) {
    const response = await fetch(
      `/api/v1/projects/${projectId}/flow-settings`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: next }),
      },
    );

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setMessage(body.error ?? "Could not save Flow model choice.");
    }
  }

  async function checkBridge() {
    try {
      const response = await fetch(`${BRIDGE}/health`);
      setBridgeOnline(response.ok);
      setMessage(
        response.ok
          ? "Local Flow bridge is ready."
          : "Flow bridge did not respond.",
      );
    } catch {
      setBridgeOnline(false);
      setMessage(
        "Flow bridge is offline on the PC. Start Continuity Studio with pnpm local:dev.",
      );
    }
  }

  async function openFlow() {
    try {
      await fetch(`${BRIDGE}/open`, { method: "POST" });
      setBridgeOnline(true);
      setMessage(
        "Flow opened locally. Sign in and select/create a Flow project if needed.",
      );
    } catch {
      setBridgeOnline(false);
      setMessage("Start Continuity Studio on the PC with pnpm local:dev.");
    }
  }

  async function prepare() {
    setBusy(true);
    setMessage(undefined);

    const response = await fetch(
      `/api/v1/projects/${projectId}/flow-plan`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      },
    );

    const body = (await response.json()) as Plan & { error?: string };
    setBusy(false);

    if (!response.ok) {
      return setMessage(body.error ?? "Could not build Flow generation plan.");
    }

    setPlan(body);

    const nextRuns: Record<string, SceneRun> = {};
    for (const scene of body.scenes) {
      if (scene.locked) {
        nextRuns[scene.sceneId] = {
          state: "skipped",
          message: "Locked",
        };
      } else if (scene.hasSelectedAsset) {
        nextRuns[scene.sceneId] = {
          state: "skipped",
          message: "Already has selected image",
        };
      } else {
        nextRuns[scene.sceneId] = { state: "idle" };
      }
    }
    setRuns(nextRuns);
    setMessage(
      `Prepared ${body.scenes.length} scenes for ${body.model}.`,
    );
  }

  async function storeSceneImage(scene: PlannedScene, base64: string) {
    const file = base64File(base64, scene.sceneNumber);

    const response = await fetch("/api/v1/uploads/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "scene-image",
        projectId,
        sceneId: scene.sceneId,
        mimeType: file.type,
        fileSizeBytes: file.size,
        sha256: await sha256(file),
        source: "flow",
        model,
        sourcePrompt: scene.prompt,
        continuityFingerprint: scene.fingerprint,
      }),
    });

    const prepared = (await response.json()) as {
      asset?: { id: string };
      uploadUrl?: string;
      error?: string;
    };

    if (!response.ok || !prepared.asset || !prepared.uploadUrl) {
      throw new Error(prepared.error ?? "Could not prepare scene upload.");
    }

    const uploaded = await fetch(prepared.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploaded.ok) throw new Error("Could not store Flow image.");

    const selected = await fetch(
      `/api/v1/scenes/${scene.sceneId}/select-asset`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: prepared.asset.id }),
      },
    );

    if (!selected.ok) throw new Error("Could not select returned Flow image.");
  }

  async function generateScene(scene: PlannedScene) {
    setRuns((current) => ({
      ...current,
      [scene.sceneId]: { state: "running" },
    }));

    try {
      const response = await fetch(`${BRIDGE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          aspectRatio: plan?.aspectRatio ?? "16:9",
          prompt: scene.prompt,
          referenceUrls: scene.referenceUrls,
        }),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        base64?: string;
        error?: string;
      };

      if (!response.ok || !body.base64) {
        throw new Error(body.error ?? "Flow generation failed.");
      }

      await storeSceneImage(scene, body.base64);

      setRuns((current) => ({
        ...current,
        [scene.sceneId]: { state: "done" },
      }));
      return true;
    } catch (error) {
      setRuns((current) => ({
        ...current,
        [scene.sceneId]: {
          state: "failed",
          message: error instanceof Error ? error.message : "Generation failed.",
        },
      }));
      return false;
    }
  }

  async function generateMissing() {
    if (!plan) return;
    setBusy(true);
    setMessage("Generating through Google Flow. Keep the Flow browser open.");

    for (const scene of plan.scenes) {
      const state = runs[scene.sceneId]?.state;
      if (scene.locked || state === "skipped" || state === "done") continue;

      const ok = await generateScene(scene);
      if (!ok) {
        setMessage(
          `Stopped at Scene ${scene.sceneNumber}. Fix the Flow window or retry that scene.`,
        );
        setBusy(false);
        router.refresh();
        return;
      }
    }

    setBusy(false);
    setMessage("Flow generation pass finished. Review the storyboard.");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={model}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value as FlowModel;
              setModel(next);
              setPlan(undefined);
              setRuns({});
              void saveModel(next);
            }}
            className="rounded-xl border border-white/10 bg-[#0d111a] px-3 py-2.5 text-sm"
          >
            <option value="Nano Banana 2 Lite">Nano Banana 2 Lite</option>
            <option value="Nano Banana 2">Nano Banana 2</option>
            <option value="Nano Banana Pro">Nano Banana Pro</option>
          </select>

          <button
            onClick={() => void checkBridge()}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm"
          >
            <RefreshCw size={14} className="mr-2 inline" />
            Check bridge
          </button>

          <button
            onClick={() => void openFlow()}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm"
          >
            <ExternalLink size={14} className="mr-2 inline" />
            Open Flow
          </button>

          <button
            onClick={() => void prepare()}
            disabled={busy}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-sm disabled:opacity-40"
          >
            Compile scenes
          </button>

          {plan && (
            <button
              onClick={() => void generateMissing()}
              disabled={busy || bridgeOnline === false}
              className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              <Play size={14} className="mr-2 inline" />
              Generate missing scenes
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-white/40">
          Bridge:{" "}
          {bridgeOnline === undefined
            ? "not checked"
            : bridgeOnline
              ? "online"
              : "offline"}
          . Flow controls its own current credit cost and availability.
        </div>
        {message && <p className="mt-3 text-sm text-white/60">{message}</p>}
      </section>

      {plan && (
        <section className="overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[90px_1fr_160px] bg-white/[.035] px-4 py-3 text-[10px] uppercase tracking-wider text-white/30">
            <span>Scene</span>
            <span>Continuity package</span>
            <span>Status</span>
          </div>

          {plan.scenes.map((scene) => {
            const run = runs[scene.sceneId] ?? { state: "idle" as const };

            return (
              <div
                key={scene.sceneId}
                className="grid grid-cols-[90px_1fr_160px] gap-3 border-t border-white/10 px-4 py-4"
              >
                <span className="font-mono text-xs text-violet-300">
                  {String(scene.sceneNumber).padStart(3, "0")}
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs leading-5 text-white/45">
                    {scene.prompt}
                  </p>
                  <p className="mt-1 text-[10px] text-white/25">
                    {scene.referenceUrls.length} reference image
                    {scene.referenceUrls.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div>
                  <div className="text-xs uppercase text-white/55">
                    {run.state}
                  </div>
                  {run.message && (
                    <p className="mt-1 line-clamp-2 text-[10px] text-rose-200/60">
                      {run.message}
                    </p>
                  )}
                  {run.state === "failed" && (
                    <button
                      onClick={() => void generateScene(scene)}
                      disabled={busy}
                      className="mt-2 text-xs text-violet-300"
                    >
                      Retry scene
                    </button>
                  )}
                  {!scene.locked &&
                    (run.state === "skipped" || run.state === "done") && (
                      <button
                        onClick={() => void generateScene(scene)}
                        disabled={busy}
                        className="mt-2 block text-xs text-violet-300"
                      >
                        Generate another
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
