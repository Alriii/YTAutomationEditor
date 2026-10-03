import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { StyleEditor } from "./style-editor";

export default async function StylePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);
  const style = await db.styleBibleVersion.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">Continuity input</div>
      <h1 className="mt-2 text-3xl font-semibold">Style Bible</h1>
      <p className="mt-2 text-sm text-white/45">Every save creates a new immutable version. Generations remember the exact version they used.</p>
      <StyleEditor projectId={projectId} initial={style} />
    </div>
  );
}
