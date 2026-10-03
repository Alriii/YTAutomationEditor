import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function r2Client() {
  const accountId = required("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export function r2Bucket(): string {
  return required("R2_BUCKET");
}

export async function signR2Get(storageKey: string, expiresIn = 900) {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({ Bucket: r2Bucket(), Key: storageKey }),
    { expiresIn },
  );
}

export async function signR2Put(input: {
  storageKey: string;
  contentType: string;
  expiresIn?: number;
}) {
  return getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.storageKey,
      ContentType: input.contentType,
    }),
    { expiresIn: input.expiresIn ?? 600 },
  );
}

export async function putR2Object(input: {
  storageKey: string;
  bytes: Uint8Array | Buffer;
  contentType: string;
}) {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.storageKey,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );
}
