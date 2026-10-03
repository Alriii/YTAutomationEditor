import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/lib/auth";
import { db } from "@continuity/db";
import { ProviderSettings } from "./provider-settings";

export default async function ProviderSettingsPage() {
  const user = await requireAppUser();
  const credentials = await db.providerCredential.findMany({
    where: { userId: user.id },
    select: { provider: true, keyHint: true, status: true, lastValidatedAt: true },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="text-xs uppercase tracking-[.18em] text-violet-300">Settings</div>
        <h1 className="mt-2 text-3xl font-semibold">AI providers</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/45">Bring your own OpenAI or fal.ai key. Keys are encrypted server-side and are never returned to the browser after saving.</p>
        <ProviderSettings initial={credentials.map(c => ({ ...c, lastValidatedAt: c.lastValidatedAt?.toISOString() ?? null }))} />
      </div>
    </AppShell>
  );
}
