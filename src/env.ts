import { z } from "zod";

/**
 * Centralised, validated environment access.
 *
 * Non-secret values get safe defaults so `next build` never crashes on a
 * missing env. Secrets are optional in the schema but read through
 * `requireEnv()` at the point of use, which throws a clear error at runtime
 * if they are absent.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().optional(),

  // OpenRouter
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  OPENROUTER_WEBHOOK_SECRET: z.string().optional(),

  // Narration (TTS). The house narrator: when ELEVENLABS_API_KEY is set the
  // server's default TTS model becomes ElevenLabs, voiced by ELEVENLABS_VOICE_ID
  // (see src/lib/tts/synthesize.ts). SLOPSTUDIO_TTS_MODEL / _VOICE pin the
  // default explicitly (a model id from src/config/models.ts and one of its voices).
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_v3"),
  // A v3 audio tag prepended to every take unless the text already opens with one; "" disables.
  ELEVENLABS_STYLE_TAG: z.string().default("[serious]"),
  ELEVENLABS_STABILITY: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0.5)),
  ELEVENLABS_SIMILARITY: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0.8)),
  ELEVENLABS_SPEED: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 1)),
  // ffmpeg audio filter chain applied to every ElevenLabs take before it is filed (48 kHz mono WAV).
  ELEVENLABS_CONDITION: z.string().default("highpass=f=65,loudnorm=I=-16:TP=-2:LRA=7"),
  SLOPSTUDIO_TTS_MODEL: z.string().optional(),
  SLOPSTUDIO_TTS_VOICE: z.string().optional(),

  // Auth / crypto
  AUTH_SECRET: z.string().optional(),

  // Public origin used for webhook callback_url (must be HTTPS in prod)
  PUBLIC_BASE_URL: z.string().optional(),

  // Filesystem root for generated assets
  ASSET_ROOT: z.string().default("./.data/assets"),

  // Behind a reverse proxy? Then trust X-Forwarded-For / X-Real-IP
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  // Background worker
  WORKER_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"), // on unless explicitly "false"
  WORKER_ID: z.string().default("worker-1"),
  WORKER_POLL_MS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 2500)),
  MAX_CONCURRENT_VIDEO: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3)),
  MAX_CONCURRENT_ASSEMBLY: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 1)),

  // SlopStudio host tuning (desktop). Left unset, the capability probe
  // (src/lib/system/capabilities.ts) picks sensible values for the machine.
  //   VIDEO_ENCODER: auto | x264 | vaapi | nvenc | qsv  (auto = best validated)
  VIDEO_ENCODER: z.string().optional(),
  VAAPI_DEVICE: z.string().default("/dev/dri/renderD128"),
  X264_PRESET: z.string().optional(), // ultrafast … veryslow (desktop can go slower)
  //   HW_DECODE: auto | on | off — VA-API decode of H.264/HEVC sources during
  //   export (auto = only when the startup probe validated it on this host)
  HW_DECODE: z.string().optional(),
  // Where the host capability probe caches its result (default: next to the
  // SQLite DB, else the OS temp dir). SLOPSTUDIO_CAPS_CACHE=false disables it.
  SLOPSTUDIO_CACHE_DIR: z.string().optional(),
  SLOPSTUDIO_CAPS_CACHE: z.string().optional(),
  RENDER_QUALITY: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)), // CRF/CQ target; lower = better

  // YouTube import (yt-dlp). Path is configurable so a fresher user-space
  // yt-dlp can override the system one if YouTube breaks the old build.
  YTDLP_BIN: z.string().default("yt-dlp"),
  YT_IMPORT_MAX_SECONDS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 180)),
  // YouTube increasingly demands auth ("confirm you're not a bot"). Point at a
  // cookies.txt, or a browser whose logged-in session yt-dlp can read
  // (e.g. "firefox", "chrome", "chromium"). YTDLP_COOKIES wins if both set.
  YTDLP_COOKIES: z.string().optional(),
  YTDLP_COOKIES_FROM_BROWSER: z.string().optional(),
  // yt-dlp EJS challenge-solver components (needs a JS runtime like Deno on PATH).
  // Required to solve YouTube's n-challenge; set empty to disable.
  YTDLP_REMOTE_COMPONENTS: z.string().default("ejs:github"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Should be unreachable given everything is optional/defaulted, but surface
  // it loudly if a transform throws.
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export type Env = typeof env;

/** Read a required secret, throwing a clear error if it is missing. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing required environment variable: ${String(key)}. Set it in .env`,
    );
  }
  return value as NonNullable<Env[K]>;
}

export const isProd = env.NODE_ENV === "production";
