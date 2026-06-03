/**
 * Image-provider seam entry point: pick the active provider, resolve its key,
 * and run a generation end-to-end (generate → download → save as an Asset).
 */
import { randomUUID } from "node:crypto";
import type { Asset } from "@prisma/client";
import { env } from "@/env";
import { saveAsset } from "@/lib/assets/storage";
import { keyForProject } from "@/lib/openrouter/userKey";
import { falProvider } from "./fal";
import { openrouterImageProvider } from "./openrouter";
import type { GenerateImageParams, ImageProvider } from "./provider";
import { falKeyForProject } from "./userKey";

export type { GenerateImageParams } from "./provider";

export type ImageProviderId = "fal" | "openrouter";

/** Resolve the image provider for a model (fal.ai or OpenRouter image output). */
export function getImageProvider(providerId: ImageProviderId = "fal"): ImageProvider {
  return providerId === "openrouter" ? openrouterImageProvider : falProvider;
}

/**
 * Resolve the API key for a provider: the project owner's personal key (set in
 * Settings) if present, otherwise the shared env key. fal models use the fal
 * key; OpenRouter image models use the OpenRouter key.
 */
export async function resolveImageKey(
  provider: ImageProvider,
  projectId?: string,
): Promise<string> {
  if (provider.local) return "";
  if (provider.id === "openrouter") {
    const userKey = projectId ? await keyForProject(projectId) : undefined;
    const key = userKey ?? env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("No OpenRouter key — add one in Settings, or set OPENROUTER_API_KEY in .env");
    }
    return key;
  }
  const userKey = projectId ? await falKeyForProject(projectId) : undefined;
  const key = userKey ?? env.FAL_KEY;
  if (!key) {
    throw new Error("No fal.ai key — add one in Settings, or set FAL_KEY in .env");
  }
  return key;
}

/** Read image bytes from an http(s) URL or a base64 data-URI. */
async function fetchImageBytes(url: string): Promise<{ buf: Buffer; mime: string }> {
  if (url.startsWith("data:")) {
    const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(url);
    if (!m) throw new Error("malformed data URI from image provider");
    const mime = m[1] || "image/png";
    const buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8");
    return { buf, mime };
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`failed to download generated image: ${resp.status}`);
  const mime = resp.headers.get("content-type") ?? "image/jpeg";
  return { buf: Buffer.from(await resp.arrayBuffer()), mime };
}

/**
 * Generate one image and persist it as a project Asset (kind UPLOAD_IMAGE so it
 * can be used directly as a segment reference / still). Returns the saved asset.
 */
export async function generateImageAsset(opts: {
  projectId: string;
  params: GenerateImageParams;
  providerId?: ImageProviderId;
}): Promise<Asset> {
  const provider = getImageProvider(opts.providerId ?? "fal");
  const key = await resolveImageKey(provider, opts.projectId);

  const results = await provider.generate(opts.params, key);
  const first = results[0];
  if (!first) throw new Error("image provider returned no images");

  const { buf, mime } = await fetchImageBytes(first.url);
  const contentType = first.contentType ?? mime;
  const isPng = contentType.includes("png");

  return saveAsset({
    projectId: opts.projectId,
    kind: "UPLOAD_IMAGE",
    sub: "images",
    filename: `gen-${randomUUID()}.${isPng ? "png" : "jpg"}`,
    data: buf,
    mime: contentType,
  });
}
