import { env } from "@/env";
import { DEFAULT_TTS_MODEL, TTS_MODELS, getTtsModel, type TtsModelInfo } from "@/config/models";
import { OpenRouterError } from "@/lib/openrouter/client";
import { synthesizeSpeech } from "@/lib/openrouter/tts";
import { conditionNarration, synthesizeElevenLabs } from "@/lib/tts/elevenlabs";

/**
 * One entry point for every narration take — the Voiceover panel, the
 * TTS_FROM_SCRIPT job and the MCP `generate_narration` tool all come here —
 * so the machine's default voice is decided in one place:
 *
 *   1. an explicit `ttsModel` / `voice` from the caller wins;
 *   2. otherwise `SLOPSTUDIO_TTS_MODEL` / `SLOPSTUDIO_TTS_VOICE` from .env;
 *   3. otherwise ElevenLabs when `ELEVENLABS_API_KEY` is set (voice from
 *      `ELEVENLABS_VOICE_ID`, else the catalogue's default), else Grok Voice
 *      through OpenRouter.
 *
 * A voice name that belongs to another provider (say Grok's "sal" while the
 * model is ElevenLabs) is not an error: the provider's default voice is used,
 * so an agent following an older style note still gets the house narrator.
 */
export interface NarrationRequest {
  ttsModel?: string | null;
  voice?: string | null;
  text: string;
  /** Delivery notes. Honoured by OpenAI-compatible models that accept `instructions`; ElevenLabs v3 is steered by the audio tag instead. */
  instructions?: string;
  /** Per-user OpenRouter key (ElevenLabs always uses the server's env key). */
  openRouterKey?: string;
}

export interface NarrationAudio {
  data: Buffer;
  mime: "audio/mpeg" | "audio/wav";
  ext: "mp3" | "wav";
  model: TtsModelInfo;
  voice: string;
}

export function defaultTtsModelId(): string {
  const fromEnv = env.SLOPSTUDIO_TTS_MODEL?.trim();
  if (fromEnv && getTtsModel(fromEnv)) return fromEnv;
  if (env.ELEVENLABS_API_KEY) {
    const el = TTS_MODELS.find((m) => m.provider === "elevenlabs");
    if (el) return el.id;
  }
  return DEFAULT_TTS_MODEL;
}

export function resolveTtsModel(id?: string | null): TtsModelInfo | undefined {
  const wanted = id?.trim();
  if (wanted) return getTtsModel(wanted);
  return getTtsModel(defaultTtsModelId());
}

const ELEVEN_VOICE_ID = /^[A-Za-z0-9]{16,32}$/;

export function resolveTtsVoice(model: TtsModelInfo, voice?: string | null): string {
  const v = voice?.trim();
  if (model.provider === "elevenlabs") {
    // Any ElevenLabs voice id is legal (the account may own voices the catalogue does not list).
    if (v && (model.voices.includes(v) || ELEVEN_VOICE_ID.test(v))) return v;
    const fromEnv = env.SLOPSTUDIO_TTS_VOICE?.trim() || env.ELEVENLABS_VOICE_ID?.trim();
    return fromEnv || model.defaultVoice || model.voices[0];
  }
  if (v && model.voices.includes(v)) return v;
  const fromEnv = env.SLOPSTUDIO_TTS_VOICE?.trim();
  if (fromEnv && model.voices.includes(fromEnv)) return fromEnv;
  return model.defaultVoice ?? model.voices[0] ?? "";
}

export async function synthesizeNarration(req: NarrationRequest): Promise<NarrationAudio> {
  const model = resolveTtsModel(req.ttsModel);
  if (!model) throw new Error(`Unknown voice model: ${req.ttsModel}`);
  const voice = resolveTtsVoice(model, req.voice);

  if (model.provider === "elevenlabs") {
    const raw = await synthesizeElevenLabs({ voiceId: voice, text: req.text });
    const wav = await conditionNarration(raw);
    return { data: wav, mime: "audio/wav", ext: "wav", model, voice };
  }

  const instructions = req.instructions?.trim() || undefined;
  let buf: Buffer;
  try {
    buf = await synthesizeSpeech({ model: model.id, input: req.text, voice, instructions, apiKey: req.openRouterKey });
  } catch (e) {
    // Not every model accepts `instructions`; retry once without it.
    if (instructions && e instanceof OpenRouterError && e.status >= 400 && e.status < 500) {
      buf = await synthesizeSpeech({ model: model.id, input: req.text, voice, apiKey: req.openRouterKey });
    } else {
      throw e;
    }
  }
  return { data: buf, mime: "audio/mpeg", ext: "mp3", model, voice };
}
