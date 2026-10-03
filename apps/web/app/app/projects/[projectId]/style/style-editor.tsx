"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Style = {
  version: number;
  name: string;
  visualStyle: string;
  mediumRules: string | null;
  cameraRules: string | null;
  lightingRules: string | null;
  colorRules: string | null;
  compositionRules: string | null;
  historicalRules: string | null;
  wardrobeRules: string | null;
  technologyRules: string | null;
  negativeConstraints: string[];
  promptPrefix: string | null;
  promptSuffix: string | null;
  locked: boolean;
} | null;

const fields = [
  ["visualStyle", "Visual style", "Cinematic editorial illustration, photographic texture, restrained detail..."],
  ["mediumRules", "Medium", "2D illustration, semi-realistic, archival-photo treatment..."],
  ["cameraRules", "Camera", "35mm documentary framing, no extreme fisheye..."],
  ["lightingRules", "Lighting", "Practical fluorescent + CRT glow..."],
  ["colorRules", "Color", "Muted 1990s print palette..."],
  ["compositionRules", "Composition", "Subject separation, clean negative space..."],
  ["historicalRules", "Historical / period rules", "1995 only. Period-authentic equipment..."],
  ["wardrobeRules", "Wardrobe rules", "Early-1990s business casual..."],
  ["technologyRules", "Technology rules", "CRT monitors, beige towers, PCI-era hardware..."],
] as const;

export function StyleEditor({ projectId, initial }: { projectId: string; initial: Style }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const constraints = String(form.get("negativeConstraints") ?? "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const body = Object.fromEntries(fields.map(([key]) => [key, String(form.get(key) ?? "").trim() || undefined]));
    const response = await fetch(`/api/v1/projects/${projectId}/style`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        name: String(form.get("name") ?? "Primary style"),
        negativeConstraints: constraints,
        promptPrefix: String(form.get("promptPrefix") ?? "").trim() || undefined,
        promptSuffix: String(form.get("promptSuffix") ?? "").trim() || undefined,
        locked: form.get("locked") === "on",
      }),
    });
    const payload = (await response.json()) as { style?: { version: number }; error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(payload.error ?? "Save failed.");
    setMessage(`Saved as version ${payload.style?.version ?? "new"}.`);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm text-white/55">
          Bible name
          <input name="name" defaultValue={initial?.name ?? "Primary style"} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-violet-400/50" />
        </label>
        <label className="flex items-end gap-3 rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-sm">
          <input name="locked" type="checkbox" defaultChecked={initial?.locked ?? false} />
          Lock this saved version
        </label>
      </div>

      {fields.map(([key, label, placeholder]) => (
        <label key={key} className="block text-sm text-white/55">
          {label}
          <textarea required={key === "visualStyle"} name={key} defaultValue={initial?.[key] ?? ""} rows={key === "visualStyle" ? 5 : 3} placeholder={placeholder} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-violet-400/50" />
        </label>
      ))}

      <label className="block text-sm text-white/55">
        Negative constraints <span className="text-white/30">(one per line)</span>
        <textarea name="negativeConstraints" rows={6} defaultValue={initial?.negativeConstraints.join("\n") ?? ""} placeholder={"no smartphones\nno LCD displays\nno readable text"} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm text-white outline-none focus:border-violet-400/50" />
      </label>

      <details className="rounded-xl border border-white/10 bg-white/[.02] p-4">
        <summary className="cursor-pointer text-sm text-white/60">Advanced prompt wrapper</summary>
        <div className="mt-4 grid gap-4">
          <textarea name="promptPrefix" defaultValue={initial?.promptPrefix ?? ""} rows={3} placeholder="Optional fixed prefix" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm" />
          <textarea name="promptSuffix" defaultValue={initial?.promptSuffix ?? ""} rows={3} placeholder="Optional fixed suffix" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm" />
        </div>
      </details>

      <div className="flex items-center gap-4">
        <button disabled={saving} className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Saving…" : "Save new version"}</button>
        {initial && <span className="text-xs text-white/35">Current v{initial.version}</span>}
        {message && <span className="text-sm text-white/55">{message}</span>}
      </div>
    </form>
  );
}
