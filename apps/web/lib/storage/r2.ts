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

function storageClient() {
  const endpoint = process.env.S3_ENDPOINT;

  if (endpoint) {
    return new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: required("S3_ACCESS_KEY_ID"),
        secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      },
    });
  }

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

export function r2Client() {
  return storageClient();
}

export function r2Bucket(): string {
  return process.env.S3_BUCKET || required("R2_BUCKET");
}

export async function signR2Get(storageKey: string, expiresIn = 900) {
  return getSignedUrl(
    storageClient(),
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
    storageClient(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.storageKey,
      ContentType: input.contentType,
    }),
    { expiresIn: input.expiresIn ?? 600 },
  );
}

export async function getR2Object(storageKey: string): Promise<Buffer> {
  const result = await storageClient().send(
    new GetObjectCommand({ Bucket: r2Bucket(), Key: storageKey }),
  );
  if (!result.Body) {
    throw new Error(`Storage object has no body: ${storageKey}`);
  }

  return Buffer.from(await result.Body.transformToByteArray());
}

export async function putR2Object(input: {
  storageKey: string;
  bytes: Uint8Array | Buffer;
  contentType: string;
}) {
  await storageClient().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.storageKey,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );
}
