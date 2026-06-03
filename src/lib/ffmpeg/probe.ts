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
