import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/lib/auth";
import { db } from "@continuity/db";
import { NewProjectForm } from "./projects/new-project-form";

export default async function ProjectsPage() {
  const user = await requireAppUser();
  const projects = await db.project.findMany({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { _count: { select: { scenes: true, assets: true } } },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs uppercase tracking-[.18em] text-violet-300">Workspace</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-2 text-sm text-white/45">Each project owns its continuity bible, cast, world and generation history.</p>
          </div>
          <NewProjectForm />
        </header>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/app/projects/${project.id}`} className="group rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:border-violet-300/30 hover:bg-white/[.055]">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-medium">{project.title}</h2>
                <span className="text-[10px] uppercase tracking-wider text-white/35">{project.workflowState.replaceAll("_", " ")}</span>
              </div>
              <p className="mt-3 min-h-10 text-sm text-white/40">{project.description || "No description yet."}</p>
              <div className="mt-7 flex gap-4 border-t border-white/10 pt-4 text-xs text-white/35">
                <span>{project._count.scenes} scenes</span>
                <span>{project._count.assets} assets</span>
              </div>
            </Link>
          ))}
          {projects.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/40">Create your first project.</div>}
        </div>
      </div>
    </AppShell>
  );
}
