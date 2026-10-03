import { db } from "@continuity/db";
import { requireOwnedProject } from "@/lib/auth";
import { SceneReview } from "./scene-review";

export default async function ScenesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project } = await requireOwnedProject(projectId);

  const [scenes, characters, locations] = await Promise.all([
    db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      include: {
        characters: { select: { characterId: true } },
        location: { select: { id: true, name: true } },
      },
    }),
    db.character.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="text-xs uppercase tracking-[.18em] text-violet-300">Human gate</div>
      <h1 className="mt-2 text-3xl font-semibold">Scene review</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/45">
        Edit visual intent, cast, and location here. Image generation remains disabled until every scene is approved and a fresh cost estimate is accepted.
      </p>
      <SceneReview
        projectId={projectId}
        workflowState={project.workflowState}
        creditBalance={user.creditBalanceCached}
        scenes={scenes.map((scene) => ({
          id: scene.id,
          sceneNumber: scene.sceneNumber,
          title: scene.title ?? "",
          narration: scene.narration,
          visualIntent: scene.visualIntent,
          action: scene.action ?? "",
          shotType: scene.shotType ?? "",
          camera: scene.camera ?? "",
          lighting: scene.lighting ?? "",
          durationHintMs: scene.durationHintMs ?? 4500,
          continuityNotes: scene.continuityNotes,
          status: scene.status,
          characterIds: scene.characters.map((entry) => entry.characterId),
          locationId: scene.location?.id ?? null,
        }))}
        characters={characters}
        locations={locations}
      />
    </div>
  );
}
