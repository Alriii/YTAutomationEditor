"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function audioDurationMs(file: File): Promise<number | undefined> {
  const url = URL.createObjectURL(file);
  const audio = document.createElement("audio");
  audio.preload = "metadata";

  try {
    return await new Promise<number | undefined>((resolve) => {
      const timeout = window.setTimeout(() => resolve(undefined), 12000);

      audio.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        const duration = audio.duration;
        resolve(
          Number.isFinite(duration) && duration > 0
            ? Math.round(duration * 1000)
            : undefined,
        );
      };

      audio.onerror = () => {
        window.clearTimeout(timeout);
        resolve(undefined);
      };

      audio.src = url;
    });
  } finally {
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function VoiceoverUploader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function upload(file: File) {
    setBusy(true);
    setMessage(undefined);
    try {
      const durationMs = await audioDurationMs(file);
      const response = await fetch("/api/v1/uploads/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "voiceover",
          projectId,
          mimeType: file.type,
          fileSizeBytes: file.size,
          sha256: await sha256(file),
          ...(durationMs !== undefined ? { durationMs } : {}),
        }),
      });
      const body = (await response.json()) as { uploadUrl?: string; error?: string };
      if (!response.ok || !body.uploadUrl) {
        throw new Error(body.error ?? "Could not prepare voiceover upload.");
      }

      const uploaded = await fetch(body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error("Voiceover upload failed.");

      setMessage(
        durationMs !== undefined
          ? `Voiceover uploaded · ${(durationMs / 1000).toFixed(1)}s timeline.`
          : "Voiceover uploaded. Duration could not be read automatically.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950">
        <input
          className="hidden"
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.currentTarget.value = "";
          }}
        />
        {busy ? "Uploading…" : "Upload voiceover"}
      </label>
      {message && <p className="mt-2 text-xs text-white/45">{message}</p>}
    </div>
  );
}

export function SceneImageUploader({
  projectId,
  sceneId,
}: {
  projectId: string;
  sceneId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/uploads/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "scene-image",
          projectId,
          sceneId,
          mimeType: file.type,
          fileSizeBytes: file.size,
          sha256: await sha256(file),
        }),
      });
      const body = (await response.json()) as {
        asset?: { id: string };
        uploadUrl?: string;
        error?: string;
      };
      if (!response.ok || !body.uploadUrl || !body.asset) {
        throw new Error(body.error ?? "Could not prepare image upload.");
      }

      const uploaded = await fetch(body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error("Scene image upload failed.");

      await fetch(`/api/v1/scenes/${sceneId}/select-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: body.asset.id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="inline-flex cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white">
      <input
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
      />
      {busy ? "Uploading…" : "Use own image"}
    </label>
  );
}
