import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.RENDER_BRIDGE_PORT || 4318);
const ALLOWED_ORIGIN =
  process.env.RENDER_ALLOWED_ORIGIN || "http://localhost:3000";
const ROOT = process.cwd();
const COMPOSE_FILE = path.join(ROOT, "docker-compose.local.yml");
const RENDER_ROOT = path.join(ROOT, ".local-render");
const jobs = new Map();

function cors(origin) {
  return {
    "Access-Control-Allow-Origin":
      origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

function json(res, status, value, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...cors(origin),
  });
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not download render input (${response.status}).`,
    );
  }
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

function dimensions(aspectRatio) {
  if (aspectRatio === "VERTICAL_9_16") return { width: 1080, height: 1920 };
  if (aspectRatio === "SQUARE_1_1") return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

function number(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function mediaSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    fit: raw.fit === "contain" ? "contain" : "cover",
    scale: Math.max(1, Math.min(3, number(raw.scale, 1))),
    x: Math.max(-100, Math.min(100, number(raw.x, 0))),
    y: Math.max(-100, Math.min(100, number(raw.y, 0))),
    motion: [
      "ZOOM_IN",
      "ZOOM_OUT",
      "PAN_LEFT",
      "PAN_RIGHT",
      "PAN_UP",
      "PAN_DOWN",
    ].includes(raw.motion)
      ? raw.motion
      : "NONE",
    transition: raw.transition === "FADE" ? "FADE" : "CUT",
    transitionMs: Math.max(
      0,
      Math.min(1500, Math.round(number(raw.transitionMs, 350))),
    ),
  };
}

function normalizedFilter(settings, width, height) {
  if (settings.fit === "contain") {
    return (
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`
    );
  }

  return (
    `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
    `crop=${width}:${height},setsar=1`
  );
}

function sceneFilter(settings, durationSec, width, height, fps) {
  const frames = Math.max(1, Math.round(durationSec * fps));
  const denominator = Math.max(1, frames - 1);
  const progress = `on/${denominator}`;
  let zoom = settings.scale.toFixed(4);

  if (settings.motion === "ZOOM_IN") {
    zoom = `${settings.scale.toFixed(4)}+0.08*(${progress})`;
  } else if (settings.motion === "ZOOM_OUT") {
    zoom = `${(settings.scale + 0.08).toFixed(4)}-0.08*(${progress})`;
  } else if (
    settings.motion === "PAN_LEFT" ||
    settings.motion === "PAN_RIGHT" ||
    settings.motion === "PAN_UP" ||
    settings.motion === "PAN_DOWN"
  ) {
    zoom = Math.max(settings.scale, 1.08).toFixed(4);
  }

  const xOffset = settings.x / 200;
  const yOffset = settings.y / 200;
  let x =
    `(iw-iw/zoom)/2+(iw-iw/zoom)*${xOffset.toFixed(5)}`;
  let y =
    `(ih-ih/zoom)/2+(ih-ih/zoom)*${yOffset.toFixed(5)}`;

  if (settings.motion === "PAN_LEFT") {
    x = `(iw-iw/zoom)*(1-(${progress}))`;
  } else if (settings.motion === "PAN_RIGHT") {
    x = `(iw-iw/zoom)*(${progress})`;
  } else if (settings.motion === "PAN_UP") {
    y = `(ih-ih/zoom)*(1-(${progress}))`;
  } else if (settings.motion === "PAN_DOWN") {
    y = `(ih-ih/zoom)*(${progress})`;
  }

  let filter =
    `${normalizedFilter(settings, width, height)},` +
    `zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=${width}x${height}:fps=${fps},` +
    `trim=duration=${durationSec.toFixed(3)},setpts=PTS-STARTPTS`;

  if (settings.transition === "FADE" && settings.transitionMs > 0) {
    const fadeSec = Math.min(
      settings.transitionMs / 1000,
      Math.max(0.05, durationSec / 2),
    );
    const fadeOutStart = Math.max(0, durationSec - fadeSec);
    filter +=
      `,fade=t=in:st=0:d=${fadeSec.toFixed(3)}` +
      `,fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeSec.toFixed(3)}`;
  }

  return filter;
}

function assColor(hex, alpha = 0) {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : "FFFFFF";
  const rr = clean.slice(0, 2);
  const gg = clean.slice(2, 4);
  const bb = clean.slice(4, 6);
  const aa = Math.max(0, Math.min(255, Math.round(alpha)))
    .toString(16)
    .padStart(2, "0");
  return `&H${aa}${bb}${gg}${rr}`.toUpperCase();
}

function subtitleForceStyle(settings, outputHeight) {
  const raw =
    settings &&
    typeof settings === "object" &&
    settings.style &&
    typeof settings.style === "object"
      ? settings.style
      : {};

  const fontSize = Math.round(
    Math.max(12, Math.min(72, number(raw.fontSize, 22))) *
      (outputHeight / 720),
  );
  const opacity = Math.max(
    0,
    Math.min(1, number(raw.backgroundOpacity, 0.68)),
  );
  const backgroundAlpha = Math.round((1 - opacity) * 255);
  const alignment =
    raw.position === "TOP" ? 8 : raw.position === "CENTER" ? 5 : 2;
  const outline = raw.outline ? 2 : 0;
  const borderStyle = opacity > 0.01 ? 3 : 1;
  const bold = raw.fontWeight === "BOLD" ? -1 : 0;

  return [
    "FontName=DejaVu Sans",
    `FontSize=${fontSize}`,
    `PrimaryColour=${assColor(raw.textColor || "#FFFFFF", 0)}`,
    `BackColour=${assColor("#000000", backgroundAlpha)}`,
    `BorderStyle=${borderStyle}`,
    `Outline=${outline}`,
    `Bold=${bold}`,
    `Alignment=${alignment}`,
    "MarginV=56",
  ].join(",");
}

function runRenderer(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "compose",
        "-f",
        COMPOSE_FILE,
        "run",
        "--rm",
        "renderer",
        "-hide_banner",
        "-loglevel",
        "error",
        ...args,
      ],
      {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(
        new Error(
          stderr.trim() ||
            `FFmpeg renderer exited with code ${code ?? "unknown"}.`,
        ),
      );
    });
  });
}

async function renderJob(jobId, payload) {
  const state = jobs.get(jobId);
  const jobDir = path.join(RENDER_ROOT, "jobs", jobId);
  const containerDir = `/work/jobs/${jobId}`;

  try {
    await fs.mkdir(jobDir, { recursive: true });
    state.status = "RUNNING";
    state.progress = 3;
    state.message = "Downloading project media";

    const { width, height } = dimensions(payload.aspectRatio);
    const fps = 30;
    const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
    if (!scenes.length) throw new Error("No scenes were supplied to renderer.");

    for (const [index, scene] of scenes.entries()) {
      const filename = `scene-${String(index + 1).padStart(3, "0")}.jpg`;
      await download(scene.imageUrl, path.join(jobDir, filename));
    }

    let voiceFile;
    if (payload.voiceoverUrl) {
      const extension =
        payload.voiceoverMimeType === "audio/mpeg"
          ? "mp3"
          : String(payload.voiceoverMimeType || "").includes("wav")
            ? "wav"
            : "m4a";
      voiceFile = `voiceover.${extension}`;
      await download(payload.voiceoverUrl, path.join(jobDir, voiceFile));
    }

    if (payload.subtitlesSrt) {
      await fs.writeFile(
        path.join(jobDir, "subtitles.srt"),
        payload.subtitlesSrt,
        "utf8",
      );
    }

    state.progress = 12;
    state.message = "Rendering scenes";

    const segmentFiles = [];
    for (const [index, scene] of scenes.entries()) {
      const image = `scene-${String(index + 1).padStart(3, "0")}.jpg`;
      const segment = `segment-${String(index + 1).padStart(3, "0")}.mp4`;
      const durationSec = Math.max(0.25, number(scene.durationMs, 4500) / 1000);
      const settings = mediaSettings(scene.mediaSettings);

      await runRenderer([
        "-y",
        "-loop",
        "1",
        "-framerate",
        String(fps),
        "-i",
        `${containerDir}/${image}`,
        "-vf",
        sceneFilter(settings, durationSec, width, height, fps),
        "-t",
        durationSec.toFixed(3),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-r",
        String(fps),
        `${containerDir}/${segment}`,
      ]);

      segmentFiles.push(segment);
      state.progress =
        12 + Math.round(((index + 1) / scenes.length) * 58);
      state.message = `Rendered scene ${index + 1} of ${scenes.length}`;
    }

    await fs.writeFile(
      path.join(jobDir, "segments.txt"),
      segmentFiles.map((file) => `file '${file}'`).join("\n"),
      "utf8",
    );

    state.progress = 73;
    state.message = "Joining scene timeline";

    await runRenderer([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      `${containerDir}/segments.txt`,
      "-c",
      "copy",
      `${containerDir}/visuals.mp4`,
    ]);

    state.progress = 82;
    state.message = "Adding voiceover and captions";

    const finalArgs = ["-y", "-i", `${containerDir}/visuals.mp4`];
    if (voiceFile) {
      finalArgs.push("-i", `${containerDir}/${voiceFile}`);
    }

    if (payload.subtitlesSrt) {
      const forceStyle = subtitleForceStyle(
        payload.subtitleSettings,
        height,
      );
      finalArgs.push(
        "-vf",
        `subtitles=${containerDir}/subtitles.srt:force_style='${forceStyle}'`,
      );
    }

    finalArgs.push(
      "-map",
      "0:v:0",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
    );

    if (voiceFile) {
      finalArgs.push(
        "-map",
        "1:a:0",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
      );
    } else {
      finalArgs.push("-an");
    }

    finalArgs.push(
      "-movflags",
      "+faststart",
      `${containerDir}/final.mp4`,
    );

    await runRenderer(finalArgs);

    state.progress = 94;
    state.message = "Uploading MP4";

    const output = await fs.readFile(path.join(jobDir, "final.mp4"));
    const upload = await fetch(payload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: output,
    });
    if (!upload.ok) {
      throw new Error(`MP4 upload failed (${upload.status}).`);
    }

    state.status = "SUCCEEDED";
    state.progress = 100;
    state.message = "MP4 ready";
    state.fileSizeBytes = output.byteLength;
    state.durationMs = scenes.reduce(
      (sum, scene) => sum + Math.max(1, Math.round(number(scene.durationMs, 0))),
      0,
    );

    await fs.rm(jobDir, { recursive: true, force: true });
  } catch (error) {
    state.status = "FAILED";
    state.message =
      error instanceof Error ? error.message : String(error);
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(origin));
    return res.end();
  }

  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(
        res,
        200,
        {
          ok: true,
          service: "continuity-render-bridge",
          renderer: "docker-ffmpeg",
        },
        origin,
      );
    }

    if (req.method === "POST" && req.url === "/render") {
      const payload = await readBody(req);
      if (!payload.uploadUrl || !Array.isArray(payload.scenes)) {
        return json(
          res,
          400,
          { error: "Render plan is incomplete." },
          origin,
        );
      }

      const jobId = randomUUID();
      jobs.set(jobId, {
        id: jobId,
        status: "QUEUED",
        progress: 0,
        message: "Queued",
      });

      void renderJob(jobId, payload);
      return json(res, 202, { jobId }, origin);
    }

    const match = req.url?.match(/^\/jobs\/([a-f0-9-]+)$/i);
    if (req.method === "GET" && match) {
      const job = jobs.get(match[1]);
      if (!job) {
        return json(res, 404, { error: "Render job not found." }, origin);
      }
      return json(res, 200, { job }, origin);
    }

    return json(res, 404, { error: "Not found." }, origin);
  } catch (error) {
    return json(
      res,
      500,
      {
        error: error instanceof Error ? error.message : String(error),
      },
      origin,
    );
  }
});

await fs.mkdir(RENDER_ROOT, { recursive: true });

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("Continuity Studio Render Bridge");
  console.log(`Listening on http://127.0.0.1:${PORT}`);
  console.log(`Allowed web origin: ${ALLOWED_ORIGIN}`);
  console.log("Renderer: local Docker + FFmpeg");
  console.log("Press Ctrl+C to stop.");
  console.log("");
});
