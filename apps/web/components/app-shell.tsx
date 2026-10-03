import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import { ProjectStageNav } from "./project-stage-nav";

export function AppShell({
  projectId,
  projectTitle,
  children,
}: {
  projectId?: string;
  projectTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[270px_1fr]">
      <aside className="border-r border-white/10 bg-[#090d14] p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-white/10 px-2 pb-5">
          <div className="min-w-0">
            <Link
              href="/app"
              className="text-[11px] font-bold tracking-[0.22em] text-white/90"
            >
              CONTINUITY
            </Link>
            {projectTitle && (
              <div
                className="mt-2 truncate text-xs text-white/35"
                title={projectTitle}
              >
                {projectTitle}
              </div>
            )}
          </div>
          <UserButton />
        </div>

        {projectId ? (
          <ProjectStageNav projectId={projectId} />
        ) : (
          <Link
            href="/app"
            className="block rounded-xl bg-white/[.06] px-3 py-2.5 text-sm"
          >
            Projects
          </Link>
        )}

        <div className="mt-7 border-t border-white/10 pt-4">
          <Link
            href="/app/settings/providers"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/35 hover:bg-white/[.04] hover:text-white/70"
          >
            <Settings size={15} />
            Providers
          </Link>
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
