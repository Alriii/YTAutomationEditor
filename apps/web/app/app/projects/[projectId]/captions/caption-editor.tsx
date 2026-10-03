"use client";

import { useState } from "react";
import { parseSubtitleText, toSrt, type SubtitleCueInput } from "@continuity/shared";

function seconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

export function CaptionEditor({
  projectId,
  initialCues,
}: {
  projectId: string;
  initialCues: SubtitleCueInput[];
}) {
  const [cues, setCues] = useState(initialCues);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  function update(index: number, patch: Partial<SubtitleCueInput>) {
    setCues((current) =>
      current.map((cue, i) => (i === index ? { ...cue, ...patch } : cue)),
    );
  }

  async function save() {
    setSaving(true);
    setMessage(undefined);
    const response = await fetch(`/api/v1/projects/${projectId}/subtitles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cues: cues.map((cue, index) => ({ ...cue, order: index + 1 })),
      }),
    });
    const body = (await response.json()) as { error?: string; saved?: number };
    setSaving(false);
    setMessage(
      response.ok
        ? `${body.saved ?? cues.length} subtitle cues saved.`
        : body.error ?? "Could not save subtitles.",
    );
  }

  function exportSrt() {
    const blob = new Blob([toSrt(cues)], { type: "application/x-subrip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "subtitles.srt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
        <label className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm">
          <input
            className="hidden"
            type="file"
            accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const parsed = parseSubtitleText(await file.text());
                setCues(parsed);
                setMessage(`Imported ${parsed.length} cues. Review and save them.`);
              } catch {
                setMessage("Could not parse that subtitle file.");
              }
              event.currentTarget.value = "";
            }}
          />
          Import SRT / VTT
        </label>
        <button
          onClick={() =>
            setCues((current) => [
              ...current,
              {
                order: current.length + 1,
                startMs: current.at(-1)?.endMs ?? 0,
                endMs: (current.at(-1)?.endMs ?? 0) + 2500,
                text: "New caption",
              },
            ])
          }
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm"
        >
          Add cue
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
        >
          {saving ? "Saving…" : "Save captions"}
        </button>
        <button
          onClick={exportSrt}
          disabled={!cues.length}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm disabled:opacity-40"
        >
          Download SRT
        </button>
        {message && <span className="text-sm text-white/45">{message}</span>}
      </div>

      <div className="mt-5 space-y-2">
        {cues.map((cue, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3 md:grid-cols-[90px_110px_110px_1fr_auto]"
          >
            <div className="self-center text-xs font-medium text-violet-300">
              #{String(index + 1).padStart(3, "0")}
            </div>
            <label className="text-[10px] uppercase tracking-wider text-white/30">
              Start
              <input
                type="number"
                step="0.001"
                min="0"
                value={seconds(cue.startMs)}
                onChange={(event) =>
                  update(index, {
                    startMs: Math.max(0, Math.round(Number(event.target.value) * 1000)),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
              />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-white/30">
              End
              <input
                type="number"
                step="0.001"
                min="0"
                value={seconds(cue.endMs)}
                onChange={(event) =>
                  update(index, {
                    endMs: Math.max(1, Math.round(Number(event.target.value) * 1000)),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
              />
            </label>
            <textarea
              rows={2}
              value={cue.text}
              onChange={(event) => update(index, { text: event.target.value })}
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm leading-5"
            />
            <button
              onClick={() =>
                setCues((current) => current.filter((_, i) => i !== index))
              }
              className="self-center rounded-lg border border-rose-400/15 px-3 py-2 text-xs text-rose-300"
            >
              Delete
            </button>
          </div>
        ))}

        {!cues.length && (
          <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">
            Import subtitles or add your first cue.
          </div>
        )}
      </div>
    </div>
  );
}
