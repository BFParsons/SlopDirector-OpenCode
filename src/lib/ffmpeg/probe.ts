import { spawn } from "node:child_process";
import { ffprobePath } from "./binary";

/** True if the file has at least one audio stream. */
export function hasAudioStream(absPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath(), [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      absPath,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(false));
    proc.on("close", () => resolve(out.trim().length > 0));
  });
}

/** Return the duration of a media file in seconds (0 on failure). */
export function probeDuration(absPath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath(), [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      absPath,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : 0);
    });
  });
}

/** First video stream's codec / size / pixel format; null if none or on failure. */
export function probeVideoStream(
  absPath: string,
): Promise<{ codec: string; width: number; height: number; pixFmt: string } | null> {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath(), [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,width,height,pix_fmt",
      "-of",
      "default=noprint_wrappers=1",
      absPath,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(null));
    proc.on("close", () => {
      const kv = new Map<string, string>();
      for (const line of out.split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) kv.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
      }
      const codec = kv.get("codec_name");
      const width = Number(kv.get("width"));
      const height = Number(kv.get("height"));
      if (!codec || !Number.isFinite(width) || !Number.isFinite(height)) return resolve(null);
      resolve({ codec, width, height, pixFmt: kv.get("pix_fmt") ?? "" });
    });
  });
}
