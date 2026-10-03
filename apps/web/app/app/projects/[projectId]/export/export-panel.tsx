"use client";

import { useEffect, useState } from "react";
import { Download, Film, Package, RefreshCw } from "lucide-react";

type ExportState = {
  id: string;
  status: string;
  type?: string;
  downloadUrl?: string | null;
  generationJob?: {
    progress: number;
    errorMessage: string | null;
  } | null;
};

type BridgeJob = {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  progress: number;
  message?: string;
  fileSizeBytes?: number;
  durationMs?: number;
};

const RENDER_BRIDGE = "/api/v1/local-bridge/render";

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function ExportPanel({
  projectId,
  sceneCount,
  selectedCount,
  initialExport,
  initialVideo,
}: {
  projectId: string;
  sceneCount: number;
  selectedCount: number;
  initialExport: { id: string; status: string } | null;
  initialVideo: { id: string; status: string } | null;
}) {
  const [current, setCurrent] = useState<ExportState | null>(initialExport);
  const [video, setVideo] = useState<ExportState | null>(initialVideo);
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [renderJob, setRenderJob] = useState<BridgeJob>();
  const [rendererOnline, setRendererOnline] = useState<boolean>();
  const [message, setMessage] = useState<string>();
  const [videoMessage, setVideoMessage] = useState<string>();

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

    const timer = window.setInterval(() => void refresh(), 1800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [current?.id, current?.status]);

  useEffect(() => {
    if (!video) return;

    let cancelled = false;
    async function refresh() {
      const response = await fetch(`/api/v1/exports/${video!.id}`, {
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;
      const body = (await response.json()) as { export: ExportState };
      if (!cancelled) setVideo(body.export);
    }

    void refresh();

    if (video.status === "SUCCEEDED" || video.status === "FAILED") {
      return () => {
        cancelled = true;
      };
    }

    return () => {
      cancelled = true;
    };
  }, [video?.id, video?.status]);

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

  async function checkRenderer() {
    try {
      const response = await fetch(`${RENDER_BRIDGE}/health`);
      setRendererOnline(response.ok);
      setVideoMessage(
        response.ok
          ? "Local FFmpeg renderer is ready."
          : "Renderer did not respond.",
      );
      return response.ok;
    } catch {
      setRendererOnline(false);
      setVideoMessage(
        "Render bridge is offline on the PC. Start Continuity Studio with pnpm local:dev.",
      );
      return false;
    }
  }

  async function finalizeVideo(
    exportId: string,
    result:
      | {
          status: "SUCCEEDED";
          fileSizeBytes: number;
          durationMs: number;
        }
      | { status: "FAILED"; error: string },
  ) {
    await fetch(`/api/v1/exports/${exportId}/complete-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
  }

  async function refreshVideo(exportId: string) {
    const response = await fetch(`/api/v1/exports/${exportId}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const body = (await response.json()) as { export: ExportState };
    setVideo(body.export);
  }

  async function renderVideo() {
    setVideoBusy(true);
    setVideoMessage(undefined);
    setRenderJob(undefined);

    let exportId: string | undefined;

    try {
      if (!(await checkRenderer())) return;

      const planResponse = await fetch(
        `/api/v1/projects/${projectId}/render-plan`,
        { method: "POST" },
      );
      const prepared = (await planResponse.json()) as {
        export?: { id: string; status: string };
        plan?: Record<string, unknown>;
        error?: string;
      };

      if (!planResponse.ok || !prepared.export || !prepared.plan) {
        throw new Error(
          prepared.error ?? "Could not prepare the MP4 render plan.",
        );
      }

      exportId = prepared.export.id;
      setVideo(prepared.export);

      const bridgeResponse = await fetch(`${RENDER_BRIDGE}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepared.plan),
      });
      const started = (await bridgeResponse.json()) as {
        jobId?: string;
        error?: string;
      };

      if (!bridgeResponse.ok || !started.jobId) {
        throw new Error(
          started.error ?? "Could not start the local FFmpeg render.",
        );
      }

      for (let attempt = 0; attempt < 3600; attempt += 1) {
        await wait(2000);

        const statusResponse = await fetch(
          `${RENDER_BRIDGE}/jobs/${started.jobId}`,
          { cache: "no-store" },
        );
        const statusBody = (await statusResponse.json()) as {
          job?: BridgeJob;
          error?: string;
        };

        if (!statusResponse.ok || !statusBody.job) {
          throw new Error(
            statusBody.error ?? "Could not read renderer progress.",
          );
        }

        setRenderJob(statusBody.job);

        if (statusBody.job.status === "FAILED") {
          throw new Error(statusBody.job.message ?? "MP4 render failed.");
        }

        if (statusBody.job.status === "SUCCEEDED") {
          if (
            statusBody.job.fileSizeBytes === undefined ||
            statusBody.job.durationMs === undefined
          ) {
            throw new Error("Renderer completed without output metadata.");
          }

          await finalizeVideo(exportId, {
            status: "SUCCEEDED",
            fileSizeBytes: statusBody.job.fileSizeBytes,
            durationMs: statusBody.job.durationMs,
          });
          await refreshVideo(exportId);
          setVideoMessage("Final MP4 is ready.");
          return;
        }
      }

      throw new Error("Renderer timed out after two hours.");
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "MP4 render failed.";
      setVideoMessage(text);

      if (exportId) {
        await finalizeVideo(exportId, {
          status: "FAILED",
          error: text,
        });
        await refreshVideo(exportId);
      }
    } finally {
      setVideoBusy(false);
    }
  }

  const ready = sceneCount > 0 && selectedCount === sceneCount;

  return (
    <div className="mt-8 space-y-5">
      <section className="rounded-2xl border border-violet-300/15 bg-violet-300/[.035] p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[.16em] text-violet-200/65">
              <Film size={14} />
              Final video
            </div>
            <h2 className="mt-2 text-xl font-semibold">
              Render MP4 locally
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Uses local Docker + FFmpeg. It applies scene timing, framing,
              zoom/pan motion, fades, voiceover, and saved subtitles without an
              additional AI/API rendering charge.
            </p>
          </div>

          <button
            onClick={() => void checkRenderer()}
            disabled={videoBusy}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60"
          >
            <RefreshCw size={13} className="mr-1.5 inline" />
            Check renderer
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void renderVideo()}
            disabled={!ready || videoBusy}
            className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-35"
          >
            {videoBusy
              ? `Rendering… ${renderJob?.progress ?? 0}%`
              : "Render final MP4"}
          </button>

          <span className="text-xs text-white/35">
            Renderer:{" "}
            {rendererOnline === undefined
              ? "not checked"
              : rendererOnline
                ? "online"
                : "offline"}
          </span>
        </div>

        {renderJob && videoBusy && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-violet-300 transition-all"
                style={{
                  width: `${Math.max(2, renderJob.progress)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-white/40">
              {renderJob.message ?? renderJob.status}
            </p>
          </div>
        )}

        {video?.status === "SUCCEEDED" && video.downloadUrl && (
          <div className="mt-6">
            <video
              controls
              preload="metadata"
              src={video.downloadUrl}
              className="aspect-video w-full rounded-xl bg-black"
            />
            <a
              href={video.downloadUrl}
              className="mt-3 inline-flex items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm"
            >
              <Download size={14} className="mr-2" />
              Download MP4
            </a>
          </div>
        )}

        {!ready && (
          <p className="mt-3 text-xs text-amber-200/60">
            Select an image for every scene before rendering.
          </p>
        )}
        {videoMessage && (
          <p className="mt-3 text-sm text-white/50">{videoMessage}</p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/30">
              <Package size={14} />
              Scene coverage
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {selectedCount} / {sceneCount}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/30">
              Source package
            </div>
            <div className="mt-2 text-sm text-white/65">
              JPEG scenes + voiceover + SRT + manifest
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          {current?.status === "SUCCEEDED" && current.downloadUrl ? (
            <a
              href={current.downloadUrl}
              className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
            >
              <Download size={14} className="mr-2" />
              Download source ZIP
            </a>
          ) : (
            <button
              onClick={() => void createExport()}
              disabled={
                !ready ||
                busy ||
                Boolean(
                  current &&
                    ["PENDING", "RUNNING"].includes(current.status),
                )
              }
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold disabled:opacity-35"
            >
              {current &&
              ["PENDING", "RUNNING"].includes(current.status)
                ? `Building ZIP… ${current.generationJob?.progress ?? 0}%`
                : busy
                  ? "Starting…"
                  : "Build source ZIP"}
            </button>
          )}

          {current?.status === "FAILED" && (
            <p className="mt-3 text-xs text-rose-300">
              {current.generationJob?.errorMessage || "Export failed."}
            </p>
          )}
          {message && (
            <p className="mt-3 text-sm text-white/50">{message}</p>
          )}
        </div>
      </section>
    </div>
  );
}
