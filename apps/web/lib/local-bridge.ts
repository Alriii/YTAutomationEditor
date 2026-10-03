import { requireAppUser, isLocalMode } from "@/lib/auth";

type BridgeName = "flow" | "render";

const ports: Record<BridgeName, number> = {
  flow: 4317,
  render: 4318,
};

function allowed(bridge: BridgeName, method: string, parts: string[]): boolean {
  const path = parts.join("/");

  if (bridge === "flow") {
    if (method === "GET" && path === "health") return true;
    if (method === "POST" && (path === "open" || path === "generate")) return true;
    return false;
  }

  if (method === "GET" && path === "health") return true;
  if (
    method === "GET" &&
    parts.length === 2 &&
    parts[0] === "jobs" &&
    /^[0-9a-f-]{36}$/i.test(parts[1] ?? "")
  ) {
    return true;
  }
  if (method === "POST" && path === "render") return true;
  return false;
}

export async function proxyLocalBridge(
  request: Request,
  bridge: BridgeName,
  parts: string[],
): Promise<Response> {
  if (!isLocalMode()) {
    return Response.json(
      { error: "Local bridge proxy is available only in LOCAL_MODE." },
      { status: 404 },
    );
  }

  await requireAppUser();

  if (!allowed(bridge, request.method, parts)) {
    return Response.json({ error: "Unsupported bridge operation." }, { status: 404 });
  }

  const target = new URL(
    `http://127.0.0.1:${ports[bridge]}/${parts.map(encodeURIComponent).join("/")}`,
  );

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(target, {
    method: request.method,
    headers,
    ...(hasBody ? { body: await request.text() } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(
      bridge === "flow" && parts[0] === "generate" ? 240_000 : 15_000,
    ),
  });

  const responseType =
    response.headers.get("content-type") || "application/json; charset=utf-8";

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "content-type": responseType,
      "cache-control": "no-store",
    },
  });
}
