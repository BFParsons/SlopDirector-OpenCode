/**
 * Content-addressed cache for analysis results (scene cuts, silences,
 * loudness, black/frozen frames, loudness timelines, transcripts). Every one
 * is a full ffmpeg/Whisper pass over the file, and agents ask for the same
 * answer many times — perception, then check_cuts, then check_soundtrack…
 *
 * Keyed by the file's CONTENT (a sha1 of the bytes), not by
 * asset id or project: placing another project's asset on a timeline copies
 * the file into the new project (`copyAssetToProject`), and a per-project
 * cache made every check cold again in each new project (check_cuts: 38 s
 * cold vs 1.4 s warm on the same 8 clips). Lives in `<ASSET_ROOT>/_cache/<fp>/`.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ASSET_ROOT } from "@/lib/assets/storage";

const g = globalThis as unknown as { __slopFpCache?: Map<string, Promise<string>> };
const fps = (g.__slopFpCache ??= new Map<string, Promise<string>>());

/**
 * Content fingerprint of a media file: sha1 of the whole file, memoized per
 * path/size/mtime for the life of the process (~5 ms per MB once; a 50 MB
 * render hashes in 0.26 s on the laptop). Whole-file on purpose: sampling
 * the head and tail would let two fixtures that differ only in the middle —
 * the same tone bed with speech at a different second — share a cache entry.
 * The in-flight promise is what's memoized, so the parallel lookups an agent
 * fires for one file (scenes + silences + transcript) hash it once.
 */
export async function fingerprint(file: string): Promise<string> {
  const st = await stat(file);
  const memo = `${file}|${st.size}|${st.mtimeMs}`;
  const hit = fps.get(memo);
  if (hit) return hit;
  const p = (async () => {
    const h = createHash("sha1");
    for await (const chunk of createReadStream(file, { highWaterMark: 1 << 20 })) h.update(chunk as Buffer);
    return h.digest("hex").slice(0, 24);
  })();
  if (fps.size > 5000) fps.clear();
  fps.set(memo, p);
  try {
    return await p;
  } catch (e) {
    fps.delete(memo);
    throw e;
  }
}

/** Directory holding cached derivatives of this file's content (created). */
export async function mediaCacheDir(file: string): Promise<string> {
  const dir = path.join(ASSET_ROOT, "_cache", await fingerprint(file));
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Path for a named derivative of the file (e.g. `transcript-base.json`). */
export async function mediaCachePath(file: string, name: string): Promise<string> {
  return path.join(await mediaCacheDir(file), name);
}

/** JSON result cache: `key` names the analysis + its parameters (no asset id needed). */
export async function cachedJson<T>(key: string, file: string, compute: () => Promise<T>): Promise<T> {
  let f: string;
  try {
    f = await mediaCachePath(file, `${key}.json`);
  } catch {
    return compute();
  }
  if (existsSync(f)) {
    try {
      return JSON.parse(await readFile(f, "utf8")) as T;
    } catch {
      /* recompute */
    }
  }
  const value = await compute();
  try {
    const tmp = `${f}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, f);
  } catch {
    /* cache write is best-effort */
  }
  return value;
}
