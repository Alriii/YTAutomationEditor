import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <nav className="flex items-center justify-between">
        <div className="text-sm font-semibold tracking-[0.22em]">CONTINUITY STUDIO</div>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <Link className="rounded-full border border-white/15 px-4 py-2 text-sm" href="/sign-in">Sign in</Link>
            <Link className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black" href="/sign-up">Start creating</Link>
          </Show>
          <Show when="signed-in">
            <Link className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black" href="/app">Open studio</Link>
            <UserButton />
          </Show>
        </div>
      </nav>
      <section className="grid flex-1 items-center gap-14 py-24 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-medium text-violet-200">Continuity over prompt roulette</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] tracking-tight sm:text-7xl">Build 80 scenes that still feel like the same film.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">Lock your style, characters, locations and historical rules once. Continuity Studio compiles those constraints into every approved scene before generation.</p>
          <div className="mt-9 flex gap-3">
            <Link className="rounded-xl bg-violet-400 px-5 py-3 font-semibold text-slate-950" href="/sign-up">Create a project</Link>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
          {[
            ["01","Script","Versioned source of truth"],
            ["02","Scene review","Human approval gate"],
            ["03","Continuity compile","Locked style + cast + world"],
            ["04","Cost estimate","No surprise generation spend"],
            ["05","Storyboard","Per-scene history and locks"]
          ].map(([n,title,text]) => (
            <div key={n} className="flex gap-4 border-b border-white/10 py-4 last:border-0">
              <div className="font-mono text-xs text-violet-300">{n}</div>
              <div><div className="font-medium">{title}</div><div className="mt-1 text-sm text-white/45">{text}</div></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
