import { existsSync } from "node:fs";
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
 *  3. `vendor/ffmpeg/` under the working directory when it holds both binaries —
 *     what `scripts/fetch-ffmpeg.sh` / `.ps1` download. This is the supported route on
 *     macOS, where Homebrew's ffmpeg is built without libfreetype/libass and so lacks
 *     the `drawtext` and `ass` filters the titles and captions need.
 *  4. The system binary on `PATH` — the web/server build and local dev.
 *
 * Keeping packaging detail in the env (owned by the Electron main process) lets
 * the rest of the codebase stay identical between the web and desktop targets.
 */
function resolve(pathEnv: string, dirEnv: string, name: string): string {
  const explicit = process.env[pathEnv];
  if (explicit && explicit.trim()) return explicit.trim();
  const dir = process.env[dirEnv];
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (dir && dir.trim()) return join(dir.trim(), exe);
  const vendor = vendorDir();
  if (vendor) return join(vendor, exe);
  return name;
}

let vendorCache: string | null | undefined;
/** `vendor/ffmpeg` if it holds both binaries; resolved once per process. */
export function vendorDir(): string | null {
  if (vendorCache !== undefined) return vendorCache;
  const dir = join(process.cwd(), "vendor", "ffmpeg");
  const exe = process.platform === "win32" ? ".exe" : "";
  vendorCache = ["ffmpeg", "ffprobe"].every((n) => existsSync(join(dir, n + exe))) ? dir : null;
  return vendorCache;
}

export function ffmpegPath(): string {
  return resolve("SLOPSTUDIO_FFMPEG_PATH", "SLOPSTUDIO_FFMPEG_DIR", "ffmpeg");
}

export function ffprobePath(): string {
  return resolve("SLOPSTUDIO_FFPROBE_PATH", "SLOPSTUDIO_FFMPEG_DIR", "ffprobe");
}
