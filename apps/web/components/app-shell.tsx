import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  BookOpen,
  Captions,
  Clapperboard,
  Film,
  LayoutDashboard,
  Map,
  Mic2,
  Palette,
  PlaySquare,
  Settings,
  Users,
} from "lucide-react";

const nav = [
  ["Overview", LayoutDashboard, ""],
  ["Script", BookOpen, "script"],
  ["Style / Master Ref", Palette, "style"],
  ["Cast", Users, "cast"],
  ["World", Map, "world"],
  ["Voiceover", Mic2, "voice"],
  ["Scene Review", Clapperboard, "scenes"],
  ["Storyboard", Film, "storyboard"],
  ["Flow Generation", Film, "flow"],
  ["Captions", Captions, "captions"],
  ["Review", PlaySquare, "review"],
  ["Export", Film, "export"],
] as const;

export function AppShell({
  projectId,
  children,
}: {
  projectId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-r border-white/10 bg-black/20 p-5">
        <div className="mb-7 flex items-center justify-between">
          <Link href="/app" className="text-xs font-bold tracking-[0.2em]">
            CONTINUITY
          </Link>
          <UserButton />
        </div>

        <nav className="space-y-1">
          {projectId ? (
            nav.map(([label, Icon, slug]) => (
              <Link
                key={label}
                href={
                  slug
                    ? `/app/projects/${projectId}/${slug}`
                    : `/app/projects/${projectId}`
                }
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/[.06] hover:text-white"
              >
                <Icon size={16} />
                {label}
              </Link>
            ))
          ) : (
            <Link
              href="/app"
              className="flex items-center gap-3 rounded-lg bg-white/[.06] px-3 py-2.5 text-sm"
            >
              <LayoutDashboard size={16} />
              Projects
            </Link>
          )}
        </nav>

        <div className="mt-8 border-t border-white/10 pt-4">
          <Link
            href="/app/settings/providers"
            className="flex items-center gap-3 px-3 py-2 text-sm text-white/45 hover:text-white"
          >
            <Settings size={16} />
            Providers
          </Link>
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
