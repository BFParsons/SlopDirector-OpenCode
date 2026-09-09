import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { ffprobePath } from "./binary";

/** One ffprobe's worth of facts about a media file. */
export type MediaProbe = {
  /** Container duration in seconds (0 when unknown, e.g. still images). */
  durationS: number;
  hasAudio: boolean;
  /** First video stream (a cover-art stream counts, as before). */
  video: { codec: string; width: number; height: number; pixFmt: string } | null;
};

const EMPTY: MediaProbe = { durationS: 0, hasAudio: false, video: null };
const CACHE_MAX = 1000;

// Probes are memoized per path+size+mtime for the life of the process: an
// assembly used to spawn two ffprobes per input, serially, and a cold ffprobe
// is ~0.2 s on a laptop (21 inputs ≈ 9 s of a 22 s draft render). The final
// render after a draft now pays nothing. Kept on globalThis so dev hot
// reloads share it.
const g = globalThis as unknown as { __slopProbeCache?: Map<string, Promise<MediaProbe>> };
const cache = (g.__slopProbeCache ??= new Map<string, Promise<MediaProbe>>());

function runProbe(absPath: string): Promise<MediaProbe> {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath(), [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=index,codec_type,codec_name,width,height,pix_fmt",
      "-of",
      "json",
      absPath,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(EMPTY));
    proc.on("close", () => {
      try {
        const j = JSON.parse(out) as {
          format?: { duration?: string };
          streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; pix_fmt?: string }>;
        };
        const d = parseFloat(j.format?.duration ?? "");
        const streams = j.streams ?? [];
        const v = streams.find((s) => s.codec_type === "video");
        resolve({
          durationS: Number.isFinite(d) ? d : 0,
          hasAudio: streams.some((s) => s.codec_type === "audio"),
          video:
            v && v.codec_name && Number.isFinite(v.width) && Number.isFinite(v.height)
              ? { codec: v.codec_name, width: v.width as number, height: v.height as number, pixFmt: v.pix_fmt ?? "" }
              : null,
        });
      } catch {
        resolve(EMPTY);
      }
    });
  });
}

/** Probe a file once (duration, audio presence, first video stream); cached by path+size+mtime. */
export async function probeMedia(absPath: string): Promise<MediaProbe> {
  let key: string;
  try {
    const st = await stat(absPath);
    key = `${absPath}|${st.size}|${st.mtimeMs}`;
  } catch {
    return EMPTY;
  }
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  const p = runProbe(absPath);
  cache.set(key, p);
  const r = await p;
  // Don't pin a failed probe (file still being written, transient error).
  if (r === EMPTY) cache.delete(key);
  return r;
}

/** Probe many files concurrently so a later serial walk hits the cache. */
export async function warmProbes(paths: string[], concurrency = 4): Promise<void> {
  const queue = [...new Set(paths)];
  const workers = Math.min(concurrency, queue.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (let p = queue.shift(); p !== undefined; p = queue.shift()) await probeMedia(p);
    }),
  );
}

/** True if the file has at least one audio stream. */
export async function hasAudioStream(absPath: string): Promise<boolean> {
  return (await probeMedia(absPath)).hasAudio;
}

/** Return the duration of a media file in seconds (0 on failure). */
export async function probeDuration(absPath: string): Promise<number> {
  return (await probeMedia(absPath)).durationS;
}

/** First video stream's codec / size / pixel format; null if none or on failure. */
export async function probeVideoStream(
  absPath: string,
): Promise<{ codec: string; width: number; height: number; pixFmt: string } | null> {
  return (await probeMedia(absPath)).video;
}
