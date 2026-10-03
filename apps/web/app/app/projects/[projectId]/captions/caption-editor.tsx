"use client";

import { useState } from "react";
import {
  fitDurationsToTotal,
  parseSubtitleText,
  toSrt,
  type SubtitleCueInput,
} from "@continuity/shared";

export type CaptionStyle = {
  preset: "DOCUMENTARY" | "SHORTS" | "MINIMAL" | "CUSTOM";
  fontSize: number;
  textColor: string;
  backgroundOpacity: number;
  position: "TOP" | "CENTER" | "BOTTOM";
  fontWeight: "NORMAL" | "SEMIBOLD" | "BOLD";
  outline: boolean;
  maxWidthPct: number;
};

function seconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

function presetStyle(preset: CaptionStyle["preset"]): CaptionStyle {
  if (preset === "SHORTS") {
    return {
      preset,
      fontSize: 30,
      textColor: "#FFFFFF",
      backgroundOpacity: 0,
      position: "CENTER",
      fontWeight: "BOLD",
      outline: true,
      maxWidthPct: 82,
    };
  }

  if (preset === "MINIMAL") {
    return {
      preset,
      fontSize: 18,
      textColor: "#FFFFFF",
      backgroundOpacity: 0.35,
      position: "BOTTOM",
      fontWeight: "NORMAL",
      outline: false,
      maxWidthPct: 76,
    };
  }

  return {
    preset: "DOCUMENTARY",
    fontSize: 22,
    textColor: "#FFFFFF",
    backgroundOpacity: 0.68,
    position: "BOTTOM",
    fontWeight: "SEMIBOLD",
    outline: false,
    maxWidthPct: 88,
  };
}

function weight(style: CaptionStyle["fontWeight"]): number {
  return style === "BOLD" ? 800 : style === "SEMIBOLD" ? 650 : 400;
}

export function CaptionEditor({
  projectId,
  initialCues,
  initialStyle,
  voiceoverDurationMs,
  scenes,
}: {
  projectId: string;
  initialCues: SubtitleCueInput[];
  initialStyle: CaptionStyle;
  voiceoverDurationMs: number | null;
  scenes: Array<{
    sceneNumber: number;
    narration: string;
    durationMs: number;
  }>;
}) {
  const [cues, setCues] = useState(initialCues);
  const [style, setStyle] = useState(initialStyle);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  function update(index: number, patch: Partial<SubtitleCueInput>) {
    setCues((current) =>
      current.map((cue, i) => (i === index ? { ...cue, ...patch } : cue)),
    );
  }

  function updateStyle(patch: Partial<CaptionStyle>) {
    setStyle((current) => ({
      ...current,
      ...patch,
      preset: patch.preset ?? "CUSTOM",
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(undefined);
    const response = await fetch(`/api/v1/projects/${projectId}/subtitles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cues: cues.map((cue, index) => ({ ...cue, order: index + 1 })),
        style,
      }),
    });
    const body = (await response.json()) as { error?: string; saved?: number };
    setSaving(false);
    setMessage(
      response.ok
        ? `${body.saved ?? cues.length} subtitle cues and style saved.`
        : body.error ?? "Could not save subtitles.",
    );
  }

  function buildFromScenes() {
    let cursor = 0;
    const generated: SubtitleCueInput[] = [];
    const fittedDurations = fitDurationsToTotal(
      scenes.map((scene) => scene.durationMs),
      voiceoverDurationMs,
      500,
    );

    for (const [sceneIndex, scene] of scenes.entries()) {
      const sceneDurationMs = fittedDurations[sceneIndex] ?? scene.durationMs;
      const words = scene.narration.trim().split(/\s+/).filter(Boolean);
      if (!words.length) {
        cursor += sceneDurationMs;
        continue;
      }

      const chunkSize = words.length <= 8 ? words.length : 7;
      const chunks: string[] = [];
      for (let index = 0; index < words.length; index += chunkSize) {
        chunks.push(words.slice(index, index + chunkSize).join(" "));
      }

      const cueDuration = Math.max(100, sceneDurationMs / chunks.length);

      chunks.forEach((text, index) => {
        const startMs = Math.round(cursor + index * cueDuration);
        const endMs =
          index === chunks.length - 1
            ? cursor + sceneDurationMs
            : Math.round(cursor + (index + 1) * cueDuration);

        generated.push({
          order: generated.length + 1,
          startMs,
          endMs,
          text,
        });
      });

      cursor += sceneDurationMs;
    }

    setCues(generated);
    setMessage(
      voiceoverDurationMs
        ? `Built ${generated.length} editable cues fitted to the ${(voiceoverDurationMs / 1000).toFixed(1)}s voiceover. Review phrase boundaries before export.`
        : `Built ${generated.length} editable cues from storyboard timing. Review them against the voiceover before export.`,
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

  const previewText =
    cues[0]?.text ?? "Your subtitle preview appears here.";

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
          onClick={buildFromScenes}
          disabled={!scenes.length}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm disabled:opacity-40"
        >
          Auto from narration
        </button>
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

      <section className="mt-5 grid gap-5 rounded-2xl border border-white/10 bg-white/[.025] p-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="text-xs uppercase tracking-[.16em] text-white/35">
            Subtitle appearance
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/45">
              Preset
              <select
                value={style.preset}
                onChange={(event) =>
                  setStyle(
                    event.target.value === "CUSTOM"
                      ? { ...style, preset: "CUSTOM" }
                      : presetStyle(event.target.value as CaptionStyle["preset"]),
                  )
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d111a] px-3 py-2 text-sm"
              >
                <option value="DOCUMENTARY">Documentary</option>
                <option value="SHORTS">Shorts / Bold</option>
                <option value="MINIMAL">Minimal</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </label>

            <label className="text-xs text-white/45">
              Position
              <select
                value={style.position}
                onChange={(event) =>
                  updateStyle({
                    position: event.target.value as CaptionStyle["position"],
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d111a] px-3 py-2 text-sm"
              >
                <option value="TOP">Top</option>
                <option value="CENTER">Center</option>
                <option value="BOTTOM">Bottom</option>
              </select>
            </label>

            <label className="text-xs text-white/45">
              Font size {style.fontSize}px
              <input
                type="range"
                min={12}
                max={72}
                value={style.fontSize}
                onChange={(event) =>
                  updateStyle({ fontSize: Number(event.target.value) })
                }
                className="mt-2 w-full accent-violet-400"
              />
            </label>

            <label className="text-xs text-white/45">
              Max width {style.maxWidthPct}%
              <input
                type="range"
                min={40}
                max={100}
                value={style.maxWidthPct}
                onChange={(event) =>
                  updateStyle({ maxWidthPct: Number(event.target.value) })
                }
                className="mt-2 w-full accent-violet-400"
              />
            </label>

            <label className="text-xs text-white/45">
              Text color
              <input
                type="color"
                value={style.textColor}
                onChange={(event) =>
                  updateStyle({ textColor: event.target.value.toUpperCase() })
                }
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/20 p-1"
              />
            </label>

            <label className="text-xs text-white/45">
              Weight
              <select
                value={style.fontWeight}
                onChange={(event) =>
                  updateStyle({
                    fontWeight: event.target.value as CaptionStyle["fontWeight"],
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d111a] px-3 py-2 text-sm"
              >
                <option value="NORMAL">Normal</option>
                <option value="SEMIBOLD">Semibold</option>
                <option value="BOLD">Bold</option>
              </select>
            </label>

            <label className="text-xs text-white/45 sm:col-span-2">
              Background opacity {Math.round(style.backgroundOpacity * 100)}%
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={style.backgroundOpacity}
                onChange={(event) =>
                  updateStyle({
                    backgroundOpacity: Number(event.target.value),
                  })
                }
                className="mt-2 w-full accent-violet-400"
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={style.outline}
              onChange={(event) =>
                updateStyle({ outline: event.target.checked })
              }
            />
            Add black text outline
          </label>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
          <div
            className={
              "absolute inset-x-4 flex justify-center " +
              (style.position === "TOP"
                ? "top-6"
                : style.position === "CENTER"
                  ? "top-1/2 -translate-y-1/2"
                  : "bottom-6")
            }
          >
            <div
              className="rounded-lg px-4 py-2 text-center leading-tight"
              style={{
                maxWidth: `${style.maxWidthPct}%`,
                color: style.textColor,
                fontSize: `${style.fontSize}px`,
                fontWeight: weight(style.fontWeight),
                backgroundColor: `rgba(0, 0, 0, ${style.backgroundOpacity})`,
                WebkitTextStroke: style.outline ? "1.5px black" : undefined,
                paintOrder: style.outline ? "stroke fill" : undefined,
              }}
            >
              {previewText}
            </div>
          </div>
          <div className="absolute left-3 top-3 rounded bg-black/55 px-2 py-1 text-[10px] uppercase tracking-wider text-white/45">
            Live preview
          </div>
        </div>
      </section>

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
                    startMs: Math.max(
                      0,
                      Math.round(Number(event.target.value) * 1000),
                    ),
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
                    endMs: Math.max(
                      1,
                      Math.round(Number(event.target.value) * 1000),
                    ),
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
