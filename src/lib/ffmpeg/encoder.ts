/**
 * Video-encoder profiles for the final assembly. SlopStudio runs on the user's
 * own machine, so it can encode on the CPU (libx264 & friends, work everywhere)
 * OR offload the encode to the GPU when the host supports it (NVENC / Intel QSV
 * / VAAPI).
 *
 * Two axes: the CODEC the user picked for the export (H.264, HEVC, AV1, VP9,
 * ProRes — each implies a container + audio codec) and the BACKEND that encodes
 * it (CPU or a hardware engine). `encoderName()` says which ffmpeg encoder
 * implements a (codec, backend) pair; the capability probe validates it.
 *
 * The whole filter graph still runs on the CPU (scale, overlay, drawtext, …);
 * only the final ENCODE is offloaded — that's the expensive step. For GPU
 * encoders that consume device memory (VAAPI/QSV) the composited CPU frames are
 * uploaded with `format=nv12,hwupload` right before the encoder (see assemble.ts).
 */

import { env } from "@/env";

/** Encoding backend. "x264" is the historical name for the CPU backend. */
export type EncoderKind = "x264" | "vaapi" | "nvenc" | "qsv";
export type VideoCodec = "h264" | "hevc" | "av1" | "vp9" | "prores";
export type Container = "mp4" | "webm" | "mov";

export interface CodecInfo {
  codec: VideoCodec;
  label: string;
  container: Container;
  ext: string;
  mime: string;
  blurb: string;
}

export const VIDEO_CODECS: Record<VideoCodec, CodecInfo> = {
  h264: {
    codec: "h264",
    label: "H.264 · MP4",
    container: "mp4",
    ext: "mp4",
    mime: "video/mp4",
    blurb: "Plays everywhere. The safe default.",
  },
  hevc: {
    codec: "hevc",
    label: "HEVC (H.265) · MP4",
    container: "mp4",
    ext: "mp4",
    mime: "video/mp4",
    blurb: "~40% smaller than H.264 at the same quality — ideal for 4K. Apple and modern players.",
  },
  av1: {
    codec: "av1",
    label: "AV1 · MP4",
    container: "mp4",
    ext: "mp4",
    mime: "video/mp4",
    blurb: "Best compression for YouTube and the web. Slow to encode without a recent GPU.",
  },
  vp9: {
    codec: "vp9",
    label: "VP9 · WebM",
    container: "webm",
    ext: "webm",
    mime: "video/webm",
    blurb: "Open web format with Opus audio. Good for browsers and embeds.",
  },
  prores: {
    codec: "prores",
    label: "ProRes 422 HQ · MOV",
    container: "mov",
    ext: "mov",
    mime: "video/quicktime",
    blurb: "Editing intermediate for Premiere, Resolve and Final Cut. Very large files.",
  },
};

export const VIDEO_CODEC_IDS = Object.keys(VIDEO_CODECS) as VideoCodec[];

export function isVideoCodec(v: unknown): v is VideoCodec {
  return typeof v === "string" && v in VIDEO_CODECS;
}

/** The ffmpeg encoder implementing `codec` on `kind`, or null if no such pair. */
export function encoderName(codec: VideoCodec, kind: EncoderKind): string | null {
  const table: Record<VideoCodec, Record<EncoderKind, string | null>> = {
    h264: { x264: "libx264", vaapi: "h264_vaapi", nvenc: "h264_nvenc", qsv: "h264_qsv" },
    hevc: { x264: "libx265", vaapi: "hevc_vaapi", nvenc: "hevc_nvenc", qsv: "hevc_qsv" },
    av1: { x264: "libsvtav1", vaapi: "av1_vaapi", nvenc: "av1_nvenc", qsv: "av1_qsv" },
    // VP9 hardware encoders are rare and poorly validated — CPU only.
    vp9: { x264: "libvpx-vp9", vaapi: null, nvenc: null, qsv: null },
    prores: { x264: "prores_ks", vaapi: null, nvenc: null, qsv: null },
  };
  return table[codec][kind];
}

export interface EncoderProfile {
  kind: EncoderKind;
  codec: VideoCodec;
  container: Container;
  ext: string;
  mime: string;
  label: string;
  /** true when the encode is offloaded to the GPU */
  hardware: boolean;
  /** global ffmpeg args placed BEFORE inputs (e.g. -vaapi_device, -init_hw_device) */
  deviceArgs: string[];
  /** append `format=nv12,hwupload` to the final video chain before mapping */
  needsHwUpload: boolean;
  /** the `-c:v …` output args (codec + rate control) */
  outputArgs: string[];
  /** the `-c:a …` args matching the container */
  audioArgs: string[];
  /** container-level args (e.g. -movflags +faststart) */
  containerArgs: string[];
}

/** VAAPI render node; override with VAAPI_DEVICE if the host uses a different one. */
const VAAPI_DEVICE = env.VAAPI_DEVICE;

export interface EncoderOpts {
  /** which codec to produce (default h264) */
  codec?: VideoCodec;
  /** quality target: maps to CRF (x264/x265) / CQ (nvenc) / QP (vaapi) / global_quality (qsv). Lower = better. */
  quality?: number;
  /** CPU preset for libx264/libx265 (ultrafast…veryslow). Desktop can afford slower = smaller/better. */
  x264Preset?: string;
  /** NVENC preset (p1 fastest … p7 slowest/best). */
  nvencPreset?: string;
}

function audioArgsFor(container: Container): string[] {
  switch (container) {
    case "webm":
      return ["-c:a", "libopus", "-b:a", "160k"];
    case "mov":
      return ["-c:a", "pcm_s16le"]; // ProRes workflows expect uncompressed audio
    default:
      return ["-c:a", "aac", "-b:a", "192k"];
  }
}

function containerArgsFor(container: Container): string[] {
  return container === "webm" ? [] : ["-movflags", "+faststart"];
}

function videoArgs(codec: VideoCodec, kind: EncoderKind, opts: EncoderOpts): string[] {
  const q = opts.quality ?? 20;
  const preset = opts.x264Preset ?? "medium";
  const nv = opts.nvencPreset ?? "p5";
  const name = encoderName(codec, kind);
  if (!name) throw new Error(`no ${codec} encoder on the ${kind} backend`);
  switch (codec) {
    case "h264":
      switch (kind) {
        case "vaapi":
          // CQP keeps quality constant the way CRF does on x264.
          return ["-c:v", name, "-rc_mode", "CQP", "-qp", String(q + 2)];
        case "nvenc":
          return ["-c:v", name, "-preset", nv, "-rc", "vbr", "-cq", String(q + 1), "-b:v", "0", "-pix_fmt", "yuv420p"];
        case "qsv":
          return ["-c:v", name, "-global_quality", String(q + 2), "-pix_fmt", "nv12"];
        default:
          return ["-c:v", name, "-preset", preset, "-crf", String(q), "-pix_fmt", "yuv420p"];
      }
    case "hevc": {
      // hvc1 tag: what Apple players / QuickTime expect in MP4.
      const tag = ["-tag:v", "hvc1"];
      switch (kind) {
        case "vaapi":
          return ["-c:v", name, "-rc_mode", "CQP", "-qp", String(q + 2), ...tag];
        case "nvenc":
          return ["-c:v", name, "-preset", nv, "-rc", "vbr", "-cq", String(q + 1), "-b:v", "0", "-pix_fmt", "yuv420p", ...tag];
        case "qsv":
          return ["-c:v", name, "-global_quality", String(q + 2), "-pix_fmt", "nv12", ...tag];
        default:
          return ["-c:v", name, "-preset", preset, "-crf", String(q + 2), "-pix_fmt", "yuv420p", "-x265-params", "log-level=error", ...tag];
      }
    }
    case "av1":
      switch (kind) {
        case "vaapi":
          return ["-c:v", name, "-rc_mode", "CQP", "-qp", String(Math.min(255, q * 5))];
        case "nvenc":
          return ["-c:v", name, "-preset", nv, "-rc", "vbr", "-cq", String(q + 1), "-b:v", "0"];
        case "qsv":
          return ["-c:v", name, "-global_quality", String(q + 2)];
        default:
          // SVT-AV1: preset 8 is the speed/quality sweet spot on a laptop CPU.
          return ["-c:v", name, "-preset", "8", "-crf", String(Math.round(q * 1.5)), "-pix_fmt", "yuv420p"];
      }
    case "vp9":
      return ["-c:v", name, "-crf", String(q + 10), "-b:v", "0", "-row-mt", "1", "-cpu-used", "2", "-deadline", "good", "-pix_fmt", "yuv420p"];
    case "prores":
      // Profile 3 = 422 HQ, 10-bit.
      return ["-c:v", name, "-profile:v", "3", "-vendor", "apl0", "-pix_fmt", "yuv422p10le", "-qscale:v", "9"];
  }
}

export function encoderProfile(kind: EncoderKind, opts: EncoderOpts = {}): EncoderProfile {
  const codec = opts.codec ?? "h264";
  const info = VIDEO_CODECS[codec];
  const base = {
    codec,
    container: info.container,
    ext: info.ext,
    mime: info.mime,
    outputArgs: videoArgs(codec, kind, opts),
    audioArgs: audioArgsFor(info.container),
    containerArgs: containerArgsFor(info.container),
  };
  switch (kind) {
    case "vaapi":
      return { ...base, kind, label: "VAAPI (GPU)", hardware: true, needsHwUpload: true, deviceArgs: ["-vaapi_device", VAAPI_DEVICE] };
    case "nvenc":
      return { ...base, kind, label: "NVENC (GPU)", hardware: true, needsHwUpload: false, deviceArgs: [] }; // NVENC ingests system-memory frames directly
    case "qsv":
      return {
        ...base,
        kind,
        label: "QSV (GPU)",
        hardware: true,
        needsHwUpload: true,
        deviceArgs: ["-init_hw_device", "qsv=hw", "-filter_hw_device", "hw"],
      };
    default:
      return { ...base, kind: "x264", label: "CPU", hardware: false, needsHwUpload: false, deviceArgs: [] };
  }
}

export const VAAPI_RENDER_NODE = VAAPI_DEVICE;
