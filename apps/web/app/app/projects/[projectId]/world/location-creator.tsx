"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LocationCreator({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/projects/${projectId}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        era: form.get("era") || undefined,
        architectureRules: form.get("architectureRules") || undefined,
        technologyRules: form.get("technologyRules") || undefined,
        environmentalRules: form.get("environmentalRules") || undefined,
        prohibitedElements: String(form.get("prohibitedElements") ?? "").split("\n").map(v => v.trim()).filter(Boolean),
        locked: form.get("locked") === "on",
      }),
    });
    const body = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) return setError(body.error ?? "Could not create location.");
    setOpen(false);
    router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Add location</button>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#10151f] p-6">
        <div className="flex justify-between"><h2 className="font-semibold">Location identity</h2><button type="button" onClick={() => setOpen(false)} className="text-white/40">Close</button></div>
        <input required name="name" placeholder="Early NVIDIA engineering office" className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <input name="era" placeholder="1993–1995" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea required name="description" rows={5} placeholder="Small startup office with cluttered engineering desks..." className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea name="architectureRules" rows={3} placeholder="Architecture / furniture rules" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea name="technologyRules" rows={3} placeholder="CRT monitors, beige towers, no LCD..." className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea name="environmentalRules" rows={3} placeholder="Environmental cues" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea name="prohibitedElements" rows={4} placeholder="Forbidden elements, one per line" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm" />
        <label className="mt-4 flex gap-2 text-sm text-white/55"><input type="checkbox" name="locked" /> Lock location</label>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button disabled={saving} className="mt-5 w-full rounded-xl bg-violet-400 px-4 py-3 font-semibold text-slate-950">{saving ? "Saving…" : "Create location"}</button>
      </form>
    </div>
  );
}
