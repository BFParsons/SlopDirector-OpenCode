import { orFetch } from "./client";

export interface SynthesizeOpts {
  model: string;
  input: string;
  voice?: string;
  format?: "mp3" | "wav" | "pcm";
  /**
   * Delivery direction (pace, emotion, emphasis). Sent as the OpenAI-compatible
   * `instructions` param. NOTE: not all TTS models honor this — verify per model;
   * unsupported models simply ignore it (or 4xx, in which case the caller should
   * retry without it / inline the notes).
   */
  instructions?: string;
  /** Per-user OpenRouter key; falls back to the server key when omitted. */
  apiKey?: string;
}

/**
 * Text-to-speech via OpenRouter's OpenAI-compatible /audio/speech endpoint.
 * Returns the raw audio bytes (the endpoint streams audio, not JSON).
 */
export async function synthesizeSpeech(opts: SynthesizeOpts): Promise<Buffer> {
  const body: Record<string, unknown> = {
    model: opts.model,
    input: opts.input,
    response_format: opts.format ?? "mp3",
  };
  if (opts.voice) body.voice = opts.voice;
  if (opts.instructions && opts.instructions.trim())
    body.instructions = opts.instructions.trim();

  const res = await orFetch(
    "/audio/speech",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { apiKey: opts.apiKey },
  );

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("TTS returned empty audio");
  return buf;
}
