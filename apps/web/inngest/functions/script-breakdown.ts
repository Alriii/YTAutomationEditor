import { breakDownScriptWithGemini } from "@continuity/ai";
import { db } from "@continuity/db";
import { inngest } from "../client";
import { getProviderApiKey } from "@/lib/providers/credentials";

export const scriptBreakdownFunction = inngest.createFunction(
  {
    id: "script-breakdown",
    triggers: [{ event: "continuity/script.breakdown.requested" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const jobId = String(event.data.jobId);

    const snapshot = await step.run("load-breakdown-input", async () => {
      const job = await db.generationJob.findUnique({
        where: { id: jobId },
        include: {
          project: {
            include: {
              characters: {
                include: { versions: { orderBy: { version: "desc" }, take: 1 } },
              },
              locations: {
                include: { versions: { orderBy: { version: "desc" }, take: 1 } },
              },
            },
          },
        },
      });
      if (!job) throw new Error("Generation job not found.");

      const input = job.inputSnapshot as { scriptVersionId?: string };
      if (!input.scriptVersionId) throw new Error("Missing scriptVersionId.");

      const scriptVersion = await db.scriptVersion.findFirst({
        where: {
          id: input.scriptVersionId,
          script: { projectId: job.projectId },
        },
      });
      if (!scriptVersion) throw new Error("Script version not found.");

      const blockingScenes = await db.scene.count({
        where: {
          projectId: job.projectId,
          OR: [
            { status: { notIn: ["DRAFT", "REVIEW"] } },
            { assets: { some: {} } },
          ],
        },
      });

      if (blockingScenes > 0) {
        throw new Error(
          "Existing approved or generated scenes must not be replaced by breakdown.",
        );
      }

      await db.generationJob.update({
        where: { id: job.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          attemptCount: { increment: 1 },
          progress: 10,
        },
      });

      const targetDurationSec =
        scriptVersion.targetDurationSec ?? job.project.targetDurationSec;

      return {
        userId: job.userId,
        projectId: job.projectId,
        projectTitle: job.project.title,
        aspectRatio: job.project.aspectRatio,
        model: job.model,
        script: scriptVersion.content,
        scriptVersionId: scriptVersion.id,
        ...(targetDurationSec !== null ? { targetDurationSec } : {}),
        characters: job.project.characters.map((character) => ({
          id: character.id,
          name: character.name,
          description: character.versions[0]?.description ?? "",
        })),
        locations: job.project.locations.map((location) => {
          const era = location.versions[0]?.era;
          return {
            id: location.id,
            name: location.name,
            description: location.versions[0]?.description ?? "",
            ...(era ? { era } : {}),
          };
        }),
      };
    });

    const breakdown = await step.run("generate-breakdown", async () => {
      const apiKey = await getProviderApiKey(snapshot.userId, "google");

      return breakDownScriptWithOpenAI({
        apiKey,
        model: snapshot.model,
        projectTitle: snapshot.projectTitle,
        script: snapshot.script,
        aspectRatio: snapshot.aspectRatio,
        characters: snapshot.characters,
        locations: snapshot.locations,
        ...(snapshot.targetDurationSec !== undefined
          ? { targetDurationSec: snapshot.targetDurationSec }
          : {}),
      });
    });

    const created = await step.run("persist-review-scenes", async () => {
      const characterMap = new Map(
        (
          await db.character.findMany({
            where: { projectId: snapshot.projectId },
            include: { versions: { orderBy: { version: "desc" }, take: 1 } },
          })
        ).map((character) => [character.id, character]),
      );

      const locationMap = new Map(
        (
          await db.location.findMany({
            where: { projectId: snapshot.projectId },
            include: { versions: { orderBy: { version: "desc" }, take: 1 } },
          })
        ).map((location) => [location.id, location]),
      );

      return db.$transaction(async (tx) => {
        await tx.scene.deleteMany({
          where: {
            projectId: snapshot.projectId,
            status: { in: ["DRAFT", "REVIEW"] },
          },
        });

        for (const [index, source] of breakdown.scenes.entries()) {
          const location = source.locationId
            ? locationMap.get(source.locationId)
            : undefined;

          const characters = source.characterIds
            .map((id) => characterMap.get(id))
            .filter(
              (value): value is NonNullable<typeof value> =>
                Boolean(value?.versions[0]),
            );

          await tx.scene.create({
            data: {
              projectId: snapshot.projectId,
              scriptVersionId: snapshot.scriptVersionId,
              sceneNumber: index + 1,
              title: source.title || null,
              narration: source.narration,
              visualIntent: source.visualIntent,
              action: source.action || null,
              shotType: source.shotType || null,
              camera: source.camera || null,
              lighting: source.lighting || null,
              durationHintMs: source.durationHintMs,
              continuityNotes: source.continuityNotes,
              status: "REVIEW",
              ...(location?.versions[0]
                ? {
                    locationId: location.id,
                    locationVersionId: location.versions[0].id,
                  }
                : {}),
              characters: {
                create: characters.map((character) => ({
                  characterId: character.id,
                  characterVersionId: character.versions[0]!.id,
                  required: true,
                })),
              },
            },
          });
        }

        await tx.project.update({
          where: { id: snapshot.projectId },
          data: { workflowState: "SCENE_REVIEW" },
        });

        await tx.generationJob.update({
          where: { id: jobId },
          data: {
            status: "SUCCEEDED",
            progress: 100,
            completedAt: new Date(),
            ...(breakdown.usage?.inputTokens !== undefined
              ? { inputTokens: breakdown.usage.inputTokens }
              : {}),
            ...(breakdown.usage?.outputTokens !== undefined
              ? { outputTokens: breakdown.usage.outputTokens }
              : {}),
          },
        });

        return breakdown.scenes.length;
      });
    });

    return { scenesCreated: created };
  },
);
