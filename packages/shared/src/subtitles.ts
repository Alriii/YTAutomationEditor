export type SubtitleCueInput = {
  order: number;
  startMs: number;
  endMs: number;
  text: string;
};

function parseTimestamp(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) throw new Error("Invalid subtitle timestamp.");

  const secondsPart = parts.pop()!;
  const minutesPart = parts.pop()!;
  const hoursPart = parts.pop() ?? "0";

  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);

  if (![hours, minutes, seconds].every(Number.isFinite)) {
    throw new Error("Invalid subtitle timestamp.");
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function parseSubtitleText(source: string): SubtitleCueInput[] {
  const clean = source.replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
  if (!clean) return [];

  const withoutHeader = clean.replace(/^WEBVTT[^\n]*\n+/, "");
  const blocks = withoutHeader.split(/\n{2,}/);
  const cues: SubtitleCueInput[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    if (!lines.length) continue;

    const timeIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeIndex < 0) continue;

    const [startRaw, endWithSettings] = lines[timeIndex]!.split("-->").map((part) => part.trim());
    const endRaw = endWithSettings?.split(/\s+/)[0];
    if (!startRaw || !endRaw) continue;

    const text = lines.slice(timeIndex + 1).join("\n").trim();
    if (!text) continue;

    const startMs = parseTimestamp(startRaw);
    const endMs = parseTimestamp(endRaw);
    if (endMs <= startMs) continue;

    cues.push({
      order: cues.length + 1,
      startMs,
      endMs,
      text,
    });
  }

  return cues;
}

function formatSrtTimestamp(ms: number): string {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":") + "," + String(millis).padStart(3, "0");
}

export function toSrt(cues: SubtitleCueInput[]): string {
  return cues
    .sort((a, b) => a.order - b.order)
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text.trim()}`,
    )
    .join("\n\n");
}
