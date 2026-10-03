import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { ScriptEditor } from "./script-editor";

export default async function ScriptPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);
  const script = await db.script.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">Source</div>
      <h1 className="mt-2 text-3xl font-semibold">Script</h1>
      <p className="mt-2 text-sm text-white/45">Save a version, then request a visual breakdown. Breakdown creates review scenes only and never starts image generation.</p>
      <ScriptEditor projectId={projectId} initialTitle={script?.title ?? "Primary script"} initialVersion={script?.versions[0] ?? null} />
    </div>
  );
}
