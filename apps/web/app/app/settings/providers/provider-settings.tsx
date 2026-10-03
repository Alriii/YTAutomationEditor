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
  const saved = initial.find((credential) => credential.provider === "google");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("google");
    setMessage(undefined);

    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/provider-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        apiKey: data.get("apiKey"),
      }),
    });

    const body = (await response.json()) as { error?: string };
    setBusy(undefined);

    if (!response.ok) {
      return setMessage(body.error ?? "Could not save Gemini API key.");
    }

    event.currentTarget.reset();
    setMessage("Google Gemini API key saved.");
    router.refresh();
  }

  async function validate() {
    setBusy("google");
    setMessage(undefined);

    const response = await fetch(
      "/api/v1/provider-credentials/google/validate",
      { method: "POST" },
    );
    const body = (await response.json()) as {
      valid?: boolean;
      error?: string;
    };

    setBusy(undefined);
    setMessage(
      body.valid
        ? "Gemini API key is valid."
        : body.error ?? "Gemini API key validation failed.",
    );
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Google Gemini</h2>
            <p className="mt-1 text-xs text-white/35">
              {saved
                ? `${saved.keyHint} · ${saved.status}`
                : "Add one Gemini API key for script breakdown and all Nano Banana image models."}
            </p>
          </div>

          {saved && (
            <button
              onClick={() => void validate()}
              disabled={busy === "google"}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs"
            >
              Validate
            </button>
          )}
        </div>

        <form onSubmit={save} className="mt-4 flex gap-2">
          <input
            type="password"
            autoComplete="off"
            name="apiKey"
            required
            placeholder={saved ? "Replace Gemini API key" : "Paste Gemini API key"}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm"
          />
          <button
            disabled={busy === "google"}
            className="rounded-xl bg-violet-400 px-4 text-sm font-semibold text-slate-950"
          >
            Save
          </button>
        </form>
      </section>

      {message && <p className="text-sm text-white/55">{message}</p>}
    </div>
  );
}
