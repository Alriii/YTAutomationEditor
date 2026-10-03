import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@continuity/db";
import { fitDurationsToTotal } from "@continuity/shared";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { signR2Put } from "@/lib/storage/r2";

const flowModelSchema = z.enum([
  "Nano Banana 2 Lite",
  "Nano Banana 2",
  "Nano Banana Pro",
]);

const voiceoverSchema = z.object({
  kind: z.literal("voiceover"),
  projectId: z.string().uuid(),
  mimeType: z.enum([
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
  ]),
  fileSizeBytes: z.number().int().positive().max(500 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000).optional(),
});

const sceneImageSchema = z
  .object({
    kind: z.literal("scene-image"),
    projectId: z.string().uuid(),
    sceneId: z.string().uuid(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    fileSizeBytes: z.number().int().positive().max(30 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    source: z.enum(["manual", "flow"]).default("manual"),
    model: flowModelSchema.optional(),
    sourcePrompt: z.string().min(1).max(50_000).optional(),
    continuityFingerprint: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  })
  .superRefine((value, context) => {
    if (value.source !== "flow") return;

    if (!value.model) {
      context.addIssue({
        code: "custom",
        path: ["model"],
        message: "Flow model is required for Flow renders.",
      });
    }
    if (!value.sourcePrompt) {
      context.addIssue({
        code: "custom",
        path: ["sourcePrompt"],
        message: "Compiled prompt is required for Flow renders.",
      });
    }
    if (!value.continuityFingerprint) {
      context.addIssue({
        code: "custom",
        path: ["continuityFingerprint"],
        message: "Continuity fingerprint is required for Flow renders.",
      });
    }
  });

const schema = z.union([voiceoverSchema, sceneImageSchema]);

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return "wav";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const input = schema.parse(await request.json());

    const project = await db.project.findFirst({
      where: { id: input.projectId, ownerId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new Error("NOT_FOUND");

    if (input.kind === "scene-image") {
      const scene = await db.scene.findFirst({
        where: { id: input.sceneId, projectId: input.projectId },
        select: { id: true, sceneNumber: true },
      });
      if (!scene) throw new Error("NOT_FOUND");

      const extension = extensionFor(input.mimeType);
      const sourcePrefix = input.source === "flow" ? "flow" : "manual";
      const storageKey =
        `users/${user.id}/projects/${input.projectId}/scenes/` +
        `${String(scene.sceneNumber).padStart(3, "0")}/${sourcePrefix}-${randomUUID()}.${extension}`;

      let provenance:
        | {
            provider: "flow.google.com";
            model: "Nano Banana 2 Lite" | "Nano Banana 2" | "Nano Banana Pro";
            sourcePrompt: string;
            continuityFingerprint: string;
          }
        | {
            provider: "manual";
            model: "uploaded";
            sourcePrompt: null;
            continuityFingerprint: null;
          };

      if (input.source === "flow") {
        if (
          !input.model ||
          !input.sourcePrompt ||
          !input.continuityFingerprint
        ) {
          return Response.json(
            { error: "Flow render provenance is incomplete." },
            { status: 400 },
          );
        }

        provenance = {
          provider: "flow.google.com",
          model: input.model,
          sourcePrompt: input.sourcePrompt,
          continuityFingerprint: input.continuityFingerprint,
        };
      } else {
        provenance = {
          provider: "manual",
          model: "uploaded",
          sourcePrompt: null,
          continuityFingerprint: null,
        };
      }

      const asset = await db.asset.create({
        data: {
          projectId: input.projectId,
          sceneId: scene.id,
          type: "IMAGE",
          role: "SCENE_RENDER",
          ...provenance,
          storageKey,
          mimeType: input.mimeType,
          fileSizeBytes: BigInt(input.fileSizeBytes),
          sha256: input.sha256.toLowerCase(),
        },
        select: { id: true, storageKey: true, mimeType: true },
      });

      return Response.json({
        asset,
        uploadUrl: await signR2Put({
          storageKey,
          contentType: input.mimeType,
        }),
      }, { status: 201 });
    }

    const extension = extensionFor(input.mimeType);
    const storageKey =
      `users/${user.id}/projects/${input.projectId}/audio/voiceover-${randomUUID()}.${extension}`;

    const asset = await db.asset.create({
      data: {
        projectId: input.projectId,
        type: "AUDIO",
        role: "VOICEOVER",
        provider: "manual",
        model: "uploaded",
        storageKey,
        mimeType: input.mimeType,
        fileSizeBytes: BigInt(input.fileSizeBytes),
        sha256: input.sha256.toLowerCase(),
        durationMs: input.durationMs ?? null,
      },
      select: { id: true, storageKey: true, mimeType: true },
    });

    const scenes = await db.scene.findMany({
      where: { projectId: input.projectId },
      orderBy: { sceneNumber: "asc" },
      select: { id: true, durationHintMs: true },
    });
    const fittedDurations =
      input.durationMs !== undefined
        ? fitDurationsToTotal(
            scenes.map((scene) => scene.durationHintMs ?? 4500),
            input.durationMs,
            500,
          )
        : [];

    await db.$transaction(async (tx) => {
      await tx.projectTrack.upsert({
        where: {
          projectId_type: {
            projectId: input.projectId,
            type: "VOICEOVER",
          },
        },
        update: {
          assetId: asset.id,
          settings: {
            source: "uploaded",
            ...(input.durationMs !== undefined
              ? { durationMs: input.durationMs }
              : {}),
          },
        },
        create: {
          projectId: input.projectId,
          type: "VOICEOVER",
          assetId: asset.id,
          settings: {
            source: "uploaded",
            ...(input.durationMs !== undefined
              ? { durationMs: input.durationMs }
              : {}),
          },
        },
      });

      if (input.durationMs !== undefined) {
        await tx.project.update({
          where: { id: input.projectId },
          data: {
            targetDurationSec: Math.max(1, Math.round(input.durationMs / 1000)),
          },
        });

        for (const [index, scene] of scenes.entries()) {
          await tx.scene.update({
            where: { id: scene.id },
            data: { durationHintMs: fittedDurations[index]! },
          });
        }
      }
    });

    return Response.json({
      asset,
      uploadUrl: await signR2Put({
        storageKey,
        contentType: input.mimeType,
      }),
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
