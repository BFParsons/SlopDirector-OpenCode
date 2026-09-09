import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { env } from "@/env";
import { canonicalYouTubeUrl } from "./url";

function fmtTime(s: number): string {
  // yt-dlp --download-sections accepts plain seconds.
  return Math.max(0, Math.floor(s)).toString();
}

/**
 * Cookie args for yt-dlp. We point it straight at the configured cookies file
 * (mounted read-write) so it can rewrite the jar with YouTube's rotated session
 * tokens — discarding that refresh makes the cookies go stale within minutes.
 * Concurrent writes to the shared file are avoided by serializing YouTube
 * imports in the worker (one at a time).
 */
function cookieArgs(): string[] {
  if (env.YTDLP_COOKIES) return ["--cookies", env.YTDLP_COOKIES];
  if (env.YTDLP_COOKIES_FROM_BROWSER)
    return ["--cookies-from-browser", env.YTDLP_COOKIES_FROM_BROWSER];
  return [];
}

export interface DownloadedClip {
  path: string; // absolute path to the produced mp4 (in a temp dir the caller cleans)
  tmpDir: string; // the temp dir to remove when done
}

/**
 * Download a [startS, endS] section of a YouTube video as an mp4 using yt-dlp.
 * Only the requested section is fetched (`--download-sections`), cut accurately
 * (`--force-keyframes-at-cuts`). The URL is rebuilt from a validated id, and all
 * arguments are passed as an argv (no shell) — no injection surface.
 */
export function downloadYouTubeClip(opts: {
  videoId: string;
  startS: number;
  endS: number;
  maxHeight?: number;
  timeoutMs?: number;
}): Promise<DownloadedClip> {
  const { videoId, startS, endS } = opts;
  const maxHeight = opts.maxHeight ?? 1080;
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;

  return new Promise(async (resolve, reject) => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), "yt-import-"));
    const outTmpl = path.join(tmpDir, "clip.%(ext)s");
    const url = canonicalYouTubeUrl(videoId);

    const args = [
      "--no-playlist",
      "--no-progress",
      "--no-warnings",
      "--download-sections",
      `*${fmtTime(startS)}-${fmtTime(endS)}`,
      "--force-keyframes-at-cuts",
      // The frame-accurate cut re-encodes the section; yt-dlp's default x264
      // preset ran slower than the download itself (34 s of CPU for a 60 s
      // 720p section on a laptop). veryfast keeps up with the network.
      "--downloader-args",
      "ffmpeg_o:-preset veryfast -crf 20",
      "-f",
      `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]/b`,
      "--merge-output-format",
      "mp4",
    ];
    // Solve YouTube's n-challenge via the EJS solver (run by a JS runtime on PATH).
    if (env.YTDLP_REMOTE_COMPONENTS) {
      args.push("--remote-components", env.YTDLP_REMOTE_COMPONENTS);
    }
    // YouTube often requires auth; pass cookies if the operator configured them.
    args.push(...cookieArgs());
    args.push("-o", outTmpl, url);

    const proc = spawn(env.YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const killer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });
    proc.on("error", (e) => {
      clearTimeout(killer);
      void rm(tmpDir, { recursive: true, force: true });
      reject(new Error(`yt-dlp failed to start (${env.YTDLP_BIN}): ${e.message}`));
    });
    proc.on("close", async (code) => {
      clearTimeout(killer);
      if (code !== 0) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-800) || "no output"}`));
        return;
      }
      // Find the produced file (extension may vary before/after merge).
      let files: string[] = [];
      try {
        files = await readdir(tmpDir);
      } catch {
        /* fall through to the empty check */
      }
      const produced =
        files.find((f) => f.endsWith(".mp4")) ?? files.find((f) => f.startsWith("clip."));
      if (!produced) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error("yt-dlp produced no output file"));
        return;
      }
      resolve({ path: path.join(tmpDir, produced), tmpDir });
    });
  });
}

/**
 * Download a [startS, endS] section of a YouTube video as an mp3 (audio only) for
 * use as an overlay. Same section/keyframe/auth handling as the video path, but
 * extracts the bestaudio stream and transcodes to mp3.
 */
export function downloadYouTubeAudio(opts: {
  videoId: string;
  startS: number;
  endS: number;
  timeoutMs?: number;
}): Promise<DownloadedClip> {
  const { videoId, startS, endS } = opts;
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;

  return new Promise(async (resolve, reject) => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), "yt-audio-"));
    const outTmpl = path.join(tmpDir, "clip.%(ext)s");
    const url = canonicalYouTubeUrl(videoId);

    const args = [
      "--no-playlist",
      "--no-progress",
      "--no-warnings",
      "--download-sections",
      `*${fmtTime(startS)}-${fmtTime(endS)}`,
      "--force-keyframes-at-cuts",
      "-f",
      "ba/b",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
    ];
    if (env.YTDLP_REMOTE_COMPONENTS) {
      args.push("--remote-components", env.YTDLP_REMOTE_COMPONENTS);
    }
    args.push(...cookieArgs());
    args.push("-o", outTmpl, url);

    const proc = spawn(env.YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const killer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });
    proc.on("error", (e) => {
      clearTimeout(killer);
      void rm(tmpDir, { recursive: true, force: true });
      reject(new Error(`yt-dlp failed to start (${env.YTDLP_BIN}): ${e.message}`));
    });
    proc.on("close", async (code) => {
      clearTimeout(killer);
      if (code !== 0) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-800) || "no output"}`));
        return;
      }
      let files: string[] = [];
      try {
        files = await readdir(tmpDir);
      } catch {
        /* fall through */
      }
      const produced =
        files.find((f) => f.endsWith(".mp3")) ?? files.find((f) => f.startsWith("clip."));
      if (!produced) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error("yt-dlp produced no audio file"));
        return;
      }
      resolve({ path: path.join(tmpDir, produced), tmpDir });
    });
  });
}
