/**
 * Audio DSP "processing rack" — the enhanced-editing tools, all expressed as
 * ffmpeg `-af` filter fragments and applied in order. Pure functions build the
 * fragments; `applyChain` runs one ffmpeg pass that writes a new file.
 *
 * Each effect maps to a battle-tested ffmpeg filter:
 *   noise      → afftdn   (spectral noise reduction, no model file needed)
 *   loudness   → loudnorm (EBU R128 two-pass-quality single-pass normalize)
 *   eq         → bass/treble shelves + a peaking mid band
 *   deesser    → deesser
 *   compressor → acompressor
 *   gain       → volume
 *   fade       → afade in + afade out
 *   highpass   → highpass / lowpass roll-offs (rumble + hiss)
 *   rnnoise    → arnndn   (RNNoise neural noise suppression, bundled model)
 *   speechnorm → speechnorm (speech leveler: raises quiet passages, tames loud)
 * Plus standalone transforms: rubberband stretch (tempo / pitch, pitch-preserving)
 * and the audiogram renderer (waveform / spectrum video from a track).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { ffmpegPath } from "@/lib/ffmpeg/binary";
import { ffQuote } from "@/lib/ffmpeg/args";

/** Bundled RNNoise model (public/ so it ships in the standalone build). */
export function rnnoiseModelPath(model: "bd" | "sh" = "bd"): string {
  return path.join(process.cwd(), "public", "rnnoise", `${model}.rnnn`);
}

export interface NoiseEffect {
  type: "noise";
  /** 0..1 — mapped to afftdn noise-reduction in dB (more = stronger). */
  strength: number;
}
export interface LoudnessEffect {
  type: "loudness";
  /** integrated target in LUFS, e.g. -14 (social), -16 (podcast), -23 (broadcast). */
  targetLufs: number;
  truePeak?: number; // dBTP ceiling, default -1.5
}
export interface EqEffect {
  type: "eq";
  bassDb: number; // low shelf gain
  midDb: number; // peaking @ ~1.5kHz
  trebleDb: number; // high shelf gain
}
export interface DeesserEffect {
  type: "deesser";
  intensity: number; // 0..1
}
export interface CompressorEffect {
  type: "compressor";
  thresholdDb: number; // e.g. -18
  ratio: number; // e.g. 3
}
export interface GainEffect {
  type: "gain";
  db: number;
}
export interface FadeEffect {
  type: "fade";
  inS: number;
  outS: number;
  durationS: number; // total clip length, needed to place the out-fade
}
export interface RollOffEffect {
  type: "rolloff";
  highpassHz: number; // 0 = off (rumble cut)
  lowpassHz: number; // 0 = off (hiss cut)
}

export interface RnnoiseEffect {
  type: "rnnoise";
  /** 0..1 — how much of the denoised signal to use (1 = fully denoised). */
  mix: number;
  model?: "bd" | "sh";
}
export interface SpeechNormEffect {
  type: "speechnorm";
  /** 0..1 — how aggressively quiet speech is lifted. */
  strength: number;
}

export type AudioEffect =
  | NoiseEffect
  | LoudnessEffect
  | EqEffect
  | DeesserEffect
  | CompressorEffect
  | GainEffect
  | FadeEffect
  | RollOffEffect
  | RnnoiseEffect
  | SpeechNormEffect;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Build the ffmpeg filter fragment for a single effect (or null to skip). */
export function effectToFilter(fx: AudioEffect): string | null {
  switch (fx.type) {
    case "noise": {
      // afftdn nr is in dB (0..97). Map 0..1 → 6..40 dB of reduction.
      const nr = clamp(6 + fx.strength * 34, 0, 97).toFixed(1);
      return `afftdn=nr=${nr}:nf=-25`;
    }
    case "loudness": {
      const I = clamp(fx.targetLufs, -70, -5).toFixed(1);
      const TP = clamp(fx.truePeak ?? -1.5, -9, 0).toFixed(1);
      return `loudnorm=I=${I}:TP=${TP}:LRA=11`;
    }
    case "eq": {
      const parts: string[] = [];
      if (Math.abs(fx.bassDb) > 0.01) parts.push(`bass=g=${clamp(fx.bassDb, -24, 24).toFixed(1)}`);
      if (Math.abs(fx.midDb) > 0.01)
        parts.push(`equalizer=f=1500:t=q:w=1:g=${clamp(fx.midDb, -24, 24).toFixed(1)}`);
      if (Math.abs(fx.trebleDb) > 0.01) parts.push(`treble=g=${clamp(fx.trebleDb, -24, 24).toFixed(1)}`);
      return parts.length ? parts.join(",") : null;
    }
    case "deesser": {
      const i = clamp(fx.intensity, 0, 1).toFixed(2);
      return `deesser=i=${i}`;
    }
    case "compressor": {
      const th = clamp(fx.thresholdDb, -40, 0);
      // acompressor threshold is linear (0..1). 10^(dB/20).
      const lin = Math.pow(10, th / 20).toFixed(4);
      const ratio = clamp(fx.ratio, 1, 20).toFixed(1);
      return `acompressor=threshold=${lin}:ratio=${ratio}:attack=20:release=250:makeup=2`;
    }
    case "gain":
      return `volume=${clamp(fx.db, -40, 40).toFixed(2)}dB`;
    case "fade": {
      const parts: string[] = [];
      if (fx.inS > 0) parts.push(`afade=t=in:st=0:d=${clamp(fx.inS, 0, 30).toFixed(2)}`);
      if (fx.outS > 0 && fx.durationS > fx.outS) {
        parts.push(`afade=t=out:st=${(fx.durationS - fx.outS).toFixed(2)}:d=${clamp(fx.outS, 0, 30).toFixed(2)}`);
      }
      return parts.length ? parts.join(",") : null;
    }
    case "rolloff": {
      const parts: string[] = [];
      if (fx.highpassHz > 0) parts.push(`highpass=f=${clamp(fx.highpassHz, 20, 2000).toFixed(0)}`);
      if (fx.lowpassHz > 0) parts.push(`lowpass=f=${clamp(fx.lowpassHz, 1000, 20000).toFixed(0)}`);
      return parts.length ? parts.join(",") : null;
    }
    case "rnnoise": {
      // RNNoise wants 48 kHz mono-ish input; resample around it, keep layout.
      const mix = clamp(fx.mix, 0, 1).toFixed(2);
      return `aresample=48000,arnndn=m=${ffQuote(rnnoiseModelPath(fx.model ?? "bd"))}:mix=${mix}`;
    }
    case "speechnorm": {
      // expansion 3 (gentle) … 25 (aggressive); slow raise so it doesn't pump.
      const e = (3 + clamp(fx.strength, 0, 1) * 22).toFixed(1);
      return `speechnorm=e=${e}:r=0.0005:l=1`;
    }
    default:
      return null;
  }
}

export function buildFilterChain(effects: AudioEffect[]): string {
  return effects
    .map(effectToFilter)
    .filter((f): f is string => !!f)
    .join(",");
}

/** Apply a chain to `inputAbs`, writing a new file at `outputAbs`. */
export function applyChain(inputAbs: string, outputAbs: string, effects: AudioEffect[]): Promise<void> {
  const chain = buildFilterChain(effects);
  const args = ["-y", "-i", inputAbs];
  if (chain) args.push("-af", chain);
  // Always re-encode to a clean PCM/AAC-friendly wav so chained edits stay lossless.
  args.push("-c:a", "pcm_s16le", outputAbs);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg DSP failed (${code}): ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Sidechain ducking — drop the level of `musicAbs` whenever `keyAbs` (the
 * voiceover) is loud, then mix the two. Writes a single mixed file.
 */
export function duckMusicUnderVoice(
  musicAbs: string,
  voiceAbs: string,
  outputAbs: string,
  opts: { reductionDb?: number } = {},
): Promise<void> {
  const reduction = clamp(opts.reductionDb ?? 12, 3, 40);
  // sidechaincompress keyed by the voice, then amix voice back on top.
  const filter =
    `[0:a]aformat=channel_layouts=stereo[music];` +
    `[1:a]aformat=channel_layouts=stereo,asplit=2[vkey][vmix];` +
    `[music][vkey]sidechaincompress=threshold=0.05:ratio=${(reduction / 3).toFixed(1)}:attack=10:release=300[ducked];` +
    `[ducked][vmix]amix=inputs=2:duration=longest:dropout_transition=0[out]`;
  const args = ["-y", "-i", musicAbs, "-i", voiceAbs, "-filter_complex", filter, "-map", "[out]", "-c:a", "pcm_s16le", outputAbs];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg duck failed (${code}): ${stderr.slice(-500)}`))));
  });
}

/** Trim leading/trailing/internal silence with ffmpeg's silenceremove. */
export function trimSilence(
  inputAbs: string,
  outputAbs: string,
  opts: { thresholdDb?: number; minSilenceS?: number } = {},
): Promise<void> {
  const th = clamp(opts.thresholdDb ?? -40, -90, -10);
  const dur = clamp(opts.minSilenceS ?? 0.5, 0.1, 5);
  const filter =
    `silenceremove=start_periods=1:start_silence=0.1:start_threshold=${th}dB:` +
    `stop_periods=-1:stop_silence=${dur}:stop_threshold=${th}dB`;
  const args = ["-y", "-i", inputAbs, "-af", filter, "-c:a", "pcm_s16le", outputAbs];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg silence-trim failed (${code}): ${stderr.slice(-500)}`))));
  });
}

/**
 * Pitch-preserving time stretch and/or pitch shift with Rubber Band. tempo 2.0
 * = twice as fast (half as long); pitchSemitones shifts pitch without changing
 * speed. Writes a new PCM wav.
 */
export function stretchAudio(
  inputAbs: string,
  outputAbs: string,
  opts: { tempo?: number; pitchSemitones?: number },
): Promise<void> {
  const tempo = clamp(opts.tempo ?? 1, 0.25, 4);
  const semis = clamp(opts.pitchSemitones ?? 0, -24, 24);
  const pitch = Math.pow(2, semis / 12);
  const filter = `rubberband=tempo=${tempo.toFixed(4)}:pitch=${pitch.toFixed(4)}:transients=crisp`;
  const args = ["-y", "-i", inputAbs, "-af", filter, "-c:a", "pcm_s16le", outputAbs];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg stretch failed (${code}): ${stderr.slice(-500)}`))));
  });
}

export type AudiogramStyle = "waves" | "spectrum" | "bars";

/**
 * Render an "audiogram": the track's waveform / spectrum / frequency bars drawn
 * over a flat background, as an H.264 MP4 the length of the audio. Made for
 * podcast and social clips; the result can be pushed to the Media Bucket.
 */
export function renderAudiogram(
  inputAbs: string,
  outputAbs: string,
  opts: { style?: AudiogramStyle; width?: number; height?: number; color?: string; background?: string },
): Promise<void> {
  const w = Math.round(clamp(opts.width ?? 1280, 160, 4096) / 2) * 2;
  const h = Math.round(clamp(opts.height ?? 720, 90, 4096) / 2) * 2;
  const hex = (v: string | undefined, d: string) => (v && /^#?[0-9a-fA-F]{6}$/.test(v) ? `0x${v.replace("#", "")}` : d);
  const color = hex(opts.color, "0x2ec5c5");
  const bg = hex(opts.background, "0x0b0d12");
  const size = `${w}x${h}`;
  const viz =
    opts.style === "spectrum"
      ? `showspectrum=s=${size}:mode=combined:color=intensity:scale=log:slide=scroll:legend=0`
      : opts.style === "bars"
        ? `showfreqs=s=${size}:mode=bar:colors=${color}:fscale=log`
        : `showwaves=s=${size}:mode=cline:colors=${color}:rate=30:scale=sqrt`;
  const graph = `[0:a]${viz}[viz];[1:v][viz]overlay=format=auto:shortest=1[v]`;
  const args = [
    "-y",
    "-i", inputAbs,
    "-f", "lavfi", "-i", `color=c=${bg}:s=${size}:r=30`,
    "-filter_complex", graph,
    "-map", "[v]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
    outputAbs,
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg audiogram failed (${code}): ${stderr.slice(-500)}`))));
  });
}
