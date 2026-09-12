import { existsSync } from "node:fs";
import path from "node:path";
/**
 * Resolve the external audio tools the Audio Studio shells out to.
 *
 * Everything is overridable via the environment so the Electron desktop shell
 * (or a server deploy) can point at a bundled Python / venv without touching
 * code — mirroring how `lib/ffmpeg/binary.ts` resolves ffmpeg.
 *
 *   SLOPSTUDIO_PYTHON       absolute path to the python interpreter (default python3)
 *   SLOPSTUDIO_DEMUCS_ARGV  JSON array overriding the demucs invocation prefix
 *   SLOPSTUDIO_WHISPER_ARGV JSON array overriding the whisper invocation prefix
 *
 * Demucs and Whisper both ship console scripts, but invoking them through the
 * interpreter (`python -m demucs` / `python -m whisper`) avoids PATH surprises
 * between the system shell and the Node process environment.
 */

function pythonBin(): string {
  const p = process.env.SLOPSTUDIO_PYTHON;
  return p && p.trim() ? p.trim() : process.platform === "win32" ? "python" : "python3";
}

function parseArgvOverride(envName: string): string[] | null {
  const raw = process.env[envName];
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed as string[];
    }
  } catch {
    /* fall through to default */
  }
  return null;
}

/** argv prefix for Demucs stem separation (`demucs.separate` is the CLI entry). */
export function demucsArgv(): string[] {
  return parseArgvOverride("SLOPSTUDIO_DEMUCS_ARGV") ?? [pythonBin(), "-m", "demucs.separate"];
}

/**
 * argv prefix for Whisper transcription. Prefers `whisper-ctranslate2`
 * (faster-whisper / CTranslate2, int8 on the CPU) when it is installed in the
 * same venv: same command line as openai-whisper, several times faster.
 */
export function whisperArgv(): string[] {
  const override = parseArgvOverride("SLOPSTUDIO_WHISPER_ARGV");
  if (override) return override;
  const ct2 = path.join(path.dirname(pythonBin()), process.platform === "win32" ? "whisper-ctranslate2.exe" : "whisper-ctranslate2");
  if (existsSync(ct2)) return [ct2, "--compute_type", "int8"];
  return [pythonBin(), "-m", "whisper"];
}

/** Python interpreter for inline scripts (librosa beat detection, etc.). */
export function python(): string {
  return pythonBin();
}
