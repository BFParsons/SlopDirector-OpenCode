/**
 * Import a full YouTube track as an mp3 into the Audio Studio workspace via
 * yt-dlp (bestaudio → ffmpeg → mp3). Mirrors the auth/remote-component handling
 * of lib/youtube/import.ts, but grabs the whole track (no --download-sections)
 * and lands it in audio-studio/<pid>/ as a normal imported track.
 */
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { env } from "@/env";
import { parseYouTubeId, canonicalYouTubeUrl } from "@/lib/youtube/url";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { audioProjectDir, audioRelPath, ensureAudioDir, newAudioFilename } from "./workspace";
import { updateJob } from "./jobs";

export interface YtMp3Result {
  name: string;
  relPath: string;
  durationS: number;
}

function cookieArgs(): string[] {
  if (env.YTDLP_COOKIES) return ["--cookies", env.YTDLP_COOKIES];
  if (env.YTDLP_COOKIES_FROM_BROWSER) return ["--cookies-from-browser", env.YTDLP_COOKIES_FROM_BROWSER];
  return [];
}

export async function importYouTubeMp3(
  projectId: string,
  rawUrl: string,
  jobId: string,
): Promise<YtMp3Result> {
  const id = parseYouTubeId(rawUrl);
  if (!id) throw new Error("Not a valid YouTube URL");
  const url = canonicalYouTubeUrl(id);

  const tmpDir = await mkdtemp(path.join(tmpdir(), "yt-mp3-"));
  try {
    const outTmpl = path.join(tmpDir, "%(title).80s.%(ext)s");
    const args = [
      "--no-playlist", "--no-warnings", "--newline",
      "-f", "ba/b",
      "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0",
    ];
    // yt-dlp needs ffmpeg for extraction; point it at our resolved ffmpeg dir.
    if (process.env.SLOPSTUDIO_FFMPEG_DIR) args.push("--ffmpeg-location", process.env.SLOPSTUDIO_FFMPEG_DIR);
    if (env.YTDLP_REMOTE_COMPONENTS) args.push("--remote-components", env.YTDLP_REMOTE_COMPONENTS);
    args.push(...cookieArgs());
    args.push("-o", outTmpl, url);

    updateJob(jobId, { progress: 0.05, message: "Fetching from YouTube…" });

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(env.YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      const killer = setTimeout(() => proc.kill("SIGKILL"), 10 * 60 * 1000);
      const onData = (buf: Buffer) => {
        const text = buf.toString();
        stderr += text;
        if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
        const m = text.match(/\[download\]\s+([\d.]+)%/);
        if (m) {
          const pct = Number(m[1]);
          updateJob(jobId, { progress: Math.min(0.9, pct / 100), message: `Downloading… ${Math.round(pct)}%` });
        }
        if (/\[ExtractAudio\]|Extracting audio|Destination:.*\.mp3/.test(text)) {
          updateJob(jobId, { progress: 0.95, message: "Converting to mp3…" });
        }
      };
      proc.stdout.on("data", onData);
      proc.stderr.on("data", onData);
      proc.on("error", (e) => {
        clearTimeout(killer);
        reject(new Error(`yt-dlp failed to start (${env.YTDLP_BIN}): ${e.message}`));
      });
      proc.on("close", (code) => {
        clearTimeout(killer);
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-600) || "no output"}`));
      });
    });

    const files = await readdir(tmpDir);
    const mp3 = files.find((f) => f.toLowerCase().endsWith(".mp3"));
    if (!mp3) throw new Error("yt-dlp produced no mp3");
    const title = path.basename(mp3, path.extname(mp3)) || "YouTube audio";

    await ensureAudioDir(projectId);
    const filename = newAudioFilename(`${title}.mp3`, "mp3");
    const destAbs = path.join(audioProjectDir(projectId), filename);
    await copyFile(path.join(tmpDir, mp3), destAbs);

    const relPath = audioRelPath(projectId, filename);
    const durationS = await probeDuration(destAbs);
    return { name: title, relPath, durationS };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
