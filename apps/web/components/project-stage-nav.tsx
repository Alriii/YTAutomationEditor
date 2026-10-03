"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Users,
} from "lucide-react";

const groups = [
  {
    label: "Prepare",
    items: [
      ["Overview", LayoutDashboard, ""],
      ["Script", BookOpen, "script"],
      ["Style / Master Ref", Palette, "style"],
      ["Cast", Users, "cast"],
      ["World", Map, "world"],
      ["Voiceover", Mic2, "voice"],
    ],
  },
  {
    label: "Produce",
    items: [
      ["Scene Review", Clapperboard, "scenes"],
      ["Storyboard", Film, "storyboard"],
      ["Flow Generation", Film, "flow"],
    ],
  },
  {
    label: "Finish",
    items: [
      ["Captions", Captions, "captions"],
      ["Review", PlaySquare, "review"],
      ["Export", Film, "export"],
    ],
  },
] as const;

export function ProjectStageNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  let stageNumber = 0;

  return (
    <nav className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[.2em] text-white/25">
            {group.label}
          </div>

          <div className="space-y-1">
            {group.items.map(([label, Icon, slug]) => {
              stageNumber += 1;
              const href = slug
                ? `/app/projects/${projectId}/${slug}`
                : `/app/projects/${projectId}`;
              const active =
                slug === ""
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={label}
                  href={href}
                  className={
                    "group flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-sm transition " +
                    (active
                      ? "border-violet-300/20 bg-violet-300/[.09] text-white"
                      : "border-transparent text-white/45 hover:bg-white/[.05] hover:text-white/80")
                  }
                >
                  <span
                    className={
                      "grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[9px] " +
                      (active
                        ? "bg-violet-300 text-slate-950"
                        : "bg-white/[.05] text-white/25 group-hover:text-white/50")
                    }
                  >
                    {String(stageNumber).padStart(2, "0")}
                  </span>
                  <Icon
                    size={14}
                    className={active ? "text-violet-200" : "text-white/30"}
                  />
                  <span className="min-w-0 truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
