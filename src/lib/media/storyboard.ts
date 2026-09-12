/**
 * Storyboard sheet: one frame per shot of the main sequence (its in-point),
 * captioned with index, timeline start, length, sound decision and any title
 * card, tiled into a grid. The visual the person approves a cut from.
 */
import { spawn } from "node:child_process";
import { writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { ffmpegPath } from "@/lib/ffmpeg/binary";
import { ffQuote, FONT_BOLD } from "@/lib/ffmpeg/args";
import { cacheDir, frameAt } from "@/lib/media/inspect";

export type StoryboardCell = { abs: string; assetId: string; t: number; caption: string };

function run(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath(), ["-hide_banner", "-nostdin", "-loglevel", "error", ...args], { windowsHide: true });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", (e) => resolve({ code: -1, stderr: String(e) }));
    p.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

export async function storyboardSheet(projectId: string, cells: StoryboardCell[], cols = 4, cellW = 400): Promise<string> {
  if (!cells.length) throw new Error("no shots on the main sequence");
  const dir = await cacheDir(projectId);
  const W = Math.max(160, Math.round(cellW / 2) * 2);
  const H = Math.round((W * 9) / 16 / 2) * 2;
  const CAP = Math.max(28, Math.round(W / 18) * 2); // even: 4:2:0 cells and the filler cells must agree on the height
  const fs = Math.max(11, Math.round(W / 30));
  const rows = Math.ceil(cells.length / cols);
  // Frames first (cached per asset/time/width), a few at a time.
  const frames: string[] = new Array(cells.length);
  const queue = cells.map((c, i) => i);
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        const c = cells[i];
        frames[i] = await frameAt(c.abs, projectId, c.assetId, c.t, W);
      }
    }),
  );
  const stamp = Date.now();
  const inputs: string[] = [];
  const chains: string[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cap = path.join(dir, `sb-cap-${stamp}-${i}.txt`);
    await writeFile(cap, cells[i].caption.replace(/\r?\n/g, " "), "utf8");
    inputs.push("-i", frames[i]);
    chains.push(
      // one size, square pixels (archival sources carry odd SARs) and one pixel format per cell: concat wants uniform inputs, mjpeg wants yuvj
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1,format=yuvj420p,pad=${W}:${H + CAP}:(ow-iw)/2:0:color=0x141414,` +
        `drawtext=fontfile=${ffQuote(FONT_BOLD)}:textfile=${ffQuote(cap)}:expansion=none:fontsize=${fs}:fontcolor=white:x=8:y=${H + Math.round((CAP - fs) / 2)}[c${i}]`,
    );
  }
  // Pad the last row with black cells so tile gets a full grid.
  const pad = rows * cols - cells.length;
  const padLabels: string[] = [];
  for (let i = 0; i < pad; i++) {
    chains.push(`color=c=0x141414:s=${W}x${H + CAP}:d=1,format=yuvj420p[p${i}]`);
    padLabels.push(`[p${i}]`);
  }
  const graph = chains.join(";") + `;${cells.map((_, i) => `[c${i}]`).join("")}${padLabels.join("")}concat=n=${cells.length + pad}:v=1:a=0,tile=${cols}x${rows}:padding=6:margin=6:color=0x141414[out]`;
  const out = path.join(dir, `storyboard-${stamp}.jpg`);
  const tmp = `${out}.tmp.jpg`;
  const r = await run(["-y", ...inputs, "-filter_complex", graph, "-map", "[out]", "-frames:v", "1", "-pix_fmt", "yuvj420p", "-q:v", "3", tmp]);
  if (r.code !== 0) throw new Error(`storyboard tile failed: ${r.stderr.slice(-400)}`);
  await rename(tmp, out);
  return out;
}
