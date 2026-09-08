/**
 * Linear loudness normalization of a finished render.
 *
 * ffmpeg's `loudnorm` in the render graph runs single-pass, which is a
 * *dynamic* processor: it lifts quiet passages (the music between narration
 * lines) and squeezes the voice-vs-music balance an editor set. A mixer
 * normalizes linearly: measure the integrated loudness of the mix, apply ONE
 * gain to hit the target, and only limit true peaks. That is what this does,
 * as a fast second pass over the rendered file (video stream copied, audio
 * re-encoded with the export profile's codec).
 */
import { spawn } from "node:child_process";
import { rename, unlink } from "node:fs/promises";
import path from "node:path";
import { measureLoudness } from "@/lib/audio/analyze";
import { ffmpegPath } from "./binary";
import type { EncoderProfile } from "./encoder";

export interface NormalizeResult {
  measuredLufs: number | null;
  measuredTruePeakDb: number | null;
  gainDb: number;
  limited: boolean;
  applied: boolean;
}

function run(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), ["-hide_banner", "-nostdin", ...args]);
    let stderr = "";
    proc.stdout.on("data", () => {});
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });
    proc.on("error", (e) => reject(new Error(`ffmpeg spawn failed: ${e.message}`)));
    proc.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

export async function normalizeLoudnessLinear(
  file: string,
  enc: EncoderProfile,
  opts: { targetLufs?: number; truePeakDb?: number } = {},
): Promise<NormalizeResult> {
  const target = opts.targetLufs ?? -14;
  const tpMax = opts.truePeakDb ?? -1.5;
  const m = await measureLoudness(file);
  if (m.integratedLufs == null || !Number.isFinite(m.integratedLufs) || m.integratedLufs < -60) {
    return { measuredLufs: m.integratedLufs, measuredTruePeakDb: m.truePeakDb, gainDb: 0, limited: false, applied: false };
  }
  const gainDb = +(target - m.integratedLufs).toFixed(2);
  const peakAfter = (m.truePeakDb ?? -99) + gainDb;
  const limited = peakAfter > tpMax;
  if (Math.abs(gainDb) < 0.3 && !limited) {
    return { measuredLufs: m.integratedLufs, measuredTruePeakDb: m.truePeakDb, gainDb: 0, limited: false, applied: false };
  }
  // alimiter caps sample peaks; true (inter-sample) peaks overshoot by up to
  // ~1 dB after encoding, so leave that headroom below the true-peak target.
  const limit = (10 ** ((tpMax - 1) / 20)).toFixed(4);
  const af = `volume=${gainDb}dB` + (limited ? `,alimiter=limit=${limit}:level=false:attack=5:release=50` : "");
  const tmp = path.join(path.dirname(file), `.norm-${path.basename(file)}`);
  const { code, stderr } = await run(["-y", "-i", file, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", af, ...enc.audioArgs, ...enc.containerArgs, tmp]);
  if (code !== 0) {
    await unlink(tmp).catch(() => {});
    throw new Error(`loudness normalization failed: ${stderr.slice(-600)}`);
  }
  await rename(tmp, file);
  return { measuredLufs: m.integratedLufs, measuredTruePeakDb: m.truePeakDb, gainDb, limited, applied: true };
}
