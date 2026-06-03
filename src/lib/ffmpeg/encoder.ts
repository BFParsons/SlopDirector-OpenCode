/**
 * Video-encoder profiles for the final assembly. SlopStudio runs on the user's
 * own machine, so it can encode on the CPU (libx264, works everywhere) OR offload
 * the encode to the GPU when the host supports it (NVENC / Intel QSV / VAAPI).
 *
 * The whole filter graph still runs on the CPU (scale, overlay, drawtext, …);
 * only the final ENCODE is offloaded — that's the expensive step. For GPU
 * encoders that consume device memory (VAAPI/QSV) the composited CPU frames are
 * uploaded with `format=nv12,hwupload` right before the encoder (see assemble.ts).
 */

import { env } from "@/env";

export type EncoderKind = "x264" | "vaapi" | "nvenc" | "qsv";

export interface EncoderProfile {
  kind: EncoderKind;
  label: string;
  /** true when the encode is offloaded to the GPU */
  hardware: boolean;
  /** global ffmpeg args placed BEFORE inputs (e.g. -vaapi_device, -init_hw_device) */
  deviceArgs: string[];
  /** append `format=nv12,hwupload` to the final video chain before mapping */
  needsHwUpload: boolean;
  /** the `-c:v …` output args (codec + rate control) */
  outputArgs: string[];
}

/** VAAPI render node; override with VAAPI_DEVICE if the host uses a different one. */
const VAAPI_DEVICE = env.VAAPI_DEVICE;

export interface EncoderOpts {
  /** quality target: maps to CRF (x264) / CQ (nvenc) / QP (vaapi) / global_quality (qsv). Lower = better. */
  quality?: number;
  /** CPU preset for libx264 (ultrafast…veryslow). Desktop can afford slower = smaller/better. */
  x264Preset?: string;
  /** NVENC preset (p1 fastest … p7 slowest/best). */
  nvencPreset?: string;
}

export function encoderProfile(kind: EncoderKind, opts: EncoderOpts = {}): EncoderProfile {
  const q = opts.quality ?? 20;
  switch (kind) {
    case "vaapi":
      return {
        kind,
        label: "VAAPI (GPU)",
        hardware: true,
        needsHwUpload: true,
        deviceArgs: ["-vaapi_device", VAAPI_DEVICE],
        // CQP keeps quality constant the way CRF does on x264.
        outputArgs: ["-c:v", "h264_vaapi", "-rc_mode", "CQP", "-qp", String(q + 2)],
      };
    case "nvenc":
      return {
        kind,
        label: "NVENC (GPU)",
        hardware: true,
        needsHwUpload: false, // NVENC ingests system-memory frames directly
        deviceArgs: [],
        outputArgs: [
          "-c:v",
          "h264_nvenc",
          "-preset",
          opts.nvencPreset ?? "p5",
          "-rc",
          "vbr",
          "-cq",
          String(q + 1),
          "-b:v",
          "0",
          "-pix_fmt",
          "yuv420p",
        ],
      };
    case "qsv":
      return {
        kind,
        label: "QSV (GPU)",
        hardware: true,
        needsHwUpload: true,
        deviceArgs: ["-init_hw_device", "qsv=hw", "-filter_hw_device", "hw"],
        outputArgs: ["-c:v", "h264_qsv", "-global_quality", String(q + 2), "-pix_fmt", "nv12"],
      };
    default:
      return {
        kind: "x264",
        label: "x264 (CPU)",
        hardware: false,
        needsHwUpload: false,
        deviceArgs: [],
        outputArgs: [
          "-c:v",
          "libx264",
          "-preset",
          opts.x264Preset ?? "medium",
          "-crf",
          String(q),
          "-pix_fmt",
          "yuv420p",
        ],
      };
  }
}

export const VAAPI_RENDER_NODE = VAAPI_DEVICE;
