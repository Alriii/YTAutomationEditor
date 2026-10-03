"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  role: "STYLE_REFERENCE" | "CHARACTER_REFERENCE" | "LOCATION_REFERENCE";
  target: {
    styleBibleVersionId?: string;
    characterVersionId?: string;
    locationVersionId?: string;
  };
};

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function ReferenceUploader({ projectId, role, target }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const router = useRouter();

  async function upload(file: File) {
    setBusy(true);
    setMessage(undefined);
    try {
      const hash = await sha256(file);
      const response = await fetch("/api/v1/uploads/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          role,
          mimeType: file.type,
          fileSizeBytes: file.size,
          sha256: hash,
          ...target,
        }),
      });
      const body = (await response.json()) as {
        uploadUrl?: string;
        error?: string;
      };
      if (!response.ok || !body.uploadUrl) {
        throw new Error(body.error ?? "Could not prepare upload.");
      }

      const uploaded = await fetch(body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error("Reference upload failed.");

      setMessage("Reference uploaded.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-violet-300/30 hover:text-white">
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
      {busy ? "Uploading…" : "Upload reference"}
      {message && <span className="text-white/35">{message}</span>}
    </label>
  );
}
