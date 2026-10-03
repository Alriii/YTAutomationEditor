import { describe, expect, it } from "vitest";
import { parseSubtitleText, toSrt } from "./subtitles";

describe("subtitle utilities", () => {
  it("parses SRT and VTT style timestamps", () => {
    const cues = parseSubtitleText(`1
00:00:01,000 --> 00:00:03,500
Before GeForce, there was NV1.

2
00:00:03.500 --> 00:00:06.000
Released in 1995.`);

    expect(cues).toHaveLength(2);
    expect(cues[0]?.startMs).toBe(1000);
    expect(cues[1]?.text).toBe("Released in 1995.");
  });

  it("exports editable cues as SRT", () => {
    const srt = toSrt([
      { order: 1, startMs: 0, endMs: 1250, text: "Hello" },
    ]);
    expect(srt).toContain("00:00:00,000 --> 00:00:01,250");
  });
});
