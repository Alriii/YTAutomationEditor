"use client";

import { useEffect, useState } from "react";

type ExportState = {
  id: string;
  status: string;
  downloadUrl?: string | null;
  generationJob?: {
    progress: number;
    errorMessage: string | null;
  } | null;
};

export function ExportPanel({
  projectId,
  sceneCount,
  selectedCount,
  initialExport,
}: {
  projectId: string;
  sceneCount: number;
  selectedCount: number;
  initialExport: { id: string; status: string } | null;
}) {
  const [current, setCurrent] = useState<ExportState | null>(initialExport);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!current) return;

    let cancelled = false;
    async function refresh() {
      const response = await fetch(`/api/v1/exports/${current!.id}`, {
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;
      const body = (await response.json()) as { export: ExportState };
      if (!cancelled) setCurrent(body.export);
    }

    void refresh();
    if (!["PENDING", "RUNNING"].includes(current.status)) {
      return () => {
        cancelled = true;
      };
    }

    const timer = setInterval(() => void refresh(), 1800);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [current?.id, current?.status]);

  async function createExport() {
    setBusy(true);
    setMessage(undefined);
    const response = await fetch(`/api/v1/projects/${projectId}/exports`, {
      method: "POST",
    });
    const body = (await response.json()) as {
      export?: { id: string; status: string };
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !body.export) {
      return setMessage(body.error ?? "Could not start export.");
    }
    setCurrent(body.export);
  }

  const ready = sceneCount > 0 && selectedCount === sceneCount;

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/30">Scene coverage</div>
          <div className="mt-2 text-2xl font-semibold">{selectedCount} / {sceneCount}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-white/30">Package</div>
          <div className="mt-2 text-sm text-white/65">SCENE_001.jpg … + manifest.json</div>
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        {current?.status === "SUCCEEDED" && current.downloadUrl ? (
          <a href={current.downloadUrl} className="inline-flex rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950">
            Download ZIP
          </a>
        ) : (
          <button
            onClick={createExport}
            disabled={!ready || busy || Boolean(current && ["PENDING", "RUNNING"].includes(current.status))}
            className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-35"
          >
            {current && ["PENDING", "RUNNING"].includes(current.status)
              ? `Exporting… ${current.generationJob?.progress ?? 0}%`
              : busy
                ? "Starting…"
                : "Build export ZIP"}
          </button>
        )}
        {!ready && <p className="mt-3 text-xs text-amber-200/60">Select a render for every scene before export.</p>}
        {current?.status === "FAILED" && <p className="mt-3 text-xs text-rose-300">{current.generationJob?.errorMessage || "Export failed."}</p>}
        {message && <p className="mt-3 text-sm text-white/50">{message}</p>}
      </div>
    </div>
  );
}
