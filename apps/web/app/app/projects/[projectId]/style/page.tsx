import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { ReferenceUploader } from "@/components/reference-uploader";
import { StyleEditor } from "./style-editor";

export default async function StylePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);

  const style = await db.styleBibleVersion.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    include: {
      assets: {
        where: { role: "STYLE_REFERENCE" },
        select: { id: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Continuity input
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Style & Master Reference</h1>
      <p className="mt-2 text-sm text-white/45">
        Define the visual rules, then upload your own master reference images. Every save creates a version so old generations remain reproducible.
      </p>

      {style && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4">
          <ReferenceUploader
            projectId={projectId}
            role="STYLE_REFERENCE"
            target={{ styleBibleVersionId: style.id }}
          />
          <span className="text-xs text-white/35">
            {style.assets.length} master reference image
            {style.assets.length === 1 ? "" : "s"} attached to v{style.version}
          </span>
        </div>
      )}

      <StyleEditor projectId={projectId} initial={style} />
    </div>
  );
}
