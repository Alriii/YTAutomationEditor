import { requireOwnedProject } from "@/lib/auth";
import { FlowGeneration } from "./flow-generation";

export default async function FlowPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireOwnedProject(projectId);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Generation stage
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Google Flow Generation</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Generate approved storyboard scenes through your own signed-in Flow browser session. Continuity Studio sends the compiled prompt and references, then brings the finished image back into the matching scene.
      </p>
      <FlowGeneration projectId={projectId} />
    </div>
  );
}
