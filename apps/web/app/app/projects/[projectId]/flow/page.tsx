import { requireOwnedProject } from "@/lib/auth";
import { FlowGeneration, type FlowModel } from "./flow-generation";

const FLOW_MODELS: FlowModel[] = [
  "Nano Banana 2 Lite",
  "Nano Banana 2",
  "Nano Banana Pro",
];

export default async function FlowPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await requireOwnedProject(projectId);

  const initialModel: FlowModel = FLOW_MODELS.includes(
    project.defaultImageModel as FlowModel,
  )
    ? (project.defaultImageModel as FlowModel)
    : "Nano Banana 2 Lite";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">
        Generation stage
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Google Flow Generation</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Generate approved storyboard scenes through your own signed-in Flow browser session. Continuity Studio sends the compiled prompt and references, then brings the finished image back into the matching scene.
      </p>
      <FlowGeneration projectId={projectId} initialModel={initialModel} />
    </div>
  );
}
