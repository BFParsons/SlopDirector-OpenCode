/**
 * Curated OpenRouter model catalog + defaults.
 *
 * IMPORTANT: model IDs and per-second prices are best-effort and must be
 * confirmed against your OpenRouter account (`GET /api/v1/videos/models` and
 * the model pages). Prices drive the cost preview; if they drift, update here.
 * The brief form also lets the user override any of these with a custom ID.
 */

export interface VideoModelInfo {
  id: string;
  label: string;
  /** USD per second of generated video — used for the cost preview. */
  pricePerSecondUsd: number;
  supportsImageToVideo: boolean;
  supportsAudio: boolean;
  maxDurationS: number;
  /** Discrete clip lengths (seconds) the provider actually accepts. Constrains
   *  the generator UI so a request can't produce a duration error. Researched
   *  per model family (2026); best-effort — confirm against the provider. */
  durationsS: number[];
  /** Expensive models gated behind the ADMIN role. */
  adminOnly?: boolean;
  note?: string;
}

// Prices are per-second from OpenRouter's videos/models metadata (verified
// 2026-05-27). Seedance/Veo bill by resolution tier so the value here is a
// representative estimate for the cost preview.
export const VIDEO_MODELS: VideoModelInfo[] = [
  {
    id: "alibaba/wan-2.7",
    label: "Wan 2.7 (720p/1080p)",
    pricePerSecondUsd: 0.1,
    supportsImageToVideo: true,
    supportsAudio: true,
    maxDurationS: 5,
    durationsS: [5], // Wan family generates 5s clips
    note: "Open model, no public-figure gate. Good default for prototypes.",
  },
  {
    id: "kwaivgi/kling-v3.0-std",
    label: "Kling v3.0 Standard (720p)",
    pricePerSecondUsd: 0.084,
    supportsImageToVideo: true,
    supportsAudio: true,
    maxDurationS: 10,
    durationsS: [5, 10], // Kling Standard/Pro: 5 or 10s
  },
  {
    id: "bytedance/seedance-2.0-fast",
    label: "Seedance 2.0 Fast (480p/720p)",
    pricePerSecondUsd: 0.03,
    supportsImageToVideo: true,
    supportsAudio: true,
    maxDurationS: 10,
    durationsS: [4, 5, 6, 8, 10], // Seedance fixed lengths (capped at 10 here)
  },
  {
    id: "bytedance/seedance-2.0",
    label: "Seedance 2.0 (480p–1080p)",
    pricePerSecondUsd: 0.06,
    supportsImageToVideo: true,
    supportsAudio: true,
    maxDurationS: 10,
    durationsS: [4, 5, 6, 8, 10],
  },
  {
    id: "google/veo-3.1",
    label: "Veo 3.1 (cinematic, native audio) — pricey",
    pricePerSecondUsd: 0.75,
    supportsImageToVideo: true,
    supportsAudio: true,
    maxDurationS: 8,
    durationsS: [4, 6, 8], // Veo 3.1: 4, 6, or 8s
    adminOnly: true,
    note: "Blocks public-figure likeness. ~$22 for a 30s video. Admin only.",
  },
];

export const DEFAULT_VIDEO_MODEL = "alibaba/wan-2.7";

/** Allowed clip lengths for a model id (falls back to a single 5s option). */
export function videoDurations(id: string): number[] {
  const d = getVideoModel(id)?.durationsS;
  return d && d.length ? d : [5];
}

/** A sensible default length for a model (prefers 5s when available). */
export function defaultVideoDuration(id: string): number {
  const opts = videoDurations(id);
  return opts.includes(5) ? 5 : opts[0];
}

export function getVideoModel(id: string): VideoModelInfo | undefined {
  return VIDEO_MODELS.find((m) => m.id === id);
}

// ----------------------------------------------------------------------------
// Image models (fal.ai) for storyboard generation — scenes, characters,
// objects, keyframes. `i2i` is the image-to-image endpoint used when generating
// from a reference (style anchor, variant, camera angle); models without one
// fall back to Flux dev img2img. Prices are USD per image (~1MP) and
// best-effort — confirm against your fal dashboard; flux/dev is verified.

export interface ImageModelInfo {
  id: string; // text->image slug
  i2i?: string; // image->image slug (single reference)
  i2iMulti?: string; // multi-reference slug (e.g. Kontext multi) for 2+ refs
  provider?: "fal" | "openrouter"; // default "fal"
  label: string;
  pricePerImageUsd: number;
  note?: string;
}

export const IMAGE_MODELS: ImageModelInfo[] = [
  {
    id: "fal-ai/flux/dev",
    i2i: "fal-ai/flux/dev/image-to-image",
    label: "Flux.1 [dev]",
    pricePerImageUsd: 0.025,
    note: "Balanced quality and price. Good default.",
  },
  {
    id: "fal-ai/flux/schnell",
    label: "Flux.1 [schnell]",
    pricePerImageUsd: 0.003,
    note: "Fastest and cheapest; lower detail. Great for rough drafts.",
  },
  {
    id: "fal-ai/flux-pro/v1.1",
    label: "Flux 1.1 [pro]",
    pricePerImageUsd: 0.04,
    note: "Sharper, more coherent than dev.",
  },
  {
    id: "fal-ai/flux-pro/v1.1-ultra",
    label: "Flux 1.1 [pro] Ultra",
    pricePerImageUsd: 0.06,
    note: "Maximum detail and resolution.",
  },
  {
    id: "fal-ai/recraft-v3",
    label: "Recraft V3",
    pricePerImageUsd: 0.04,
    note: "Strong art styles and legible text-in-image.",
  },
  {
    // Runs through OpenRouter's image output API (your OpenRouter key), not fal.
    id: "google/gemini-3-pro-image-preview",
    provider: "openrouter",
    label: "Gemini 3 Pro Image (Nano Banana Pro)",
    pricePerImageUsd: 0.13,
    note: "Highest-quality subject/character consistency + reference editing. Google-moderated (great for archetypal scenes/characters).",
  },
  {
    id: "google/gemini-2.5-flash-image",
    provider: "openrouter",
    label: "Gemini 2.5 Flash Image (Nano Banana)",
    pricePerImageUsd: 0.039,
    note: "Strong consistency + editing, cheaper & faster than Pro. Google-moderated.",
  },
  {
    id: "fal-ai/bytedance/seedream/v4/text-to-image",
    i2i: "fal-ai/bytedance/seedream/v4/edit",
    label: "Seedream 4 (ByteDance)",
    pricePerImageUsd: 0.03,
    note: "High quality + editing, light guardrails.",
  },
  {
    id: "fal-ai/imagen4/preview/ultra",
    label: "Imagen 4 Ultra (Google)",
    pricePerImageUsd: 0.06,
    note: "Top-tier photorealism. Google-moderated; text-to-image only.",
  },
  {
    // Identity-preserving edits (keep the subject, change X) + multi-reference
    // composition. The open Flux answer to Nano Banana; lighter guardrails.
    id: "fal-ai/flux-pro/kontext/text-to-image",
    i2i: "fal-ai/flux-pro/kontext",
    i2iMulti: "fal-ai/flux-pro/kontext/multi",
    label: "Flux Kontext [pro]",
    pricePerImageUsd: 0.04,
    note: "Keeps a subject's identity across outfits/angles; fuses multiple references for composed shots.",
  },
  {
    id: "fal-ai/flux-pro/kontext/max/text-to-image",
    i2i: "fal-ai/flux-pro/kontext/max",
    i2iMulti: "fal-ai/flux-pro/kontext/max/multi",
    label: "Flux Kontext [max]",
    pricePerImageUsd: 0.08,
    note: "Highest-quality Kontext — best identity preservation + composition.",
  },
];

export const DEFAULT_IMAGE_MODEL = "fal-ai/flux/dev";

export function getImageModel(id: string): ImageModelInfo | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

/**
 * True for reference-EDITING models (Flux Kontext, Gemini/Nano Banana) that keep
 * a subject's identity and take the prompt as an instruction. For these, variant
 * / camera-angle prompts should be the *change* only, not a re-description.
 */
export function isRefEditorModel(id: string): boolean {
  const m = getImageModel(id);
  if (!m) return false;
  return m.id.includes("kontext") || m.provider === "openrouter";
}

// ----------------------------------------------------------------------------

export interface ChatModelInfo {
  id: string;
  label: string;
  note?: string;
}

/**
 * Chat models for script/storyboard generation. The default should be a
 * permissive, instruction-following model that will name and critique real
 * politicians for legitimate campaign-video copywriting without refusing.
 */
// Verified 2026-05-27: all return valid strict-JSON structured output in a few
// seconds and do NOT refuse named political campaign-video copy. (Grok 4.20 was dropped as
// default — it stalls badly on strict schema.)
export const CHAT_MODELS: ChatModelInfo[] = [
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash (fast, permissive)",
    note: "Good default: quick, handles named political criticism.",
  },
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek Chat v3.1 (fastest)" },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (highest quality)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
];

export const DEFAULT_LLM_MODEL = "google/gemini-3.5-flash";

// ----------------------------------------------------------------------------

export interface TtsModelInfo {
  id: string;
  label: string;
  defaultVoice?: string;
  /** Selectable voices for this model. */
  voices: string[];
  /** USD per 1k characters (rough; for cost preview only). */
  pricePer1kCharsUsd: number;
  note?: string;
}

// Verified 2026-05-27: this is the TTS model exposed to this account via
// /audio/speech (returns mp3). Voices: eve, ara, rex, sal, leo.
export const TTS_MODELS: TtsModelInfo[] = [
  {
    id: "x-ai/grok-voice-tts-1.0",
    label: "Grok Voice TTS",
    defaultVoice: "ara",
    voices: ["ara", "eve", "rex", "sal", "leo"],
    pricePer1kCharsUsd: 0.015,
  },
];

export const DEFAULT_TTS_MODEL = "x-ai/grok-voice-tts-1.0";

export function getTtsModel(id: string): TtsModelInfo | undefined {
  return TTS_MODELS.find((m) => m.id === id);
}

/** Selectable voices for a TTS model (falls back to its default). */
export function ttsVoices(id: string): string[] {
  const m = getTtsModel(id);
  if (m?.voices?.length) return m.voices;
  return m?.defaultVoice ? [m.defaultVoice] : [];
}

// ----------------------------------------------------------------------------
// Product caps (enforced in Zod schemas AND the LLM output schema)

export const CAPS = {
  maxShots: 8, // max AI-generated shots per storyboard generation (cost guard)
  maxSegments: 30, // max total visual segments (AI + uploaded clips/photos)
  maxAudioOverlays: 8, // max audio overlays mixed over the final
  maxTextOverlays: 12, // max burned-in text overlays
  maxShotDurationS: 8,
  maxTotalDurationS: 60,
  minShots: 1,
  minShotDurationS: 2,
} as const;

export const ASPECT_RATIOS = {
  R16_9: "16:9",
  R9_16: "9:16",
  R1_1: "1:1",
} as const;

export const RESOLUTIONS = {
  R480P: "480p",
  R720P: "720p",
  R1080P: "1080p",
} as const;

/** Pixel dimensions for a given aspect ratio + resolution. */
export const FRAME_DIMENSIONS: Record<
  keyof typeof ASPECT_RATIOS,
  Record<keyof typeof RESOLUTIONS, { w: number; h: number }>
> = {
  R16_9: {
    R480P: { w: 854, h: 480 },
    R720P: { w: 1280, h: 720 },
    R1080P: { w: 1920, h: 1080 },
  },
  R9_16: {
    R480P: { w: 480, h: 854 },
    R720P: { w: 720, h: 1280 },
    R1080P: { w: 1080, h: 1920 },
  },
  R1_1: {
    R480P: { w: 480, h: 480 },
    R720P: { w: 720, h: 720 },
    R1080P: { w: 1080, h: 1080 },
  },
};
