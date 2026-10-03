import { db } from "@continuity/db";
import { fitDurationsToTotal, toSrt } from "@continuity/shared";
import { requireOwnedProject } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { signR2Get, signR2Put } from "@/lib/storage/r2";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { user, project } = await requireOwnedProject(projectId);

    const [scenes, voiceTrack, cues, subtitleTrack] = await Promise.all([
      db.scene.findMany({
        where: { projectId },
        orderBy: { sceneNumber: "asc" },
        include: {
          selectedAsset: {
            select: { storageKey: true, mimeType: true },
          },
        },
      }),
      db.projectTrack.findUnique({
        where: {
          projectId_type: { projectId, type: "VOICEOVER" },
        },
        include: { asset: true },
      }),
      db.subtitleCue.findMany({
        where: { projectId },
        orderBy: [{ startMs: "asc" }, { order: "asc" }],
      }),
      db.projectTrack.findUnique({
        where: {
          projectId_type: { projectId, type: "SUBTITLES" },
        },
        select: { settings: true },
      }),
    ]);

    if (!scenes.length) {
      return Response.json({ error: "No scenes to render." }, { status: 400 });
    }
    if (scenes.some((scene) => !scene.selectedAsset)) {
      return Response.json(
        { error: "Every scene needs a selected image before MP4 rendering." },
        { status: 409 },
      );
    }

    const fittedDurations = fitDurationsToTotal(
      scenes.map((scene) => scene.durationHintMs ?? 4500),
      voiceTrack?.asset?.durationMs ?? null,
      500,
    );

    const exportRecord = await db.export.create({
      data: {
        projectId,
        type: "VIDEO_MP4",
        status: "RUNNING",
      },
    });

    const storageKey =
      `users/${user.id}/projects/${projectId}/exports/${exportRecord.id}.mp4`;

    await db.export.update({
      where: { id: exportRecord.id },
      data: { storageKey },
    });

    const preparedScenes = await Promise.all(
      scenes.map(async (scene, index) => ({
        sceneNumber: scene.sceneNumber,
        durationMs:
          fittedDurations[index] ?? scene.durationHintMs ?? 4500,
        imageUrl: await signR2Get(scene.selectedAsset!.storageKey, 7200),
        mediaSettings: scene.mediaSettings,
      })),
    );

    return Response.json(
      {
        export: {
          id: exportRecord.id,
          status: "RUNNING",
        },
        plan: {
          projectId,
          projectTitle: project.title,
          aspectRatio: project.aspectRatio,
          scenes: preparedScenes,
          voiceoverUrl: voiceTrack?.asset
            ? await signR2Get(voiceTrack.asset.storageKey, 7200)
            : null,
          voiceoverMimeType: voiceTrack?.asset?.mimeType ?? null,
          subtitlesSrt: cues.length
            ? toSrt(
                cues.map((cue) => ({
                  order: cue.order,
                  startMs: cue.startMs,
                  endMs: cue.endMs,
                  text: cue.text,
                })),
              )
            : null,
          subtitleSettings: subtitleTrack?.settings ?? null,
          uploadUrl: await signR2Put({
            storageKey,
            contentType: "video/mp4",
            expiresIn: 7200,
          }),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
