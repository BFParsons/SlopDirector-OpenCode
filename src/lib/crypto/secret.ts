import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requireEnv } from "@/env";

// AES-256-GCM at-rest encryption for user secrets (OpenRouter keys), keyed by a
// sha256 of AUTH_SECRET. Format: base64(iv).base64(tag).base64(ciphertext).
// Keeps bearer secrets out of plaintext in the DB / dumps.

function aesKey(): Buffer {
  return createHash("sha256").update(requireEnv("AUTH_SECRET")).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(blob: string): string {
  const [ivB, tagB, ctB] = blob.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** A non-secret display hint, e.g. "sk-or-v1…cd34". */
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 12) return "…" + k.slice(-4);
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}
