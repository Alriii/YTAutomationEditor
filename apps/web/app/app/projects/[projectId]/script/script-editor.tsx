"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Version = {
  id: string;
  version: number;
  content: string;
  targetDurationSec: number | null;
  locked: boolean;
} | null;

export function ScriptEditor({
  projectId,
  initialTitle,
  initialVersion,
}: {
  projectId: string;
  initialTitle: string;
  initialVersion: Version;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialVersion?.content ?? "");
  const [versionId, setVersionId] = useState(initialVersion?.id);
  const [saving, setSaving] = useState(false);
  const [jobId, setJobId] = useState<string>();
  const [jobStatus, setJobStatus] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/v1/jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { job: { status: string; errorMessage?: string } };
      setJobStatus(body.job.status);
      if (body.job.status === "SUCCEEDED") {
        clearInterval(timer);
        setMessage("Breakdown ready for human review.");
        router.push(`/app/projects/${projectId}/scenes`);
        router.refresh();
      }
      if (body.job.status === "FAILED" || body.job.status === "CANCELLED") {
        clearInterval(timer);
        setMessage(body.job.errorMessage ?? "Breakdown failed.");
      }
    }, 1800);
    return () => clearInterval(timer);
  }, [jobId, projectId, router]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const duration = Number(form.get("targetDurationSec")) || undefined;
    const response = await fetch(`/api/v1/projects/${projectId}/scripts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        content,
        targetDurationSec: duration,
        locked: form.get("locked") === "on",
      }),
    });
    const body = (await response.json()) as { version?: { id: string; version: number }; error?: string };
    setSaving(false);
    if (!response.ok || !body.version) return setMessage(body.error ?? "Save failed.");
    setVersionId(body.version.id);
    setMessage(`Saved script v${body.version.version}.`);
    router.refresh();
  }

  async function breakdown() {
    if (!versionId) return setMessage("Save the script first.");
    setMessage(undefined);
    const response = await fetch(`/api/v1/scripts/${versionId}/breakdown`, { method: "POST" });
    const body = (await response.json()) as { job?: { id: string; status: string }; error?: string };
    if (!response.ok || !body.job) return setMessage(body.error ?? "Could not queue breakdown.");
    setJobId(body.job.id);
    setJobStatus(body.job.status);
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <form onSubmit={save} className="mt-8">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <input name="title" defaultValue={initialTitle} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
        <input name="targetDurationSec" type="number" min={30} max={14400} defaultValue={initialVersion?.targetDurationSec ?? ""} placeholder="Target seconds" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3" />
      </div>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} required rows={26} placeholder="Paste or write the full documentary narration here..." className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-4 font-mono text-sm leading-6 outline-none focus:border-violet-400/50" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/35">
        <span>{wordCount.toLocaleString()} words</span>
        <label className="flex items-center gap-2"><input name="locked" type="checkbox" defaultChecked={initialVersion?.locked ?? false} /> lock saved version</label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={saving} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">{saving ? "Saving…" : "Save new version"}</button>
        <button type="button" onClick={breakdown} disabled={!versionId || Boolean(jobId && !["SUCCEEDED","FAILED","CANCELLED"].includes(jobStatus ?? ""))} className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">Create scene breakdown</button>
        {jobStatus && <span className="text-xs text-violet-200">Job: {jobStatus}</span>}
        {message && <span className="text-sm text-white/55">{message}</span>}
      </div>
    </form>
  );
}
