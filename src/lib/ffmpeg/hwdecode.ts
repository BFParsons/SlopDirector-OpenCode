/**
 * Hardware (VA-API) decode for export inputs.
 *
 * Exports decode every source clip on the CPU and only touch the GPU for the
 * final encode (`format=nv12,hwupload` → h264_vaapi). Measured on an Intel
 * UHD 620: VA-API decodes 4K HEVC 3.5× faster than the CPU — but copying the
 * decoded 4K frames back to system memory costs as much as the decode saved,
 * so "GPU decode, then download" is a wash (or a loss at 1080p). The win only
 * materialises when the frames stay on the GPU long enough to be *downscaled*
 * there: a 4K → 1080p export moves 4× fewer pixels across the bus and ran
 * 1.85× faster end-to-end (4.5 s vs 8.4 s for a 6 s clip).
 *
 * 10-bit HEVC (phone / camera HDR and log footage) is the other case: the CPU
 * decodes an 80 Mbps 4K Main10 clip at ~10 fps, so the GPU wins even without
 * a downscale (4K → 4K: 10.1 s vs 15.6 s; 4K → 1080p: 3.9 s vs 13.5 s).
 *
 * So the plan per input is: when the host validated VA-API decode for the
 * codec/bit-depth AND (the source is 10-bit OR much larger than the export
 * frame) AND no source-stage effect (deinterlace / stabilize / tone-map) needs
 * the raw frames, decode on the GPU, `scale_vaapi` down to fit the frame
 * (10-bit → nv12 there too), download, and hand the frames to the unchanged
 * CPU filter graph (LUT, captions, effects, transitions). Everything else keeps
 * CPU decode. Chroma formats VA-API can't decode (4:2:2, 4:4:4) stay on the CPU
 * — with `-hwaccel_output_format vaapi` a failed hwaccel setup would break the
 * graph instead of falling back.
 */
import type { EffectSpec } from "@/lib/render/effects";

/** Probe keys: codec (+ bit depth) the startup probe validates with a real test decode. */
export const VAAPI_DECODE_CODECS = ["h264", "hevc", "hevc10"] as const;
export type HwDecodeKey = (typeof VAAPI_DECODE_CODECS)[number];

/** 4:2:0 pixel formats VA-API decodes on Intel/AMD; anything else stays on the CPU. */
const PIXFMT_8BIT = new Set(["yuv420p", "yuvj420p", "nv12"]);
const PIXFMT_10BIT = new Set(["yuv420p10le", "p010le"]);

/** The probe key a source stream needs, or null when VA-API can't take it. */
export function hwDecodeKey(stream: VideoStreamInfo): HwDecodeKey | null {
  if (stream.codec === "h264") return PIXFMT_8BIT.has(stream.pixFmt) ? "h264" : null;
  if (stream.codec === "hevc") {
    if (PIXFMT_8BIT.has(stream.pixFmt)) return "hevc";
    if (PIXFMT_10BIT.has(stream.pixFmt)) return "hevc10";
  }
  return null;
}

/** Source must have at least this many times the export frame's pixels. */
export const HW_DECODE_MIN_DOWNSCALE = 1.5;

export interface HwDecodeConfig {
  backend: "vaapi";
  /** render node, e.g. /dev/dri/renderD128 */
  device: string;
  /** probe keys (h264 / hevc / hevc10) this host validated hardware decode for */
  codecs: string[];
}

export interface VideoStreamInfo {
  codec: string;
  width: number;
  height: number;
  pixFmt: string;
}

export interface HwDecodePlan {
  /** ffmpeg *input* options — place them immediately before that input's `-i` */
  inputArgs: string[];
  /** filter chain to run on `[N:v]` before the CPU graph (ends with a CPU nv12 frame) */
  filterPrefix: string;
}

export function planHwDecode(
  cfg: HwDecodeConfig | null | undefined,
  stream: VideoStreamInfo | null,
  target: { w: number; h: number },
  opts: { sourceEffects?: EffectSpec[] | boolean } = {},
): HwDecodePlan | null {
  if (!cfg || !stream) return null;
  const key = hwDecodeKey(stream);
  if (!key || !cfg.codecs.includes(key)) return null;
  if (!(stream.width > 0 && stream.height > 0)) return null;
  const sourceFx = Array.isArray(opts.sourceEffects) ? opts.sourceEffects.length > 0 : !!opts.sourceEffects;
  if (sourceFx) return null;
  const heavy = key === "hevc10";
  const downscale = stream.width * stream.height >= target.w * target.h * HW_DECODE_MIN_DOWNSCALE;
  if (!heavy && !downscale) return null;
  return {
    inputArgs: ["-hwaccel", cfg.backend, "-hwaccel_device", cfg.device, "-hwaccel_output_format", cfg.backend],
    // Fit inside the frame on the GPU (aspect kept; the CPU normalize step still
    // pads/letterboxes exactly), convert 10-bit → nv12 there too, then download.
    filterPrefix:
      `scale_vaapi=w=${target.w}:h=${target.h}:force_original_aspect_ratio=decrease:force_divisible_by=2:format=nv12,` +
      `hwdownload,format=nv12`,
  };
}
