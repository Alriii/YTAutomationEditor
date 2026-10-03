"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export function NewProjectForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description") || undefined,
        aspectRatio: form.get("aspectRatio"),
        language: "en",
      }),
    });
    const body = (await response.json()) as { project?: { id: string }; error?: string };
    setSaving(false);
    if (!response.ok || !body.project) {
      setError(body.error ?? "Could not create project.");
      return;
    }
    setOpen(false);
    router.push(`/app/projects/${body.project.id}`);
    router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950"><Plus size={16} /> New project</button>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#10151f] p-6 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">New project</h2><button type="button" onClick={() => setOpen(false)} className="text-white/45 hover:text-white"><X size={18} /></button></div>
        <label className="mt-6 block text-xs text-white/50">Title</label>
        <input required name="title" maxLength={140} placeholder="The Rise of NVIDIA NV1" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none focus:border-violet-400/60" />
        <label className="mt-4 block text-xs text-white/50">Description</label>
        <textarea name="description" rows={3} maxLength={2000} placeholder="Tech-history documentary..." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none focus:border-violet-400/60" />
        <label className="mt-4 block text-xs text-white/50">Aspect ratio</label>
        <select name="aspectRatio" defaultValue="LANDSCAPE_16_9" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d111a] px-3 py-3">
          <option value="LANDSCAPE_16_9">16:9 documentary</option>
          <option value="VERTICAL_9_16">9:16 vertical</option>
          <option value="SQUARE_1_1">1:1 square</option>
        </select>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button disabled={saving} className="mt-6 w-full rounded-xl bg-violet-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{saving ? "Creating…" : "Create project"}</button>
      </form>
    </div>
  );
}
