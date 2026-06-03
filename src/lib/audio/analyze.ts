/**
 * Read-only analysis passes used by the Loudness Meter and Audio Tools panels:
 *   measureLoudness → integrated LUFS / true-peak / loudness range (ffmpeg)
 *   detectSilence   → list of silent spans (ffmpeg silencedetect)
 *   detectTempo     → BPM + beat grid (librosa)
 */
import { spawn } from "node:child_process";
import { ffmpegPath } from "@/lib/ffmpeg/binary";
import { python } from "./binaries";

export interface LoudnessReport {
  integratedLufs: number | null;
  truePeakDb: number | null;
  loudnessRange: number | null;
  thresholdLufs: number | null;
}

/** Run ffmpeg's loudnorm in analysis mode and parse its JSON summary. */
export function measureLoudness(inputAbs: string): Promise<LoudnessReport> {
  const args = [
    "-hide_banner", "-nostats", "-i", inputAbs,
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
    "-f", "null", "-",
  ];
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", () => resolve(empty()));
    proc.on("close", () => {
      // loudnorm prints a JSON block near the end of stderr.
      const start = stderr.lastIndexOf("{");
      const end = stderr.lastIndexOf("}");
      if (start === -1 || end === -1 || end < start) return resolve(empty());
      try {
        const j = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
        resolve({
          integratedLufs: num(j.input_i),
          truePeakDb: num(j.input_tp),
          loudnessRange: num(j.input_lra),
          thresholdLufs: num(j.input_thresh),
        });
      } catch {
        resolve(empty());
      }
    });
  });
}

function empty(): LoudnessReport {
  return { integratedLufs: null, truePeakDb: null, loudnessRange: null, thresholdLufs: null };
}
function num(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface SilenceSpan {
  startS: number;
  endS: number;
}

/** Detect silent spans below `thresholdDb` lasting at least `minS` seconds. */
export function detectSilence(
  inputAbs: string,
  opts: { thresholdDb?: number; minS?: number } = {},
): Promise<SilenceSpan[]> {
  const th = opts.thresholdDb ?? -40;
  const min = opts.minS ?? 0.5;
  const args = ["-hide_banner", "-nostats", "-i", inputAbs, "-af", `silencedetect=noise=${th}dB:d=${min}`, "-f", "null", "-"];
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath(), args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", () => resolve([]));
    proc.on("close", () => {
      const spans: SilenceSpan[] = [];
      let pendingStart: number | null = null;
      for (const line of stderr.split("\n")) {
        const s = line.match(/silence_start:\s*(-?[\d.]+)/);
        if (s) pendingStart = Number(s[1]);
        const e = line.match(/silence_end:\s*(-?[\d.]+)/);
        if (e && pendingStart != null) {
          spans.push({ startS: pendingStart, endS: Number(e[1]) });
          pendingStart = null;
        }
      }
      resolve(spans);
    });
  });
}

export interface TempoReport {
  bpm: number | null;
  beatsS: number[];
}

/**
 * Estimate tempo + beat positions with librosa. Runs a tiny inline script so we
 * don't ship a separate .py file; output is a single JSON line on stdout.
 */
export function detectTempo(inputAbs: string): Promise<TempoReport> {
  const script = `
import sys, json, warnings
warnings.filterwarnings("ignore")
import librosa
y, sr = librosa.load(sys.argv[1], mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
times = librosa.frames_to_time(beats, sr=sr)
bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
print(json.dumps({"bpm": round(bpm, 1), "beatsS": [round(float(t), 3) for t in times]}))
`;
  return new Promise((resolve) => {
    const proc = spawn(python(), ["-c", script, inputAbs]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", () => resolve({ bpm: null, beatsS: [] }));
    proc.on("close", () => {
      try {
        const line = stdout.trim().split("\n").pop() ?? "";
        const j = JSON.parse(line) as TempoReport;
        resolve({ bpm: j.bpm ?? null, beatsS: Array.isArray(j.beatsS) ? j.beatsS : [] });
      } catch {
        resolve({ bpm: null, beatsS: [] });
      }
    });
  });
}
