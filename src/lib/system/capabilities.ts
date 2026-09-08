/**
 * Host capability detection for SlopStudio.
 *
 * SlopStudio is meant to run anywhere — from a locked-down work laptop (CPU-only)
 * to a workstation with a strong GPU — and exploit whatever the machine has. At
 * startup we probe the host and derive:
 *   - which video encoder to use (validated hardware encode, else CPU x264)
 *   - how many renders/downloads to run in parallel
 *   - a coarse capability "tier" the UI can surface
 *
 * Detection spawns ffmpeg a few times, so the result is cached for the process.
 * OpenRouter stays the universal layer regardless of tier — local compute is
 * opportunistic, never required.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import { env } from "@/env";
import { ffmpegPath } from "@/lib/ffmpeg/binary";
import {
  type EncoderKind,
  type EncoderProfile,
  type VideoCodec,
  VIDEO_CODECS,
  VIDEO_CODEC_IDS,
  encoderName,
  encoderProfile,
} from "@/lib/ffmpeg/encoder";

export interface GpuInfo {
  vendor: "nvidia" | "amd" | "intel" | "unknown";
  name: string;
  vramGB: number | null; // only known for NVIDIA (via nvidia-smi)
}

export interface Capabilities {
  cores: number;
  totalMemGB: number;
  /** which h264 encoders ffmpeg lists (build-time availability) */
  encoders: Record<EncoderKind, boolean>;
  /** every video encoder name ffmpeg lists (for the other codecs) */
  encoderNames: string[];
  /** best hardware encoder that ACTUALLY works on this host (probe-validated) */
  validated: EncoderKind | null;
  hwaccels: string[];
  gpu: GpuInfo | null;
  /** 0 = CPU only · 1 = hardware encode works · 2 = strong discrete GPU */
  tier: 0 | 1 | 2;
}

function run(cmd: string, args: string[], timeoutMs = 8000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    let out = "";
    let p: ReturnType<typeof spawn>;
    try {
      p = spawn(cmd, args);
    } catch {
      resolve({ code: -1, out: "" });
      return;
    }
    const to = setTimeout(() => {
      p.kill("SIGKILL");
      resolve({ code: -1, out });
    }, timeoutMs);
    p.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    p.stderr?.on("data", (d: Buffer) => (out += d.toString()));
    p.on("error", () => {
      clearTimeout(to);
      resolve({ code: -1, out });
    });
    p.on("close", (code) => {
      clearTimeout(to);
      resolve({ code: code ?? -1, out });
    });
  });
}

async function listEncoders(): Promise<{ h264: Record<EncoderKind, boolean>; names: string[] }> {
  const { out } = await run(ffmpegPath(), ["-hide_banner", "-encoders"]);
  // Lines look like " V....D libx264              libx264 H.264 / AVC ..."; take the name.
  const names = out
    .split("\n")
    .map((l) => /^\s*[VAS][.A-Z]{5}\s+(\S+)/.exec(l)?.[1])
    .filter((n): n is string => !!n);
  const has = (n: string) => names.includes(n);
  return {
    h264: { x264: has("libx264"), vaapi: has("h264_vaapi"), nvenc: has("h264_nvenc"), qsv: has("h264_qsv") },
    names,
  };
}

async function listHwaccels(): Promise<string[]> {
  const { out } = await run(ffmpegPath(), ["-hide_banner", "-hwaccels"]);
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !/hardware acceleration/i.test(s));
}

async function detectGpu(): Promise<GpuInfo | null> {
  // NVIDIA first — nvidia-smi gives us name + VRAM, which gates the tier-2 path.
  const smi = await run(
    "nvidia-smi",
    ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
    4000,
  );
  if (smi.code === 0 && smi.out.trim()) {
    const [name, mem] = smi.out.trim().split("\n")[0].split(",").map((s) => s.trim());
    const vram = Number(mem);
    return { vendor: "nvidia", name, vramGB: Number.isFinite(vram) ? Math.round(vram / 1024) : null };
  }
  // Linux fallback: lspci gives vendor/name (no VRAM).
  if (process.platform === "linux") {
    const { out, code } = await run("sh", ["-c", "lspci | grep -iE 'vga|3d|display'"], 4000);
    if (code === 0 && out.trim()) {
      const line = out.trim().split("\n")[0];
      const vendor = /nvidia/i.test(line)
        ? "nvidia"
        : /amd|ati|radeon/i.test(line)
          ? "amd"
          : /intel/i.test(line)
            ? "intel"
            : "unknown";
      return { vendor, name: line.replace(/^.*controller:\s*/i, "").trim(), vramGB: null };
    }
  }
  return null;
}

/**
 * Validate a hardware encoder by actually encoding a tiny clip the same way the
 * real pipeline will (device args + hwupload + the profile's output args). A
 * listed encoder that can't open its device (headless box, missing driver, no
 * render node) fails here and we fall back to CPU.
 */
async function validateEncoder(kind: EncoderKind, codec: VideoCodec = "h264"): Promise<boolean> {
  if (kind === "x264") return true;
  if (!encoderName(codec, kind)) return false;
  const prof = encoderProfile(kind, { codec });
  if (kind === "vaapi") {
    const dev = prof.deviceArgs[1];
    if (!dev || !existsSync(dev)) return false;
  }
  const vf = prof.needsHwUpload ? ["-vf", "format=nv12,hwupload"] : [];
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    ...prof.deviceArgs,
    "-f",
    "lavfi",
    // 128x128 minimum: VAAPI rejects smaller frames (constraints: width 128-4096).
    "-i",
    "color=black:s=128x128:d=0.2:r=5",
    ...vf,
    ...prof.outputArgs,
    "-f",
    "null",
    "-",
  ];
  const { code } = await run(ffmpegPath(), args, 12000);
  return code === 0;
}

// Each (codec, backend) pair is validated at most once per process.
const validationCache = new Map<string, Promise<boolean>>();
function validated(kind: EncoderKind, codec: VideoCodec): Promise<boolean> {
  const key = `${codec}/${kind}`;
  let p = validationCache.get(key);
  if (!p) {
    p = validateEncoder(kind, codec);
    validationCache.set(key, p);
  }
  return p;
}

let cached: Promise<Capabilities> | null = null;

/** Detect (and cache) host capabilities for this process. */
export function getCapabilities(): Promise<Capabilities> {
  if (!cached) cached = detect();
  return cached;
}

async function detect(): Promise<Capabilities> {
  const cores = os.cpus().length || 1;
  const totalMemGB = Math.max(1, Math.round(os.totalmem() / 1024 ** 3));
  const [enc, hwaccels, gpu] = await Promise.all([
    listEncoders(),
    listHwaccels(),
    detectGpu(),
  ]);
  const encoders = enc.h264;

  // Validate hardware encoders in preference order; first that works wins.
  const order: EncoderKind[] = ["nvenc", "qsv", "vaapi"];
  let validated: EncoderKind | null = null;
  for (const k of order) {
    if (encoders[k] && (await validateEncoder(k))) {
      validated = k;
      break;
    }
  }

  let tier: 0 | 1 | 2 = validated ? 1 : 0;
  if (gpu?.vendor === "nvidia" && (gpu.vramGB ?? 0) >= 6) tier = 2;

  return { cores, totalMemGB, encoders, encoderNames: enc.names, validated, hwaccels, gpu, tier };
}

// ---------------------------------------------------------------------------
// Derived runtime config (env overrides always win)
// ---------------------------------------------------------------------------

export type EncoderChoice = "auto" | EncoderKind;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Resolve the encoder for `codec`: the `VIDEO_ENCODER` backend override if it
 * validates for this codec, else the best validated hardware backend (the one
 * that already passed for H.264 is tried first), else the CPU encoder. Throws
 * when this ffmpeg build has no encoder for the codec at all.
 */
export async function resolveEncoder(codec: VideoCodec = "h264"): Promise<EncoderProfile> {
  const choice = ((env.VIDEO_ENCODER as EncoderChoice) || "auto").toLowerCase() as EncoderChoice;
  const caps = await getCapabilities();
  const opts = { x264Preset: env.X264_PRESET, quality: env.RENDER_QUALITY, codec };
  const listed = (k: EncoderKind) => {
    const n = encoderName(codec, k);
    return !!n && caps.encoderNames.includes(n);
  };
  const hwOk = async (k: EncoderKind) => k !== "x264" && listed(k) && (await validated(k, codec));

  if (choice !== "auto") {
    if (choice === "x264") {
      if (listed("x264")) return encoderProfile("x264", opts);
    } else if (await hwOk(choice)) {
      return encoderProfile(choice, opts);
    }
    // Override can't do this codec → fall through to auto.
  }
  const order = [...(caps.validated ? [caps.validated] : []), "nvenc", "qsv", "vaapi"] as EncoderKind[];
  for (const k of order.filter((k, i, a) => a.indexOf(k) === i)) {
    if (await hwOk(k)) return encoderProfile(k, opts);
  }
  if (listed("x264")) return encoderProfile("x264", opts);
  throw new Error(`This ffmpeg build has no encoder for ${VIDEO_CODECS[codec].label}`);
}

export interface ExportFormatInfo {
  codec: VideoCodec;
  label: string;
  container: string;
  ext: string;
  blurb: string;
  /** some encoder (CPU or GPU) can produce it on this host */
  available: boolean;
  /** the validated hardware backend, if any */
  hardware: EncoderKind | null;
}

/** Per-codec availability on this host (drives the Export dialog's format picker). */
export async function exportFormats(): Promise<ExportFormatInfo[]> {
  const caps = await getCapabilities();
  const out: ExportFormatInfo[] = [];
  for (const codec of VIDEO_CODEC_IDS) {
    const info = VIDEO_CODECS[codec];
    const listed = (k: EncoderKind) => {
      const n = encoderName(codec, k);
      return !!n && caps.encoderNames.includes(n);
    };
    let hardware: EncoderKind | null = null;
    const order = [...(caps.validated ? [caps.validated] : []), "nvenc", "qsv", "vaapi"] as EncoderKind[];
    for (const k of order.filter((k, i, a) => a.indexOf(k) === i)) {
      if (listed(k) && (await validated(k, codec))) {
        hardware = k;
        break;
      }
    }
    out.push({
      codec,
      label: info.label,
      container: info.container,
      ext: info.ext,
      blurb: info.blurb,
      available: hardware !== null || listed("x264"),
      hardware,
    });
  }
  return out;
}

/**
 * Resolve render/download concurrency from the host. Hardware encode offloads the
 * heavy step, so more assemblies can run at once. `MAX_CONCURRENT_*` env vars
 * override. RAM gates assembly (each render needs ~1–2 GB).
 */
export async function resolveConcurrency(): Promise<{
  assembly: number;
  video: number;
  overall: number;
}> {
  const caps = await getCapabilities();
  const envInt = (n: string) => (process.env[n] ? Math.max(1, Math.floor(Number(process.env[n]))) : null);
  const hw = !!caps.validated;

  const suggestedAssembly = clamp(Math.floor(caps.cores / (hw ? 3 : 4)), 1, hw ? 6 : 4);
  // Each assembly wants ~1–2 GB; the desktop shell (Electron + Chromium + this
  // server) needs ~4 GB of its own, so budget renders from what's left. An
  // 8 GB laptop renders one at a time; 16 GB allows a few in parallel.
  const ramGate = Math.max(1, Math.floor((caps.totalMemGB - 4) / 2));
  const assembly = envInt("MAX_CONCURRENT_ASSEMBLY") ?? Math.min(suggestedAssembly, ramGate);
  const video = envInt("MAX_CONCURRENT_VIDEO") ?? clamp(Math.floor(caps.cores / 2), 2, 8);
  const overall = Math.max(6, assembly + video + 2);
  return { assembly, video, overall };
}
