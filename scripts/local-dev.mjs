import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const isWindows = process.platform === "win32";
const children = new Map();
let shuttingDown = false;

function command(bin, args) {
  return [bin, ...args].join(" ");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runOnce(label, bin, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${label}] ${command(bin, args)}\n`);
    const child = spawn(bin, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: isWindows,
      windowsHide: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${label} exited with code ${code ?? "unknown"}.`));
    });
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
    });

    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(700);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function health(url, expectedService) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return false;
    if (!expectedService) return true;

    const payload = await response.json();
    return payload?.service === expectedService;
  } catch {
    return false;
  }
}

async function waitForHealth({
  label,
  url,
  expectedService,
  timeoutMs = 90_000,
}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await health(url, expectedService)) return;
    await delay(350);
  }

  throw new Error(
    `${label} did not become ready within ${Math.round(timeoutMs / 1000)} seconds.`,
  );
}

async function terminate(child) {
  if (!child?.pid || child.killed) return;

  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/PID", String(child.pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true },
      );
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // Already gone.
    }
  }
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\nStopping Continuity Studio local processes...");
  await Promise.all([...children.values()].map((child) => terminate(child)));
  process.exit(exitCode);
}

function spawnService({ label, bin, args, port }) {
  const child = spawn(bin, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: isWindows,
    windowsHide: false,
    detached: !isWindows,
  });

  children.set(label, child);

  child.on("error", (error) => {
    console.error(`\n[${label}] failed to start:`, error);
    void shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(label);
    if (shuttingDown) return;

    if (code === 0 || signal === "SIGTERM") {
      console.log(`\n[${label}] stopped.`);
      return;
    }

    console.error(
      `\n[${label}] exited unexpectedly with code ${code ?? "unknown"}.`,
    );
    void shutdown(1);
  });

  console.log(`[${label}] starting on port ${port}...`);
}

function openStudio() {
  if (process.env.LOCAL_OPEN_BROWSER === "false") {
    console.log("[browser] automatic open disabled by LOCAL_OPEN_BROWSER=false");
    return;
  }

  try {
    let child;

    if (isWindows) {
      child = spawn(
        "cmd",
        ["/c", "start", "", "http://localhost:3000"],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        },
      );
    } else if (process.platform === "darwin") {
      child = spawn("open", ["http://localhost:3000"], {
        detached: true,
        stdio: "ignore",
      });
    } else {
      child = spawn("xdg-open", ["http://localhost:3000"], {
        detached: true,
        stdio: "ignore",
      });
    }

    child.unref();
  } catch {
    console.log("[browser] could not open automatically; use http://localhost:3000");
  }
}

async function main() {
  console.log("\nContinuity Studio · Free Local Mode");
  console.log("==================================");

  try {
    await runOnce("setup", "pnpm", ["local:start"]);
  } catch (error) {
    console.error("\nLocal setup failed.");
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      "\nMake sure Docker Desktop is running, then run pnpm local:dev again.",
    );
    process.exit(1);
  }

  const webUrl = "http://127.0.0.1:3000/api/healthz";
  const flowUrl = "http://127.0.0.1:4317/health";
  const renderUrl = "http://127.0.0.1:4318/health";
  const inngestUrl = "http://127.0.0.1:8288/health";
  const minioUrl = "http://127.0.0.1:9000/minio/health/ready";

  const webUp = await health(webUrl, "continuity-studio");
  const flowUp = await health(flowUrl, "continuity-flow-bridge");
  const renderUp = await health(renderUrl, "continuity-render-bridge");

  if (!webUp) {
    if (await portOpen(3000)) {
      console.error(
        "[web] port 3000 is occupied by another application. Stop it and rerun pnpm local:dev.",
      );
      process.exit(1);
    }

    spawnService({
      label: "web",
      bin: "pnpm",
      args: ["dev"],
      port: 3000,
    });
  } else {
    console.log("[web] Continuity Studio is already running.");
  }

  if (!flowUp) {
    if (await portOpen(4317)) {
      console.error(
        "[flow] port 4317 is occupied by another process. Stop it and rerun pnpm local:dev.",
      );
      await shutdown(1);
      return;
    }

    spawnService({
      label: "flow",
      bin: "pnpm",
      args: ["flow:bridge"],
      port: 4317,
    });
  } else {
    console.log("[flow] bridge is already running.");
  }

  if (!renderUp) {
    if (await portOpen(4318)) {
      console.error(
        "[render] port 4318 is occupied by another process. Stop it and rerun pnpm local:dev.",
      );
      await shutdown(1);
      return;
    }

    spawnService({
      label: "render",
      bin: "pnpm",
      args: ["render:bridge"],
      port: 4318,
    });
  } else {
    console.log("[render] bridge is already running.");
  }

  console.log("\nWaiting for local services to become healthy...");

  try {
    await Promise.all([
      waitForHealth({
        label: "Continuity Studio",
        url: webUrl,
        expectedService: "continuity-studio",
      }),
      waitForHealth({
        label: "Google Flow bridge",
        url: flowUrl,
        expectedService: "continuity-flow-bridge",
      }),
      waitForHealth({
        label: "FFmpeg renderer bridge",
        url: renderUrl,
        expectedService: "continuity-render-bridge",
      }),
      waitForHealth({
        label: "Inngest Dev Server",
        url: inngestUrl,
      }),
      waitForHealth({
        label: "MinIO storage",
        url: minioUrl,
      }),
    ]);
  } catch (error) {
    console.error(
      "\nStartup health check failed:",
      error instanceof Error ? error.message : String(error),
    );
    await shutdown(1);
    return;
  }

  console.log("\nReady:");
  console.log("  Studio      http://localhost:3000");
  console.log("  Flow bridge http://127.0.0.1:4317");
  console.log("  Renderer    http://127.0.0.1:4318");
  console.log("  Inngest     http://127.0.0.1:8288");
  console.log("  MinIO       http://127.0.0.1:9001");
  console.log("\nOpening Continuity Studio...");
  console.log("Press Ctrl+C to stop app/bridges. Docker data stays saved.\n");

  openStudio();
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

await main();
