import Link from "next/link";
import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user } = await requireOwnedProject(projectId);
  const project = await db.project.findFirstOrThrow({
    where: { id: projectId, ownerId: user.id, deletedAt: null },
    include: {
      styleBibleVersions: { orderBy: { version: "desc" }, take: 1 },
      characters: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
      locations: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
      scripts: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
      scenes: { select: { status: true } }
    }
  });

  const completed = project.scenes.filter((scene) => scene.status === "COMPLETE").length;
  const cards = [
    ["Style Bible", project.styleBibleVersions.length ? "Configured" : "Required", "style"],
    ["Characters", `${project.characters.length} defined`, "cast"],
    ["Locations", `${project.locations.length} defined`, "world"],
    ["Script", project.scripts.length ? "Draft ready" : "Required", "script"],
    ["Scenes", `${project.scenes.length} total · ${completed} rendered`, "scenes"]
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">Project</div>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{project.title}</h1>
      <p className="mt-3 max-w-3xl text-white/45">{project.description || "Add the style bible, cast and world before scene generation."}</p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.035] p-5">
        <div className="text-xs uppercase tracking-wider text-white/35">Mandatory pipeline</div>
        <div className="mt-3 text-sm text-white/70">Script → Scene Breakdown → <strong>Human Scene Review</strong> → Continuity Compile → Cost Estimate → Generation → Storyboard → Export</div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([title, status, slug]) => (
          <Link href={`/app/projects/${projectId}/${slug}`} key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 hover:border-violet-300/25">
            <div className="text-sm text-white/45">{title}</div>
            <div className="mt-3 text-lg font-medium">{status}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
