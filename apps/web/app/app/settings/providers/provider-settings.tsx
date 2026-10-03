"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Credential = {
  provider: string;
  keyHint: string;
  status: string;
  lastValidatedAt: string | null;
};

export function ProviderSettings({ initial }: { initial: Credential[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function save(provider: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(provider);
    setMessage(undefined);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/provider-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: data.get("apiKey") }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(undefined);
    if (!response.ok) return setMessage(body.error ?? "Could not save key.");
    event.currentTarget.reset();
    setMessage(`${provider} key saved.`);
    router.refresh();
  }

  async function validate(provider: string) {
    setBusy(provider);
    setMessage(undefined);
    const response = await fetch(`/api/v1/provider-credentials/${provider}/validate`, { method: "POST" });
    const body = (await response.json()) as { valid?: boolean; error?: string };
    setBusy(undefined);
    setMessage(body.valid ? `${provider} key is valid.` : body.error ?? `${provider} validation failed.`);
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      {["openai", "fal"].map((provider) => {
        const saved = initial.find(c => c.provider === provider);
        return (
          <section key={provider} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">{provider === "openai" ? "OpenAI" : "fal.ai"}</h2>
                <p className="mt-1 text-xs text-white/35">{saved ? `${saved.keyHint} · ${saved.status}` : "No BYOK key saved. Platform key may be used if configured."}</p>
              </div>
              {saved && <button onClick={() => validate(provider)} disabled={busy === provider} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Validate</button>}
            </div>
            <form onSubmit={(event) => save(provider, event)} className="mt-4 flex gap-2">
              <input type="password" autoComplete="off" name="apiKey" required placeholder={saved ? "Replace API key" : "Paste API key"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm" />
              <button disabled={busy === provider} className="rounded-xl bg-violet-400 px-4 text-sm font-semibold text-slate-950">Save</button>
            </form>
          </section>
        );
      })}
      {message && <p className="text-sm text-white/55">{message}</p>}
    </div>
  );
}
