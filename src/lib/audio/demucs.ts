/**
 * Demucs stem separation. Spawns the Python CLI, watches its progress on
 * stderr, and reports the produced stem files. Output layout from demucs is:
 *
 *   {outDir}/{model}/{trackBasename}/{vocals,drums,bass,other}.wav
 *
 * We move the stems up into the project's audio-studio folder and return their
 * portable relative paths.
 */
import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { demucsArgv } from "./binaries";
import { audioProjectDir, audioRelPath, newAudioFilename } from "./workspace";
import { updateJob } from "./jobs";

export interface DemucsStem {
  name: string; // "vocals" | "drums" | "bass" | "other" (or 2-stem names)
  relPath: string;
}

export interface DemucsOptions {
  /** htdemucs (default, 4-stem), htdemucs_6s (6-stem), mdx_extra, etc. */
  model?: string;
  /** "vocals" → produce only {vocals, no_vocals} (karaoke / accompaniment). */
  twoStems?: string | null;
}

const STEM_ORDER = ["vocals", "drums", "bass", "guitar", "piano", "other", "no_vocals"];

export async function runDemucs(
  projectId: string,
  inputAbs: string,
  opts: DemucsOptions,
  jobId: string,
): Promise<DemucsStem[]> {
  const model = opts.model?.trim() || "htdemucs";
  const projectRoot = audioProjectDir(projectId);
  const workDir = path.join(projectRoot, `.demucs-${jobId.slice(0, 8)}`);
  await mkdir(workDir, { recursive: true });

  const args = [...demucsArgv(), "-n", model, "-o", workDir];
  if (opts.twoStems) args.push("--two-stems", opts.twoStems);
  args.push(inputAbs);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(args[0], args.slice(1), { env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let stderr = "";
    const onData = (d: Buffer) => {
      const text = d.toString();
      stderr += text;
      // demucs renders a tqdm bar like " 42%|####  | ..."; grab the latest %.
      const matches = text.match(/(\d{1,3})%\|/g);
      if (matches && matches.length) {
        const last = matches[matches.length - 1];
        const pct = Number(last.replace(/%\|/, ""));
        if (Number.isFinite(pct)) updateJob(jobId, { progress: Math.min(0.99, pct / 100), message: `Separating… ${pct}%` });
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`demucs exited ${code}: ${stderr.slice(-600)}`));
    });
  });

  // Find the produced stems: workDir/<model>/<trackName>/*.wav
  const modelDir = path.join(workDir, model);
  const trackDirs = await readdir(modelDir, { withFileTypes: true }).catch(() => []);
  const stems: DemucsStem[] = [];
  for (const td of trackDirs) {
    if (!td.isDirectory()) continue;
    const stemDir = path.join(modelDir, td.name);
    const files = await readdir(stemDir).catch(() => []);
    for (const f of files) {
      if (!f.endsWith(".wav")) continue;
      const stemName = path.basename(f, ".wav");
      const dest = newAudioFilename(`stem-${stemName}.wav`);
      await copyFile(path.join(stemDir, f), path.join(projectRoot, dest));
      stems.push({ name: stemName, relPath: audioRelPath(projectId, dest) });
    }
  }

  await rm(workDir, { recursive: true, force: true });
  // Stable, musically sensible ordering.
  stems.sort((a, b) => STEM_ORDER.indexOf(a.name) - STEM_ORDER.indexOf(b.name));
  return stems;
}
