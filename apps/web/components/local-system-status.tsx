"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";

type Status = "checking" | "online" | "offline";

type Services = {
  database: Status;
  storage: Status;
  inngest: Status;
  flow: Status;
  renderer: Status;
};

const initial: Services = {
  database: "checking",
  storage: "checking",
  inngest: "checking",
  flow: "checking",
  renderer: "checking",
};

function badge(status: Status) {
  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-white/35">
        <RefreshCw size={12} className="animate-spin" />
        checking
      </span>
    );
  }

  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
        <CheckCircle2 size={13} />
        online
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-rose-300">
      <XCircle size={13} />
      offline
    </span>
  );
}

async function bridgeHealth(url: string, expectedService: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(1800),
    });
    if (!response.ok) return false;

    const body = (await response.json()) as { service?: string };
    return body.service === expectedService;
  } catch {
    return false;
  }
}

export function LocalSystemStatus() {
  const [services, setServices] = useState<Services>(initial);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    setServices(initial);

    const [server, flow, renderer] = await Promise.all([
      fetch("/api/v1/system/health", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as {
            services?: {
              database?: boolean;
              storage?: boolean;
              inngest?: boolean;
            };
          };
        })
        .catch(() => null),
      bridgeHealth(
        "http://127.0.0.1:4317/health",
        "continuity-flow-bridge",
      ),
      bridgeHealth(
        "http://127.0.0.1:4318/health",
        "continuity-render-bridge",
      ),
    ]);

    setServices({
      database: server?.services?.database ? "online" : "offline",
      storage: server?.services?.storage ? "online" : "offline",
      inngest: server?.services?.inngest ? "online" : "offline",
      flow: flow ? "online" : "offline",
      renderer: renderer ? "online" : "offline",
    });
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows: Array<{
    key: keyof Services;
    label: string;
    detail: string;
    recovery: string;
  }> = [
    {
      key: "database",
      label: "PostgreSQL",
      detail: "projects, scenes, timelines",
      recovery: "Run pnpm local:dev and make sure Docker is running.",
    },
    {
      key: "storage",
      label: "MinIO storage",
      detail: "references, voiceover, renders",
      recovery: "Run pnpm local:dev to start MinIO and create the bucket.",
    },
    {
      key: "inngest",
      label: "Inngest",
      detail: "durable background jobs",
      recovery: "Run pnpm local:dev to start the local Inngest server.",
    },
    {
      key: "flow",
      label: "Google Flow bridge",
      detail: "Nano Banana image generation",
      recovery: "Run pnpm local:dev, then sign into Flow when its browser opens.",
    },
    {
      key: "renderer",
      label: "FFmpeg renderer",
      detail: "final MP4 export",
      recovery: "Run pnpm local:dev to start the render bridge.",
    },
  ];

  const allOnline = rows.every(
    ({ key }) => services[key] === "online",
  );

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[.16em] text-white/35">
            Local system
          </div>
          <h2 className="mt-1 text-lg font-medium">
            {allOnline ? "Everything is ready" : "Service health"}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={checking}
          className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 disabled:opacity-40"
        >
          <RefreshCw
            size={13}
            className={"mr-1.5 " + (checking ? "animate-spin" : "")}
          />
          Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-5">
        {rows.map((row) => {
          const status = services[row.key];
          return (
            <div
              key={row.key}
              className={
                "rounded-xl border p-3 " +
                (status === "offline"
                  ? "border-rose-300/15 bg-rose-300/[.035]"
                  : "border-white/10 bg-black/15")
              }
              title={status === "offline" ? row.recovery : undefined}
            >
              <div className="text-sm font-medium">{row.label}</div>
              <div className="mt-1 text-[11px] text-white/30">
                {row.detail}
              </div>
              <div className="mt-3">{badge(status)}</div>
              {status === "offline" && (
                <p className="mt-2 text-[10px] leading-4 text-rose-200/55">
                  {row.recovery}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
