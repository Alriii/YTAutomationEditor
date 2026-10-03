import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { db } from "@continuity/db";
import { requireAppUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { r2Bucket, r2Client } from "@/lib/storage/r2";

async function reachableInngest(): Promise<boolean> {
  const base = process.env.INNGEST_DEV;
  if (!base) return false;

  try {
    const response = await fetch(new URL("/health", base), {
      cache: "no-store",
      signal: AbortSignal.timeout(1800),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    await requireAppUser();

    const database = await db
      .$queryRawUnsafe("SELECT 1")
      .then(() => true)
      .catch(() => false);

    const storage = await r2Client()
      .send(new HeadBucketCommand({ Bucket: r2Bucket() }))
      .then(() => true)
      .catch(() => false);

    const inngest = await reachableInngest();

    return Response.json({
      localMode: process.env.LOCAL_MODE === "true",
      services: {
        database,
        storage,
        inngest,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
