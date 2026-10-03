import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { signR2Put } from "@/lib/storage/r2";

const schema = z.object({
  projectId: z.string().uuid(),
  role: z.enum(["STYLE_REFERENCE", "CHARACTER_REFERENCE", "LOCATION_REFERENCE"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  styleBibleVersionId: z.string().uuid().optional(),
  characterVersionId: z.string().uuid().optional(),
  locationVersionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const input = schema.parse(await request.json());

    const project = await db.project.findFirst({
      where: { id: input.projectId, ownerId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new Error("NOT_FOUND");

    const targetCount = [
      input.styleBibleVersionId,
      input.characterVersionId,
      input.locationVersionId,
    ].filter(Boolean).length;
    if (targetCount !== 1) {
      return Response.json({ error: "Exactly one reference target is required." }, { status: 400 });
    }

    if (input.styleBibleVersionId) {
      const target = await db.styleBibleVersion.findFirst({
        where: { id: input.styleBibleVersionId, projectId: input.projectId },
        select: { id: true },
      });
      if (!target || input.role !== "STYLE_REFERENCE") throw new Error("NOT_FOUND");
    }

    if (input.characterVersionId) {
      const target = await db.characterVersion.findFirst({
        where: {
          id: input.characterVersionId,
          character: { projectId: input.projectId },
        },
        select: { id: true },
      });
      if (!target || input.role !== "CHARACTER_REFERENCE") throw new Error("NOT_FOUND");
    }

    if (input.locationVersionId) {
      const target = await db.locationVersion.findFirst({
        where: {
          id: input.locationVersionId,
          location: { projectId: input.projectId },
        },
        select: { id: true },
      });
      if (!target || input.role !== "LOCATION_REFERENCE") throw new Error("NOT_FOUND");
    }

    const extension =
      input.mimeType === "image/png"
        ? "png"
        : input.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const storageKey = `users/${user.id}/projects/${input.projectId}/references/${randomUUID()}.${extension}`;

    const asset = await db.asset.create({
      data: {
        projectId: input.projectId,
        type: "IMAGE",
        role: input.role,
        storageKey,
        mimeType: input.mimeType,
        fileSizeBytes: BigInt(input.fileSizeBytes),
        sha256: input.sha256.toLowerCase(),
        styleBibleVersionId: input.styleBibleVersionId,
        characterVersionId: input.characterVersionId,
        locationVersionId: input.locationVersionId,
      },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        role: true,
        sha256: true,
      },
    });

    const uploadUrl = await signR2Put({
      storageKey,
      contentType: input.mimeType,
    });

    return Response.json({ asset, uploadUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
