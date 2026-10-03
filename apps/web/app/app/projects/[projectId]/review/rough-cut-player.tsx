"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import type { SubtitleCueInput } from "@continuity/shared";

type CaptionStyle = {
  preset: "DOCUMENTARY" | "SHORTS" | "MINIMAL" | "CUSTOM";
  fontSize: number;
  textColor: string;
  backgroundOpacity: number;
  position: "TOP" | "CENTER" | "BOTTOM";
  fontWeight: "NORMAL" | "SEMIBOLD" | "BOLD";
  outline: boolean;
  maxWidthPct: number;
};

type FrameSettings = {
  fit: "cover" | "contain";
  scale: number;
  x: number;
  y: number;
  motion:
    | "NONE"
    | "ZOOM_IN"
    | "ZOOM_OUT"
    | "PAN_LEFT"
    | "PAN_RIGHT"
    | "PAN_UP"
    | "PAN_DOWN";
  transition: "CUT" | "FADE";
  transitionMs: number;
};

type PreviewScene = {
  id: string;
  sceneNumber: number;
  title: string;
  narration: string;
  durationMs: number;
  imageUrl: string | null;
  framing: FrameSettings;
};

type TimedScene = PreviewScene & {
  startMs: number;
  endMs: number;
};

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function RoughCutPlayer({
  aspectRatio,
  voiceUrl,
  scenes,
  cues,
  captionStyle,
}: {
  aspectRatio: "LANDSCAPE_16_9" | "VERTICAL_9_16" | "SQUARE_1_1";
  voiceUrl: string | null;
  scenes: PreviewScene[];
  cues: SubtitleCueInput[];
  captionStyle: CaptionStyle;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioDurationMs, setAudioDurationMs] = useState<number>();
  const [framing, setFraming] = useState<Record<string, FrameSettings>>(
    Object.fromEntries(scenes.map((scene) => [scene.id, scene.framing])),
  );
  const [framingMessage, setFramingMessage] = useState<string>();
  const silentStartRef = useRef<{ clock: number; position: number } | undefined>(undefined);

  const timedScenes = useMemo<TimedScene[]>(() => {
    let cursor = 0;
    return scenes.map((scene) => {
      const startMs = cursor;
      cursor += Math.max(250, scene.durationMs);
      return { ...scene, startMs, endMs: cursor };
    });
  }, [scenes]);

  const sceneDurationMs = timedScenes.at(-1)?.endMs ?? 0;
  const totalDurationMs = audioDurationMs ?? sceneDurationMs;

  const currentScene =
    timedScenes.find(
      (scene) => currentMs >= scene.startMs && currentMs < scene.endMs,
    ) ?? timedScenes.at(-1);

  const activeCue = cues.find(
    (cue) => currentMs >= cue.startMs && currentMs < cue.endMs,
  );

  const captionWeight =
    captionStyle.fontWeight === "BOLD"
      ? 800
      : captionStyle.fontWeight === "SEMIBOLD"
        ? 650
        : 400;

  const currentFraming = currentScene
    ? framing[currentScene.id] ?? currentScene.framing
    : undefined;

  const sceneProgress =
    currentScene && currentScene.endMs > currentScene.startMs
      ? Math.min(
          1,
          Math.max(
            0,
            (currentMs - currentScene.startMs) /
              (currentScene.endMs - currentScene.startMs),
          ),
        )
      : 0;

  function previewTransform(settings: FrameSettings): string {
    let x = settings.x;
    let y = settings.y;
    let scale = settings.scale;

    if (settings.motion === "ZOOM_IN") {
      scale *= 1 + sceneProgress * 0.08;
    } else if (settings.motion === "ZOOM_OUT") {
      scale *= 1.08 - sceneProgress * 0.08;
    } else if (settings.motion === "PAN_LEFT") {
      x += 4 - sceneProgress * 8;
    } else if (settings.motion === "PAN_RIGHT") {
      x += -4 + sceneProgress * 8;
    } else if (settings.motion === "PAN_UP") {
      y += 4 - sceneProgress * 8;
    } else if (settings.motion === "PAN_DOWN") {
      y += -4 + sceneProgress * 8;
    }

    return `translate(${x}%, ${y}%) scale(${scale})`;
  }

  function previewOpacity(settings: FrameSettings): number {
    if (
      settings.transition !== "FADE" ||
      !currentScene ||
      settings.transitionMs <= 0
    ) {
      return 1;
    }

    const localMs = currentMs - currentScene.startMs;
    const remainingMs = currentScene.endMs - currentMs;
    const fadeMs = Math.min(
      settings.transitionMs,
      Math.max(1, (currentScene.endMs - currentScene.startMs) / 2),
    );

    return Math.max(
      0,
      Math.min(1, localMs / fadeMs, remainingMs / fadeMs),
    );
  }

  function updateFraming(patch: Partial<FrameSettings>) {
    if (!currentScene) return;
    setFraming((current) => ({
      ...current,
      [currentScene.id]: {
        ...(current[currentScene.id] ?? currentScene.framing),
        ...patch,
      },
    }));
    setFramingMessage(undefined);
  }

  async function saveFraming() {
    if (!currentScene || !currentFraming) return;
    const response = await fetch(
      `/api/v1/scenes/${currentScene.id}/media-settings`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentFraming),
      },
    );
    setFramingMessage(
      response.ok ? "Scene look saved." : "Could not save scene look.",
    );
  }

  function seek(nextMs: number) {
    const clamped = Math.min(Math.max(0, nextMs), totalDurationMs || 0);
    setCurrentMs(clamped);

    if (audioRef.current && voiceUrl) {
      audioRef.current.currentTime = clamped / 1000;
    } else if (playing) {
      silentStartRef.current = {
        clock: performance.now(),
        position: clamped,
      };
    }
  }

  function stopSilentLoop() {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
  }

  function runAudioLoop() {
    stopSilentLoop();

    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) {
        frameRef.current = undefined;
        return;
      }

      setCurrentMs(Math.round(audio.currentTime * 1000));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }

  function runSilentLoop() {
    stopSilentLoop();
    if (!silentStartRef.current) {
      silentStartRef.current = {
        clock: performance.now(),
        position: currentMs,
      };
    }

    const tick = () => {
      const base = silentStartRef.current!;
      const next = base.position + (performance.now() - base.clock);
      if (next >= totalDurationMs) {
        setCurrentMs(totalDurationMs);
        setPlaying(false);
        stopSilentLoop();
        return;
      }
      setCurrentMs(next);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }

  async function togglePlay() {
    if (voiceUrl && audioRef.current) {
      if (audioRef.current.paused) {
        await audioRef.current.play();
        setPlaying(true);
      } else {
        audioRef.current.pause();
        setPlaying(false);
      }
      return;
    }

    if (playing) {
      setPlaying(false);
      stopSilentLoop();
      silentStartRef.current = undefined;
    } else {
      if (currentMs >= totalDurationMs) setCurrentMs(0);
      silentStartRef.current = {
        clock: performance.now(),
        position: currentMs >= totalDurationMs ? 0 : currentMs,
      };
      setPlaying(true);
      runSilentLoop();
    }
  }

  useEffect(() => () => stopSilentLoop(), []);

  const aspectClass =
    aspectRatio === "VERTICAL_9_16"
      ? "aspect-[9/16] max-h-[68vh] max-w-[38vh]"
      : aspectRatio === "SQUARE_1_1"
        ? "aspect-square max-h-[68vh]"
        : "aspect-video";

  return (
    <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
      <section className="rounded-2xl border border-white/10 bg-[#0b0f17] p-4">
        <div className={"relative mx-auto w-full overflow-hidden rounded-xl bg-black " + aspectClass}>
          {currentScene?.imageUrl ? (
            <img
              src={currentScene.imageUrl}
              alt={currentScene.title || `Scene ${currentScene.sceneNumber}`}
              className="h-full w-full"
              style={{
                objectFit: currentFraming?.fit ?? "cover",
                transform: currentFraming
                  ? previewTransform(currentFraming)
                  : "none",
                opacity: currentFraming
                  ? previewOpacity(currentFraming)
                  : 1,
                transformOrigin: "center center",
                willChange: "transform, opacity",
              }}
            />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-slate-950 to-slate-900 text-sm text-white/30">
              {currentScene
                ? `Scene ${String(currentScene.sceneNumber).padStart(3, "0")} has no selected image`
                : "No scenes to preview"}
            </div>
          )}

          <div
            className={
              "pointer-events-none absolute inset-x-4 flex justify-center " +
              (captionStyle.position === "TOP"
                ? "top-6"
                : captionStyle.position === "CENTER"
                  ? "top-1/2 -translate-y-1/2"
                  : "bottom-6")
            }
          >
            {activeCue && (
              <div
                className="rounded-lg px-4 py-2 text-center leading-tight shadow-lg"
                style={{
                  maxWidth: `${captionStyle.maxWidthPct}%`,
                  color: captionStyle.textColor,
                  fontSize: `${captionStyle.fontSize}px`,
                  fontWeight: captionWeight,
                  backgroundColor: `rgba(0, 0, 0, ${captionStyle.backgroundOpacity})`,
                  WebkitTextStroke: captionStyle.outline
                    ? "1.5px black"
                    : undefined,
                  paintOrder: captionStyle.outline ? "stroke fill" : undefined,
                }}
              >
                {activeCue.text}
              </div>
            )}
          </div>

          {currentScene && (
            <div className="absolute left-3 top-3 rounded-md bg-black/65 px-2 py-1 text-[10px] font-semibold tracking-wider text-white/75">
              SCENE {String(currentScene.sceneNumber).padStart(3, "0")}
            </div>
          )}
        </div>

        {voiceUrl && (
          <audio
            ref={audioRef}
            src={voiceUrl}
            preload="metadata"
            onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              if (Number.isFinite(duration)) {
                setAudioDurationMs(Math.round(duration * 1000));
              }
            }}
            onTimeUpdate={(event) =>
              setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))
            }
            onPlay={() => {
              setPlaying(true);
              runAudioLoop();
            }}
            onPause={() => {
              setPlaying(false);
              stopSilentLoop();
            }}
            onEnded={() => {
              setPlaying(false);
              stopSilentLoop();
            }}
          />
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void togglePlay()}
            disabled={!totalDurationMs}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-black disabled:opacity-30"
          >
            {playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
          </button>
          <button
            onClick={() => seek(0)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/50"
          >
            <RotateCcw size={15} />
          </button>
          <span className="w-12 text-right font-mono text-xs text-white/45">
            {formatTime(currentMs)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, totalDurationMs)}
            value={Math.min(currentMs, totalDurationMs)}
            onChange={(event) => seek(Number(event.target.value))}
            className="min-w-0 flex-1 accent-violet-400"
          />
          <span className="w-12 font-mono text-xs text-white/45">
            {formatTime(totalDurationMs)}
          </span>
          <Volume2 size={15} className={voiceUrl ? "text-white/50" : "text-white/15"} />
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {timedScenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => seek(scene.startMs)}
              className={
                "relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border text-left " +
                (currentScene?.id === scene.id
                  ? "border-violet-300"
                  : "border-white/10")
              }
            >
              {scene.imageUrl ? (
                <img src={scene.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-white/[.03]" />
              )}
              <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px]">
                {String(scene.sceneNumber).padStart(3, "0")}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
        <div className="text-[10px] uppercase tracking-[.16em] text-white/30">
          Now reviewing
        </div>
        {currentScene ? (
          <>
            <h2 className="mt-2 font-medium">
              {currentScene.title || `Scene ${currentScene.sceneNumber}`}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/45">
              {currentScene.narration}
            </p>
            {currentScene.imageUrl && currentFraming && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="text-[10px] uppercase tracking-wider text-white/30">
                  Image framing
                </div>
                <label className="mt-3 block text-xs text-white/45">
                  Fit
                  <select
                    value={currentFraming.fit}
                    onChange={(event) =>
                      updateFraming({
                        fit: event.target.value as "cover" | "contain",
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d111a] px-2 py-2 text-sm"
                  >
                    <option value="cover">Fill frame</option>
                    <option value="contain">Fit whole image</option>
                  </select>
                </label>
                <label className="mt-3 block text-xs text-white/45">
                  Zoom {currentFraming.scale.toFixed(2)}×
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.05}
                    value={currentFraming.scale}
                    onChange={(event) =>
                      updateFraming({ scale: Number(event.target.value) })
                    }
                    className="mt-1 w-full accent-violet-400"
                  />
                </label>
                <label className="mt-3 block text-xs text-white/45">
                  Horizontal {currentFraming.x.toFixed(0)}%
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={currentFraming.x}
                    onChange={(event) =>
                      updateFraming({ x: Number(event.target.value) })
                    }
                    className="mt-1 w-full accent-violet-400"
                  />
                </label>
                <label className="mt-3 block text-xs text-white/45">
                  Vertical {currentFraming.y.toFixed(0)}%
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={currentFraming.y}
                    onChange={(event) =>
                      updateFraming({ y: Number(event.target.value) })
                    }
                    className="mt-1 w-full accent-violet-400"
                  />
                </label>
                <div className="mt-4 grid gap-3">
                  <label className="text-xs text-white/45">
                    Motion
                    <select
                      value={currentFraming.motion}
                      onChange={(event) =>
                        updateFraming({
                          motion: event.target.value as FrameSettings["motion"],
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d111a] px-2 py-2 text-sm"
                    >
                      <option value="NONE">Still</option>
                      <option value="ZOOM_IN">Slow zoom in</option>
                      <option value="ZOOM_OUT">Slow zoom out</option>
                      <option value="PAN_LEFT">Pan left</option>
                      <option value="PAN_RIGHT">Pan right</option>
                      <option value="PAN_UP">Pan up</option>
                      <option value="PAN_DOWN">Pan down</option>
                    </select>
                  </label>

                  <label className="text-xs text-white/45">
                    Transition
                    <select
                      value={currentFraming.transition}
                      onChange={(event) =>
                        updateFraming({
                          transition:
                            event.target.value as FrameSettings["transition"],
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d111a] px-2 py-2 text-sm"
                    >
                      <option value="CUT">Cut</option>
                      <option value="FADE">Fade through black</option>
                    </select>
                  </label>

                  {currentFraming.transition === "FADE" && (
                    <label className="text-xs text-white/45">
                      Fade {currentFraming.transitionMs}ms
                      <input
                        type="range"
                        min={100}
                        max={1500}
                        step={50}
                        value={currentFraming.transitionMs}
                        onChange={(event) =>
                          updateFraming({
                            transitionMs: Number(event.target.value),
                          })
                        }
                        className="mt-1 w-full accent-violet-400"
                      />
                    </label>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      updateFraming({
                        fit: "cover",
                        scale: 1,
                        x: 0,
                        y: 0,
                        motion: "NONE",
                        transition: "CUT",
                        transitionMs: 350,
                      })
                    }
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => void saveFraming()}
                    className="rounded-lg bg-violet-400 px-3 py-2 text-xs font-semibold text-slate-950"
                  >
                    Save scene look
                  </button>
                </div>
                {framingMessage && (
                  <p className="mt-2 text-xs text-white/40">
                    {framingMessage}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="text-[10px] uppercase tracking-wider text-white/30">
                Active caption
              </div>
              <p className="mt-2 text-sm text-white/65">
                {activeCue?.text || "No caption at this position."}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/35">Nothing to review yet.</p>
        )}

        <div className="mt-6 border-t border-white/10 pt-4 text-xs text-white/35">
          {voiceUrl ? "Master voiceover connected" : "No voiceover track"}
          <br />
          {cues.length} caption cue{cues.length === 1 ? "" : "s"}
          <br />
          {scenes.length} scene{scenes.length === 1 ? "" : "s"}
        </div>
      </aside>
    </div>
  );
}
