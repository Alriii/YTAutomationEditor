import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const PORT = Number(process.env.FLOW_BRIDGE_PORT || 4317);
const ALLOWED_ORIGIN = process.env.FLOW_ALLOWED_ORIGIN || "http://localhost:3000";
const PROFILE_DIR =
  process.env.FLOW_PROFILE_DIR ||
  path.join(process.cwd(), ".flow-browser-profile");

let contextPromise;

async function firstExisting(paths) {
  for (const candidate of paths.filter(Boolean)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep searching.
    }
  }
  return undefined;
}

async function browserExecutable() {
  if (process.env.FLOW_BROWSER_PATH) {
    return process.env.FLOW_BROWSER_PATH;
  }

  if (process.platform !== "win32") return undefined;

  const local = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env["PROGRAMFILES(X86)"];

  return firstExisting([
    local && path.join(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    programFiles && path.join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    programFilesX86 && path.join(programFilesX86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    local && path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
    programFiles && path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    programFilesX86 && path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    programFiles && path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFilesX86 && path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
  ]);
}

function cors(origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

function json(res, status, body, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...cors(origin),
  });
  res.end(JSON.stringify(body));
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function launchContext() {
  if (!contextPromise) {
    contextPromise = (async () => {
      const executablePath = await browserExecutable();

      try {
        return await chromium.launchPersistentContext(PROFILE_DIR, {
          headless: false,
          viewport: { width: 1440, height: 1000 },
          acceptDownloads: true,
          ...(executablePath ? { executablePath } : {}),
        });
      } catch (error) {
        if (!executablePath) {
          throw new Error(
            "Could not launch Chromium. Run 'pnpm flow:install' once, or set FLOW_BROWSER_PATH to Chrome, Edge, or Brave.",
            { cause: error },
          );
        }
        throw error;
      }
    })();
  }

  return contextPromise;
}

async function flowPage() {
  const context = await launchContext();
  let page = context.pages().find((candidate) =>
    candidate.url().startsWith("https://flow.google.com"),
  );

  if (!page) {
    page = await context.newPage();
    await page.goto("https://flow.google.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  }

  await page.bringToFront();
  return page;
}

async function ensureProject(page) {
  await page.waitForTimeout(1200);

  if (/accounts\.google\.com/.test(page.url())) {
    throw new Error(
      "FLOW_LOGIN_REQUIRED: Sign in to Google in the opened browser, then retry.",
    );
  }

  const prompt = page
    .locator('textarea, [contenteditable="true"]')
    .filter({ visible: true })
    .last();

  if (await prompt.count()) return;

  const newProject = page
    .getByRole("button", { name: /new project|\+ new|new/i })
    .first();

  if (await newProject.count()) {
    await newProject.click();
    await page.waitForTimeout(1800);
  }

  const promptAfter = page
    .locator('textarea, [contenteditable="true"]')
    .filter({ visible: true })
    .last();

  if (!(await promptAfter.count())) {
    throw new Error(
      "FLOW_PROJECT_REQUIRED: Select or create a Flow project in the opened browser, then retry.",
    );
  }
}

async function downloadReferences(urls) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "continuity-flow-"));
  const files = [];

  for (let index = 0; index < Math.min(urls.length, 8); index += 1) {
    const url = urls[index];
    const response = await fetch(url);
    if (!response.ok) continue;
    const type = response.headers.get("content-type") || "image/jpeg";
    const extension = type.includes("png")
      ? "png"
      : type.includes("webp")
        ? "webp"
        : "jpg";
    const file = path.join(dir, `reference-${index + 1}.${extension}`);
    await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
    files.push(file);
  }

  return { dir, files };
}

async function chooseImageModel(page, model, aspectRatio) {
  const currentModel = page
    .getByRole("button")
    .filter({ hasText: /Nano Banana|Gemini|Veo|Omni/i })
    .last();

  if (await currentModel.count()) {
    await currentModel.click();
    await page.waitForTimeout(400);
  }

  const imageChoice = page.getByText("Image", { exact: true }).last();
  if (await imageChoice.count()) {
    await imageChoice.click();
    await page.waitForTimeout(300);
  }

  const modelChoice = page.getByText(model, { exact: true }).last();
  if (await modelChoice.count()) {
    await modelChoice.click();
    await page.waitForTimeout(350);
  }

  const aspectChoice = page.getByText(aspectRatio, { exact: true }).last();
  if (await aspectChoice.count()) {
    await aspectChoice.click();
    await page.waitForTimeout(250);
  }
}

async function addReferences(page, urls) {
  if (!urls.length) return () => {};

  const temp = await downloadReferences(urls);
  try {
    let fileInput = page.locator('input[type="file"]').last();

    if (!(await fileInput.count())) {
      const addImage = page
        .getByRole("button", { name: /add image|upload image|add media/i })
        .last();
      if (await addImage.count()) {
        await addImage.click();
        await page.waitForTimeout(350);
      }
      fileInput = page.locator('input[type="file"]').last();
    }

    if (await fileInput.count()) {
      await fileInput.setInputFiles(temp.files);
      await page.waitForTimeout(1000);
    }
  } finally {
    return async () => {
      await fs.rm(temp.dir, { recursive: true, force: true });
    };
  }
}

async function fillPrompt(page, promptText) {
  const textarea = page.locator("textarea:visible").last();
  if (await textarea.count()) {
    await textarea.fill(promptText);
    return;
  }

  const editor = page.locator('[contenteditable="true"]:visible').last();
  if (await editor.count()) {
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(promptText);
    return;
  }

  throw new Error("FLOW_PROMPT_NOT_FOUND: Flow prompt box was not found.");
}

async function imageSnapshot(page) {
  return page.locator("img").evaluateAll((images) =>
    images
      .filter((img) => img.complete && img.naturalWidth >= 400 && img.naturalHeight >= 400)
      .map((img) => img.currentSrc || img.src),
  );
}

async function captureNewImage(page, before) {
  await page.waitForFunction(
    (oldSources) =>
      [...document.images].some((img) => {
        const src = img.currentSrc || img.src;
        return (
          img.complete &&
          img.naturalWidth >= 512 &&
          img.naturalHeight >= 512 &&
          !oldSources.includes(src)
        );
      }),
    before,
    { timeout: 180_000 },
  );

  const candidates = await page.locator("img").evaluateAll(
    (images, oldSources) =>
      images
        .map((img, index) => ({
          index,
          src: img.currentSrc || img.src,
          area: img.naturalWidth * img.naturalHeight,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }))
        .filter(
          (item) =>
            item.width >= 512 &&
            item.height >= 512 &&
            !oldSources.includes(item.src),
        )
        .sort((a, b) => b.area - a.area),
    before,
  );

  const best = candidates[0];
  if (!best) throw new Error("FLOW_OUTPUT_NOT_FOUND: No generated image was detected.");

  const bytes = await page.locator("img").nth(best.index).screenshot({
    type: "jpeg",
    quality: 95,
  });

  return {
    mimeType: "image/jpeg",
    base64: bytes.toString("base64"),
  };
}

async function generate(payload) {
  if (
    !["Nano Banana 2 Lite", "Nano Banana 2", "Nano Banana Pro"].includes(
      payload.model,
    )
  ) {
    throw new Error("Unsupported Flow image model.");
  }

  const page = await flowPage();
  await ensureProject(page);
  await chooseImageModel(page, payload.model, payload.aspectRatio || "16:9");

  const cleanup = await addReferences(page, payload.referenceUrls || []);
  try {
    await fillPrompt(page, payload.prompt);

    const before = await imageSnapshot(page);
    const generateButton = page
      .getByRole("button", { name: /generate image/i })
      .last();

    if (!(await generateButton.count())) {
      throw new Error("FLOW_GENERATE_NOT_FOUND: Generate Image button was not found.");
    }

    await generateButton.click();
    const image = await captureNewImage(page, before);

    return {
      ok: true,
      flowUrl: page.url(),
      ...image,
    };
  } finally {
    await cleanup?.();
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
          service: "continuity-flow-bridge",
          profileDir: PROFILE_DIR,
        },
        origin,
      );
    }

    if (req.method === "POST" && req.url === "/open") {
      const page = await flowPage();
      return json(res, 200, { ok: true, flowUrl: page.url() }, origin);
    }

    if (req.method === "POST" && req.url === "/generate") {
      const payload = await body(req);
      const result = await generate(payload);
      return json(res, 200, result, origin);
    }

    return json(res, 404, { error: "Not found." }, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(res, 500, { ok: false, error: message }, origin);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("Continuity Studio Flow Bridge");
  console.log(`Listening on http://127.0.0.1:${PORT}`);
  console.log(`Allowed web origin: ${ALLOWED_ORIGIN}`);
  console.log("Browser: auto-detect Chrome / Edge / Brave, then Playwright Chromium.");
  console.log("Your Google login stays inside the local browser profile.");
  console.log("Press Ctrl+C to stop.");
  console.log("");
});
