"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CharacterCreator({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/projects/${projectId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        role: form.get("role") || undefined,
        description: form.get("description"),
        physicalTraits: form.get("physicalTraits") || undefined,
        wardrobeRules: form.get("wardrobeRules") || undefined,
        prohibitedChanges: String(form.get("prohibitedChanges") ?? "").split("\n").map(v => v.trim()).filter(Boolean),
        locked: form.get("locked") === "on",
      }),
    });
    const body = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) return setError(body.error ?? "Could not create character.");
    setOpen(false);
    router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Add character</button>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#10151f] p-6">
        <div className="flex justify-between"><h2 className="font-semibold">Character identity</h2><button type="button" onClick={() => setOpen(false)} className="text-white/40">Close</button></div>
        <input required name="name" placeholder="Jensen Huang" className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <input name="role" placeholder="Founder / narrator subject" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea required name="description" rows={5} placeholder="Canonical appearance appropriate to the documentary era..." className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea name="physicalTraits" rows={3} placeholder="Physical traits that should remain stable" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea name="wardrobeRules" rows={3} placeholder="Era-specific wardrobe rules" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <textarea name="prohibitedChanges" rows={4} placeholder={"one forbidden change per line\nno modern leather jacket"} className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm" />
        <label className="mt-4 flex gap-2 text-sm text-white/55"><input type="checkbox" name="locked" /> Lock identity</label>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button disabled={saving} className="mt-5 w-full rounded-xl bg-violet-400 px-4 py-3 font-semibold text-slate-950">{saving ? "Saving…" : "Create character"}</button>
      </form>
    </div>
  );
}
