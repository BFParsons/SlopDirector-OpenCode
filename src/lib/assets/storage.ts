import { createWriteStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import type { Asset } from "@prisma/client";
import type { AssetKind } from "@/lib/db/enums";
import { env } from "@/env";
import { prisma } from "@/lib/db/client";

export const ASSET_ROOT = path.resolve(env.ASSET_ROOT);

export type AssetSubdir = "uploads" | "clips" | "vo" | "overlays" | "final" | "tmp" | "images";

export function projectDir(projectId: string): string {
  return path.join(ASSET_ROOT, projectId);
}

export function subDir(projectId: string, sub: AssetSubdir): string {
  return path.join(projectDir(projectId), sub);
}

/** Resolve a stored relative path to an absolute path, guarding traversal. */
export function absolutePath(relativePath: string): string {
  const abs = path.resolve(ASSET_ROOT, relativePath);
  if (abs !== ASSET_ROOT && !abs.startsWith(ASSET_ROOT + path.sep)) {
    throw new Error("Asset path escapes ASSET_ROOT");
  }
  return abs;
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Atomically write bytes under {projectId}/{sub}/{filename}; returns rel path. */
export async function writeAssetFile(
  projectId: string,
  sub: AssetSubdir,
  filename: string,
  data: Buffer,
): Promise<string> {
  const dir = subDir(projectId, sub);
  await ensureDir(dir);
  const finalPath = path.join(dir, filename);
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, data);
  await rename(tmpPath, finalPath);
  return path.relative(ASSET_ROOT, finalPath);
}

/** Write a file and create its Asset DB row in one step. */
export async function saveAsset(opts: {
  projectId: string;
  kind: AssetKind;
  sub: AssetSubdir;
  filename: string;
  data: Buffer;
  mime: string;
}): Promise<Asset> {
  const relativePath = await writeAssetFile(
    opts.projectId,
    opts.sub,
    opts.filename,
    opts.data,
  );
  const sha256 = createHash("sha256").update(opts.data).digest("hex");
  return prisma.asset.create({
    data: {
      projectId: opts.projectId,
      kind: opts.kind,
      path: relativePath,
      mime: opts.mime,
      sizeBytes: opts.data.length,
      sha256,
    },
  });
}

/**
 * Copy an existing asset's file into another project and register a new Asset
 * row owned by that project. Used for cross-project reuse so the target project
 * owns its own copy — a deleted source project can't break it. Streams via
 * copyFile (no buffering), so large clips are fine.
 */
export async function copyAssetToProject(
  asset: Asset,
  targetProjectId: string,
): Promise<Asset> {
  const sub: AssetSubdir = asset.kind === "SHOT_CLIP" ? "clips" : "uploads";
  const dir = subDir(targetProjectId, sub);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${path.extname(asset.path)}`;
  const dest = path.join(dir, filename);
  await copyFile(absolutePath(asset.path), dest);
  return prisma.asset.create({
    data: {
      projectId: targetProjectId,
      kind: asset.kind,
      path: path.relative(ASSET_ROOT, dest),
      mime: asset.mime,
      sizeBytes: asset.sizeBytes,
      sha256: asset.sha256,
    },
  });
}

/**
 * Stream a web ReadableStream straight to disk, hashing as it flows. Keeps
 * peak memory at one chunk instead of buffering the whole file — important for
 * multi-hundred-MB video clips, several of which can download concurrently.
 */
export async function writeAssetStream(
  projectId: string,
  sub: AssetSubdir,
  filename: string,
  body: ReadableStream<Uint8Array>,
): Promise<{ relativePath: string; sizeBytes: number; sha256: string }> {
  const dir = subDir(projectId, sub);
  await ensureDir(dir);
  const finalPath = path.join(dir, filename);
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;

  const hash = createHash("sha256");
  const hasher = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
  });

  try {
    // fetch() yields the DOM ReadableStream type; Readable.fromWeb wants the
    // structurally-identical node:stream/web one.
    const nodeBody = body as unknown as NodeReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(nodeBody), hasher, createWriteStream(tmpPath));
  } catch (e) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw e;
  }

  const { size } = await stat(tmpPath);
  if (size === 0) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw new Error("Downloaded asset was empty");
  }
  await rename(tmpPath, finalPath);
  return {
    relativePath: path.relative(ASSET_ROOT, finalPath),
    sizeBytes: size,
    sha256: hash.digest("hex"),
  };
}

/** Stream bytes to disk and create the Asset DB row in one step. */
export async function saveAssetStream(opts: {
  projectId: string;
  kind: AssetKind;
  sub: AssetSubdir;
  filename: string;
  body: ReadableStream<Uint8Array>;
  mime: string;
}): Promise<Asset> {
  const { relativePath, sizeBytes, sha256 } = await writeAssetStream(
    opts.projectId,
    opts.sub,
    opts.filename,
    opts.body,
  );
  return prisma.asset.create({
    data: {
      projectId: opts.projectId,
      kind: opts.kind,
      path: relativePath,
      mime: opts.mime,
      sizeBytes,
      sha256,
    },
  });
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await stat(absolutePath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function ensureProjectTmp(projectId: string): Promise<string> {
  const dir = subDir(projectId, "tmp");
  await ensureDir(dir);
  return dir;
}

export async function cleanupTmp(projectId: string): Promise<void> {
  await rm(subDir(projectId, "tmp"), { recursive: true, force: true }).catch(
    () => {},
  );
}

export async function deleteProjectAssets(projectId: string): Promise<void> {
  await rm(projectDir(projectId), { recursive: true, force: true }).catch(
    () => {},
  );
}
