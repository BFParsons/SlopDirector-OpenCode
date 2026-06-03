import { join } from "node:path";

/**
 * Resolve the `ffmpeg` / `ffprobe` executables.
 *
 * Order of preference:
 *  1. An explicit absolute path from the environment
 *     (`SLOPSTUDIO_FFMPEG_PATH` / `SLOPSTUDIO_FFPROBE_PATH`).
 *  2. A directory holding both binaries (`SLOPSTUDIO_FFMPEG_DIR`) — this is what
 *     the Electron desktop shell sets, pointing at the ffmpeg it bundles under
 *     the app's `resources/ffmpeg`.
 *  3. The system binary on `PATH` — the web/server build and local dev.
 *
 * Keeping packaging detail in the env (owned by the Electron main process) lets
 * the rest of the codebase stay identical between the web and desktop targets.
 */
function resolve(pathEnv: string, dirEnv: string, name: string): string {
  const explicit = process.env[pathEnv];
  if (explicit && explicit.trim()) return explicit.trim();
  const dir = process.env[dirEnv];
  if (dir && dir.trim()) return join(dir.trim(), name);
  return name;
}

export function ffmpegPath(): string {
  return resolve("SLOPSTUDIO_FFMPEG_PATH", "SLOPSTUDIO_FFMPEG_DIR", "ffmpeg");
}

export function ffprobePath(): string {
  return resolve("SLOPSTUDIO_FFPROBE_PATH", "SLOPSTUDIO_FFMPEG_DIR", "ffprobe");
}
