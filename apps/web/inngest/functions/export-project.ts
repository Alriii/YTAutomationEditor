import sharp from "sharp";
import { db } from "@continuity/db";
import { fitDurationsToTotal, toSrt } from "@continuity/shared";
import { inngest } from "../client";
import { createZip } from "@/lib/export/zip";
import { getR2Object, putR2Object } from "@/lib/storage/r2";

export const exportProjectFunction = inngest.createFunction(
  {
    id: "export-project",
    retries: 1,
    triggers: [{ event: "continuity/export.requested" }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event as { data?: { jobId?: string } } | undefined;
      const jobId = original?.data?.jobId;
      if (!jobId) return;
      const job = await db.generationJob.findUnique({
        where: { id: jobId },
        select: { id: true, inputSnapshot: true },
      });
      const input = job?.inputSnapshot as { exportId?: string } | undefined;
      await db.$transaction(async (tx) => {
        if (job) {
          await tx.generationJob.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              errorCode: "EXPORT_FAILED",
              errorMessage: error.message.slice(0, 4000),
              completedAt: new Date(),
            },
          });
        }
        if (input?.exportId) {
          await tx.export.updateMany({
            where: { id: input.exportId },
            data: { status: "FAILED", completedAt: new Date() },
          });
        }
      });
    },
  },
  async ({ event, step }) => {
    const jobId = String(event.data.jobId);

    const data = await step.run("load-export", async () => {
      const job = await db.generationJob.findUnique({
        where: { id: jobId },
        include: { project: true },
      });
      if (!job || job.type !== "EXPORT") throw new Error("Export job not found.");
      const input = job.inputSnapshot as { exportId?: string };
      if (!input.exportId) throw new Error("Export ID missing.");

      const exportRecord = await db.export.findUnique({ where: { id: input.exportId } });
      if (!exportRecord) throw new Error("Export record not found.");

      const [scenes, voiceTrack, subtitleCues, subtitleTrack] = await Promise.all([
        db.scene.findMany({
        where: { projectId: job.projectId },
        orderBy: { sceneNumber: "asc" },
        include: {
          selectedAsset: {
            select: { id: true, storageKey: true, mimeType: true },
          },
        },
        }),
        db.projectTrack.findUnique({
          where: {
            projectId_type: {
              projectId: job.projectId,
              type: "VOICEOVER",
            },
          },
          include: { asset: true },
        }),
        db.subtitleCue.findMany({
          where: { projectId: job.projectId },
          orderBy: [{ startMs: "asc" }, { order: "asc" }],
        }),
        db.projectTrack.findUnique({
          where: {
            projectId_type: {
              projectId: job.projectId,
              type: "SUBTITLES",
            },
          },
          select: { settings: true },
        }),
      ]);

      if (!scenes.length || scenes.some((scene) => !scene.selectedAsset)) {
        throw new Error("Every scene must have a selected asset.");
      }

      await db.$transaction([
        db.generationJob.update({
          where: { id: job.id },
          data: { status: "RUNNING", progress: 5, startedAt: new Date() },
        }),
        db.export.update({
          where: { id: exportRecord.id },
          data: { status: "RUNNING" },
        }),
      ]);

      return {
        jobId: job.id,
        userId: job.userId,
        projectId: job.projectId,
        projectTitle: job.project.title,
        aspectRatio: job.project.aspectRatio,
        exportId: exportRecord.id,
        voiceover: voiceTrack?.asset
          ? {
              storageKey: voiceTrack.asset.storageKey,
              mimeType: voiceTrack.asset.mimeType,
              durationMs: voiceTrack.asset.durationMs,
            }
          : null,
        subtitleSettings: subtitleTrack?.settings ?? null,
        subtitleCues: subtitleCues.map((cue) => ({
          order: cue.order,
          startMs: cue.startMs,
          endMs: cue.endMs,
          text: cue.text,
        })),
        scenes: scenes.map((scene) => ({
          number: scene.sceneNumber,
          narration: scene.narration,
          durationMs: scene.durationHintMs ?? 4500,
          locked: scene.locked,
          mediaSettings: scene.mediaSettings,
          storageKey: scene.selectedAsset!.storageKey,
        })),
      };
    });

    const built = await step.run("build-export-zip", async () => {
      let cursorMs = 0;
      const fittedDurations = fitDurationsToTotal(
        data.scenes.map((scene) => scene.durationMs),
        data.voiceover?.durationMs ?? null,
        500,
      );
      const files: Array<{ name: string; bytes: Buffer }> = [];
      const manifestScenes = [];

      for (const [sceneIndex, scene] of data.scenes.entries()) {
        const durationMs =
          fittedDurations[sceneIndex] ?? scene.durationMs;
        const source = await getR2Object(scene.storageKey);
        const jpeg = await sharp(source)
          .rotate()
          .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
          .toBuffer();
        const filename = `SCENE_${String(scene.number).padStart(3, "0")}.jpg`;
        files.push({ name: filename, bytes: jpeg });

        manifestScenes.push({
          number: scene.number,
          file: filename,
          startMs: cursorMs,
          durationMs,
          narration: scene.narration,
          locked: scene.locked,
          mediaSettings: scene.mediaSettings,
        });
        cursorMs += durationMs;
      }

      let voiceoverFile = null;
      if (data.voiceover) {
        const voiceBytes = await getR2Object(data.voiceover.storageKey);
        const extension =
          data.voiceover.mimeType === "audio/mpeg"
            ? "mp3"
            : data.voiceover.mimeType.includes("wav")
              ? "wav"
              : "m4a";
        voiceoverFile = `voiceover.${extension}`;
        files.push({ name: voiceoverFile, bytes: voiceBytes });
      }

      let subtitleFile = null;
      if (data.subtitleCues.length) {
        subtitleFile = "subtitles.srt";
        files.push({
          name: subtitleFile,
          bytes: Buffer.from(toSrt(data.subtitleCues), "utf8"),
        });
      }

      const manifest = {
        schemaVersion: 1,
        project: {
          id: data.projectId,
          title: data.projectTitle,
          aspectRatio: data.aspectRatio,
        },
        totalDurationMs: cursorMs,
        voiceoverFile,
        subtitleFile,
        subtitleSettings: data.subtitleSettings,
        scenes: manifestScenes,
      };

      files.push({
        name: "manifest.json",
        bytes: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      });

      const zip = await createZip(files);
      const storageKey =
        `users/${data.userId}/projects/${data.projectId}/exports/${data.exportId}.zip`;
      await putR2Object({
        storageKey,
        bytes: zip,
        contentType: "application/zip",
      });

      return { storageKey, manifest };
    });

    await step.run("complete-export", async () => {
      await db.$transaction([
        db.export.update({
          where: { id: data.exportId },
          data: {
            status: "SUCCEEDED",
            storageKey: built.storageKey,
            manifest: built.manifest,
            completedAt: new Date(),
          },
        }),
        db.generationJob.update({
          where: { id: data.jobId },
          data: {
            status: "SUCCEEDED",
            progress: 100,
            completedAt: new Date(),
          },
        }),
      ]);
    });

    return { exportId: data.exportId };
  },
);
