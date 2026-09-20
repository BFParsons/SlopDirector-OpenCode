import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { env, requireEnv } from "@/env";
import { ffmpegPath } from "@/lib/ffmpeg/binary";
import { OpenRouterError } from "@/lib/openrouter/client";

/**
 * ElevenLabs text-to-speech.
 *
 * The harness's house narrator lives here: an ElevenLabs voice (by id) on the
 * eleven_v3 model, steered with a v3 audio tag that is prepended to the text
 * (`ELEVENLABS_STYLE_TAG`, default "[serious]"), then conditioned with the
 * same ffmpeg chain the earlier films used (`ELEVENLABS_CONDITION`, default
 * high-pass at 65 Hz and a loudness normalise to −16 LUFS) into 48 kHz mono
 * WAV. Nothing here time-stretches the take: a line that overruns its slot is
 * rewritten shorter and generated again.
 *
 * Errors extend OpenRouterError so the API layer maps them to the same
 * "upstream provider" responses; the message names ElevenLabs.
 */
export class ElevenLabsError extends OpenRouterError {
  constructor(message: string, status: number, body?: unknown) {
    super(message, status, body);
    this.name = "ElevenLabsError";
  }
}

export interface ElevenLabsSettings {
  stability: number;
  similarityBoost: number;
  speed: number;
}

export function elevenLabsSettingsFromEnv(): ElevenLabsSettings {
  return {
    stability: env.ELEVENLABS_STABILITY,
    similarityBoost: env.ELEVENLABS_SIMILARITY,
    speed: env.ELEVENLABS_SPEED,
  };
}

/** Prepend the configured v3 audio tag unless the text already opens with one. */
export function tagForDelivery(text: string, styleTag = env.ELEVENLABS_STYLE_TAG): string {
  const t = text.trim();
  if (!styleTag || !styleTag.trim() || /^\[[^\]]+\]/.test(t)) return t;
  return `${styleTag.trim()} ${t}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface SynthesizeElevenLabsOpts {
  voiceId: string;
  text: string;
  modelId?: string;
  styleTag?: string;
  settings?: Partial<ElevenLabsSettings>;
  /** mp3_44100_128 by default; any ElevenLabs output_format is accepted. */
  outputFormat?: string;
  timeoutMs?: number;
}

/** Raw synthesis: returns the encoded audio bytes (MP3 by default). */
export async function synthesizeElevenLabs(opts: SynthesizeElevenLabsOpts): Promise<Buffer> {
  let key: string;
  try {
    key = requireEnv("ELEVENLABS_API_KEY");
  } catch {
    throw new ElevenLabsError("No ElevenLabs API key configured (ELEVENLABS_API_KEY)", 401);
  }
  const settings = { ...elevenLabsSettingsFromEnv(), ...(opts.settings ?? {}) };
  const body = {
    text: tagForDelivery(opts.text, opts.styleTag ?? env.ELEVENLABS_STYLE_TAG),
    model_id: opts.modelId ?? env.ELEVENLABS_MODEL_ID,
    voice_settings: {
      stability: settings.stability,
      similarity_boost: settings.similarityBoost,
      speed: settings.speed,
    },
  };
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=${encodeURIComponent(opts.outputFormat ?? "mp3_44100_128")}`;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (attempt < 2) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new ElevenLabsError(`Network error calling ElevenLabs: ${(e as Error).message}`, 0);
    }
    clearTimeout(timer);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new ElevenLabsError("ElevenLabs returned empty audio", 502);
      return buf;
    }
    const text = await res.text().catch(() => "");
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(500 * 2 ** attempt);
      continue;
    }
    // Never echo the key; the body is the provider's own error text.
    throw new ElevenLabsError(`ElevenLabs ${res.status}: ${text.slice(0, 400)}`, res.status, text);
  }
}

/**
 * Condition a narration take for the mix: the ffmpeg filter chain from
 * `ELEVENLABS_CONDITION` (or `filters`), resampled to 48 kHz mono WAV.
 * Runs through temp files so the WAV header carries a real length.
 */
export async function conditionNarration(audio: Buffer, filters = env.ELEVENLABS_CONDITION): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "slopstudio-tts-"));
  const inPath = path.join(dir, "take.mp3");
  const outPath = path.join(dir, "take.wav");
  try {
    await writeFile(inPath, audio);
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", inPath];
    if (filters && filters.trim()) args.push("-af", filters.trim());
    args.push("-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", outPath);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr?.on("data", (d) => (stderr += String(d)));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`))));
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
