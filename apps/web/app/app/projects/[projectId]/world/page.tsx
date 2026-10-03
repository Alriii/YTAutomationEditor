import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { ReferenceUploader } from "@/components/reference-uploader";
import { LocationCreator } from "./location-creator";

export default async function WorldPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);
  const locations = await db.location.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          assets: {
            where: { role: "LOCATION_REFERENCE" },
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
          <h1 className="mt-2 text-3xl font-semibold">World</h1>
          <p className="mt-2 text-sm text-white/45">Locations carry era, technology and environment constraints into every linked scene.</p>
        </div>
        <LocationCreator projectId={projectId} />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {locations.map((location) => {
          const version = location.versions[0];
          return (
            <article key={location.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <div className="flex justify-between gap-4"><h2 className="font-medium">{location.name}</h2>{location.locked && <span className="text-[10px] text-emerald-300">LOCKED</span>}</div>
              <div className="mt-1 text-xs text-white/35">{version?.era || "Era not set"} · v{version?.version ?? 0}</div>
              <p className="mt-4 text-sm leading-6 text-white/50">{version?.description}</p>
              {version && (
                <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
                  <ReferenceUploader
                    projectId={projectId}
                    role="LOCATION_REFERENCE"
                    target={{ locationVersionId: version.id }}
                  />
                  <span className="text-[10px] text-white/30">{version.assets.length} refs</span>
                </div>
              )}
            </article>
          );
        })}
        {locations.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/40">No locations yet.</div>}
      </div>
    </div>
  );
}
