/**
 * Audio Studio mixdown. Combines the workspace's tracks into a single file with
 * ffmpeg: each track is delayed to its timeline offset and scaled by its lane
 * volume, then everything is summed with `amix`. Solo overrides mute (matching
 * the Multitrack panel's audibleSet). Output lands in the project's audio-studio
 * folder as WAV (pcm_s16le) or MP3 (libmp3lame 320k).
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ffmpegPath, ffprobePath } from "@/lib/ffmpeg/binary";
import { audioProjectDir, audioRelPath, newAudioFilename, resolveAudioFile } from "./workspace";
import { updateJob } from "./jobs";

export interface MixTrackInput {
  relPath: string;
  /** 0..4 linear gain (UI uses 0..1.5). */
  volume: number;
  muted: boolean;
  solo: boolean;
  /** Start offset on the timeline, seconds. */
  offsetS: number;
  /** In-point within the source, seconds (left trim). */
  trimStartS?: number;
  /** Visible clip length after trimming, seconds. */
  durationS?: number;
}

export interface MixOptions {
  format?: "wav" | "mp3";
  /** Friendly base name for the output + the new track. */
  name?: string;
  /** Loudness-normalize the mix to −14 LUFS. */
  normalize?: boolean;
}

export interface MixResult {
  name: string;
  relPath: string;
  durationS: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function probeDuration(abs: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath(), [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nokey=1:noprint_wrappers=1",
      abs,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const n = Number(out.trim());
      resolve(Number.isFinite(n) ? n : 0);
    });
  });
}

export async function runMix(
  projectId: string,
  tracks: MixTrackInput[],
  opts: MixOptions,
  jobId: string,
): Promise<MixResult> {
  const format = opts.format === "mp3" ? "mp3" : "wav";

  // Solo overrides mute, mirroring the Multitrack panel's audibleSet().
  const soloed = tracks.filter((t) => t.solo);
  const pool = soloed.length ? soloed : tracks;
  const active = pool.filter((t) => !t.muted);
  if (active.length === 0) throw new Error("Nothing to mix — every track is muted.");

  const resolved = active.map((t) => {
    const abs = resolveAudioFile(projectId, t.relPath);
    if (!abs) throw new Error(`Invalid track path: ${t.relPath}`);
    return { abs, t };
  });

  await mkdir(audioProjectDir(projectId), { recursive: true });
  const outName = newAudioFilename(`${opts.name?.trim() || "mix"}.${format}`, format);
  const outAbs = path.join(audioProjectDir(projectId), outName);

  updateJob(jobId, { progress: 0.1, message: `Mixing ${resolved.length} tracks…` });

  // Per-track: delay to its offset, then apply lane gain.
  const filters: string[] = resolved.map(({ t }, i) => {
    const offMs = Math.max(0, Math.round(t.offsetS * 1000));
    const delay = offMs > 0 ? `adelay=${offMs}:all=1,` : "";
    const vol = clamp(t.volume, 0, 4).toFixed(3);
    // Apply the clip's in/out points first, then reset timestamps so the
    // subsequent adelay positions the trimmed clip from zero.
    const start = Math.max(0, t.trimStartS ?? 0);
    const len = t.durationS && t.durationS > 0 ? t.durationS : null;
    const trim =
      start > 0 || len != null
        ? `atrim=start=${start.toFixed(3)}${len != null ? `:end=${(start + len).toFixed(3)}` : ""},asetpts=N/SR/TB,`
        : "";
    return `[${i}:a]${trim}${delay}volume=${vol}[a${i}]`;
  });
  const mixIns = resolved.map((_, i) => `[a${i}]`).join("");
  filters.push(
    `${mixIns}amix=inputs=${resolved.length}:duration=longest:normalize=0[mix]`,
  );
  let outLabel = "[mix]";
  if (opts.normalize) {
    filters.push(`[mix]loudnorm=I=-14:TP=-1.5:LRA=11[out]`);
    outLabel = "[out]";
  }

  const codecArgs =
    format === "mp3" ? ["-c:a", "libmp3lame", "-b:a", "320k"] : ["-c:a", "pcm_s16le"];
  const args = [
    "-hide_banner", "-nostats", "-y",
    ...resolved.flatMap(({ abs }) => ["-i", abs]),
    "-filter_complex", filters.join(";"),
    "-map", outLabel,
    ...codecArgs,
    outAbs,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg mix exited ${code}: ${stderr.slice(-500)}`)),
    );
  });

  updateJob(jobId, { progress: 0.95, message: "Finalizing…" });
  const durationS = await probeDuration(outAbs);
  return { name: opts.name?.trim() || "Mix", relPath: audioRelPath(projectId, outName), durationS };
}
