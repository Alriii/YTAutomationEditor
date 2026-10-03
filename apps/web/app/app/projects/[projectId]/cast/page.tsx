import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { ReferenceUploader } from "@/components/reference-uploader";
import { CharacterCreator } from "./character-creator";

export default async function CastPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);
  const characters = await db.character.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          assets: {
            where: { role: "CHARACTER_REFERENCE" },
            select: { id: true },
          },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="text-xs uppercase tracking-[.18em] text-violet-300">Continuity input</div>
          <h1 className="mt-2 text-3xl font-semibold">Cast</h1>
          <p className="mt-2 text-sm text-white/45">Create stable identities. Later edits create new versions instead of rewriting history.</p>
        </div>
        <CharacterCreator projectId={projectId} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {characters.map((character) => {
          const version = character.versions[0];
          return (
            <article key={character.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="font-medium">{character.name}</h2><div className="mt-1 text-xs text-white/35">{character.role || "Character"} · v{version?.version ?? 0}</div></div>
                {character.locked && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">LOCKED</span>}
              </div>
              <p className="mt-4 text-sm leading-6 text-white/50">{version?.description}</p>
              {version?.wardrobeRules && <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/35">Wardrobe: {version.wardrobeRules}</div>}
              {version && (
                <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
                  <ReferenceUploader
                    projectId={projectId}
                    role="CHARACTER_REFERENCE"
                    target={{ characterVersionId: version.id }}
                  />
                  <span className="text-[10px] text-white/30">{version.assets.length} refs</span>
                </div>
              )}
            </article>
          );
        })}
        {characters.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/40">No locked characters yet.</div>}
      </div>
    </div>
  );
}
