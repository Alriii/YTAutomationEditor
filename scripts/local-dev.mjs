import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const isWindows = process.platform === "win32";
const children = new Map();
let shuttingDown = false;

function command(bin, args) {
  return [bin, ...args].join(" ");
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
    const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return false;
    if (!expectedService) return true;

    const payload = await response.json();
    return payload?.service === expectedService;
  } catch {
    return false;
  }
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

async function main() {
  console.log("\nContinuity Studio · Free Local Mode");
  console.log("==================================");

  try {
    await runOnce("setup", "pnpm", ["local:start"]);
  } catch (error) {
    console.error("\nLocal setup failed.");
    console.error(
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "\nMake sure Docker Desktop is running, then run pnpm local:dev again.",
    );
    process.exit(1);
  }

  const webUp = await portOpen(3000);
  const flowUp = await health(
    "http://127.0.0.1:4317/health",
    "continuity-flow-bridge",
  );
  const renderUp = await health(
    "http://127.0.0.1:4318/health",
    "continuity-render-bridge",
  );

  if (!webUp) {
    spawnService({
      label: "web",
      bin: "pnpm",
      args: ["dev"],
      port: 3000,
    });
  } else {
    console.log("[web] port 3000 is already in use, leaving it running.");
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

  console.log("\nReady:");
  console.log("  Studio      http://localhost:3000");
  console.log("  Flow bridge http://127.0.0.1:4317");
  console.log("  Renderer    http://127.0.0.1:4318");
  console.log("  Inngest     http://127.0.0.1:8288");
  console.log("  MinIO       http://127.0.0.1:9001");
  console.log("\nPress Ctrl+C to stop app/bridges. Docker data stays saved.\n");
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

await main();
