/**
 * On-disk working area for the Audio Studio, kept separate from the DB-backed
 * Asset store so importing/processing scratch audio never pollutes a project's
 * render assets. Everything lives under:
 *
 *   {ASSET_ROOT}/audio-studio/{projectId}/{file}
 *
 * Files are addressed by a relative path of the form `audio-studio/<pid>/<name>`
 * which `resolveAudioFile` validates can never escape the project's own folder.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { ASSET_ROOT } from "@/lib/assets/storage";

const ROOT_SUB = "audio-studio";

export function audioProjectDir(projectId: string): string {
  return path.join(ASSET_ROOT, ROOT_SUB, projectId);
}

export async function ensureAudioDir(projectId: string): Promise<string> {
  const dir = audioProjectDir(projectId);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** A safe, unique on-disk name keeping the original extension (lowercased). */
export function newAudioFilename(originalName: string, fallbackExt = "wav"): string {
  const ext = (path.extname(originalName).replace(".", "").toLowerCase() || fallbackExt).slice(0, 5);
  const base = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .slice(0, 48) || "audio";
  return `${base}-${randomUUID().slice(0, 8)}.${ext}`;
}

/** The portable relative path stored in the client (what the serve route reads). */
export function audioRelPath(projectId: string, filename: string): string {
  return path.posix.join(ROOT_SUB, projectId, filename);
}

/**
 * Resolve a client-supplied relative path to an absolute one, refusing anything
 * that isn't inside this project's audio-studio folder. Returns null if invalid.
 */
export function resolveAudioFile(projectId: string, relPath: string): string | null {
  const projectRoot = audioProjectDir(projectId);
  const abs = path.resolve(ASSET_ROOT, relPath);
  if (abs !== projectRoot && !abs.startsWith(projectRoot + path.sep)) return null;
  return abs;
}

export async function listAudioFiles(projectId: string): Promise<string[]> {
  try {
    const dir = audioProjectDir(projectId);
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => audioRelPath(projectId, e.name));
  } catch {
    return [];
  }
}

export async function deleteAudioFile(projectId: string, relPath: string): Promise<boolean> {
  const abs = resolveAudioFile(projectId, relPath);
  if (!abs) return false;
  await rm(abs, { force: true });
  return true;
}

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  weba: "audio/webm",
  webm: "audio/webm",
};

export function audioMimeForPath(p: string): string {
  const ext = path.extname(p).replace(".", "").toLowerCase();
  return AUDIO_MIME[ext] ?? "application/octet-stream";
}
