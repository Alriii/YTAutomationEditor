"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Scene = {
  id: string;
  sceneNumber: number;
  title: string;
  narration: string;
  visualIntent: string;
  action: string;
  shotType: string;
  camera: string;
  lighting: string;
  durationHintMs: number;
  continuityNotes: string[];
  status: string;
  characterIds: string[];
  locationId: string | null;
};

export function SceneReview({
  projectId,
  workflowState,
  scenes: initialScenes,
  characters,
  locations,
}: {
  projectId: string;
  workflowState: string;
  creditBalance: number;
  scenes: Scene[];
  characters: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
}) {
  const [scenes, setScenes] = useState(initialScenes);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();

  const allApproved = useMemo(
    () =>
      scenes.length > 0 &&
      scenes.every((scene) => scene.status === "APPROVED"),
    [scenes],
  );

  async function saveScene(scene: Scene) {
    setBusy(scene.id);
    setMessage(undefined);

    const response = await fetch(`/api/v1/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: scene.title || undefined,
        narration: scene.narration,
        visualIntent: scene.visualIntent,
        action: scene.action || undefined,
        shotType: scene.shotType || undefined,
        camera: scene.camera || undefined,
        lighting: scene.lighting || undefined,
        durationHintMs: scene.durationHintMs,
        characterIds: scene.characterIds,
        locationId: scene.locationId,
        continuityNotes: scene.continuityNotes,
      }),
    });

    const body = (await response.json()) as { error?: string };
    setBusy(undefined);

    if (!response.ok) {
      return setMessage(body.error ?? "Scene save failed.");
    }

    setScenes((current) =>
      current.map((item) =>
        item.id === scene.id ? { ...item, status: "REVIEW" } : item,
      ),
    );
    setMessage(
      `Scene ${scene.sceneNumber} saved. Re-approval is required before Flow generation.`,
    );
  }

  async function approveAll() {
    setBusy("approve");
    setMessage(undefined);

    const response = await fetch(
      `/api/v1/projects/${projectId}/scenes/approve`,
      { method: "POST" },
    );
    const body = (await response.json()) as {
      approved?: number;
      error?: string;
    };

    setBusy(undefined);
    if (!response.ok) {
      return setMessage(body.error ?? "Approval failed.");
    }

    setScenes((current) =>
      current.map((scene) => ({ ...scene, status: "APPROVED" })),
    );
    setMessage(
      `${body.approved ?? scenes.length} scenes approved. Continue to Google Flow Generation.`,
    );
  }

  function updateScene(id: string, patch: Partial<Scene>) {
    setScenes((current) =>
      current.map((scene) =>
        scene.id === id ? { ...scene, ...patch } : scene,
      ),
    );
  }

  return (
    <div className="mt-8">
      <div className="sticky top-4 z-20 rounded-2xl border border-white/10 bg-[#10151f]/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={approveAll}
            disabled={!scenes.length || busy === "approve"}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-40"
          >
            Approve all reviewed scenes
          </button>

          <Link
            href={`/app/projects/${projectId}/flow`}
            className={
              "rounded-xl px-4 py-2.5 text-sm font-semibold " +
              (allApproved
                ? "bg-violet-400 text-slate-950"
                : "pointer-events-none bg-white/5 text-white/25")
            }
          >
            Continue to Flow Generation
          </Link>
        </div>

        {message && (
          <p className="mt-3 text-sm text-white/60">{message}</p>
        )}

        <div className="mt-2 text-[10px] uppercase tracking-wider text-white/25">
          Workflow: {workflowState.replaceAll("_", " ")}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {scenes.map((scene) => (
          <article
            key={scene.id}
            className="rounded-2xl border border-white/10 bg-white/[.025] p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-semibold tracking-[.15em] text-violet-300">
                SCENE {String(scene.sceneNumber).padStart(3, "0")}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/35">
                {scene.status}
              </span>
            </div>

            <input
              value={scene.title}
              onChange={(event) =>
                updateScene(scene.id, { title: event.target.value })
              }
              placeholder="Scene title"
              className="mt-4 w-full bg-transparent text-lg font-medium outline-none"
            />

            <label className="mt-4 block text-xs text-white/35">
              Narration
            </label>
            <textarea
              value={scene.narration}
              onChange={(event) =>
                updateScene(scene.id, { narration: event.target.value })
              }
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6"
            />

            <label className="mt-4 block text-xs text-white/35">
              Visual intent
            </label>
            <textarea
              value={scene.visualIntent}
              onChange={(event) =>
                updateScene(scene.id, { visualIntent: event.target.value })
              }
              rows={4}
              className="mt-2 w-full rounded-xl border border-violet-300/15 bg-black/20 px-3 py-3 text-sm leading-6"
            />

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                value={scene.shotType}
                onChange={(event) =>
                  updateScene(scene.id, { shotType: event.target.value })
                }
                placeholder="Shot type"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
              />
              <input
                value={scene.camera}
                onChange={(event) =>
                  updateScene(scene.id, { camera: event.target.value })
                }
                placeholder="Camera"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
              />
              <input
                value={scene.lighting}
                onChange={(event) =>
                  updateScene(scene.id, { lighting: event.target.value })
                }
                placeholder="Lighting"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                value={scene.locationId ?? ""}
                onChange={(event) =>
                  updateScene(scene.id, {
                    locationId: event.target.value || null,
                  })
                }
                className="rounded-xl border border-white/10 bg-[#0d111a] px-3 py-2.5 text-sm"
              >
                <option value="">No locked location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={500}
                max={60000}
                step={100}
                value={scene.durationHintMs}
                onChange={(event) =>
                  updateScene(scene.id, {
                    durationHintMs: Number(event.target.value),
                  })
                }
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
              />
            </div>

            {characters.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {characters.map((character) => {
                  const selected = scene.characterIds.includes(character.id);

                  return (
                    <button
                      type="button"
                      key={character.id}
                      onClick={() =>
                        updateScene(scene.id, {
                          characterIds: selected
                            ? scene.characterIds.filter(
                                (id) => id !== character.id,
                              )
                            : [...scene.characterIds, character.id],
                        })
                      }
                      className={
                        "rounded-full border px-3 py-1.5 text-xs " +
                        (selected
                          ? "border-violet-300/40 bg-violet-300/10 text-violet-200"
                          : "border-white/10 text-white/40")
                      }
                    >
                      {character.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => void saveScene(scene)}
                disabled={busy === scene.id}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs"
              >
                {busy === scene.id ? "Saving…" : "Save scene"}
              </button>
            </div>
          </article>
        ))}

        {scenes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/40">
            Create a script breakdown or add a manual scene.
          </div>
        )}
      </div>
    </div>
  );
}
