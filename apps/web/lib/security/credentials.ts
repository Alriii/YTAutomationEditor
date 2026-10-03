import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY_BASE64;
  if (!raw) throw new Error("ENCRYPTION_KEY_BASE64 is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.");
  return key;
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, ivRaw, tagRaw, cipherRaw] = payload.split(":");
  if (version !== VERSION || !ivRaw || !tagRaw || !cipherRaw) throw new Error("Unsupported encrypted credential payload.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function secretHint(secret: string): string {
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 3)}••••${secret.slice(-4)}`;
}
