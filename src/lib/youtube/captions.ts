import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type CaptionCue = { startS: number; endS: number; text: string };
export type CaptionTrack = { videoId: string; lang: string; auto: boolean; cues: CaptionCue[]; durationS: number | null; title: string | null };

const t2s = (t: string) => {
  const m = /^(\d+):(\d+):(\d+)[.,](\d+)$/.exec(t.trim()) ?? /^(\d+):(\d+)[.,](\d+)$/.exec(t.trim());
  if (!m) return NaN;
  return m.length === 5 ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000 : Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 1000;
};

/** Parse WebVTT into cues; YouTube auto-captions repeat lines with word-level tags — strip tags, drop duplicates. */
export function parseVtt(vtt: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let last = "";
  for (const block of vtt.split(/\n\n+/)) {
    const lines = block.split("\n").filter((l) => l.trim());
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split("-->").map((x) => x.trim().split(" ")[0]);
    const text = lines
      .slice(ti + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/\s+/g, " ")
      .trim();
    const startS = t2s(a);
    const endS = t2s(b);
    if (!text || !Number.isFinite(startS) || !Number.isFinite(endS) || text === last) continue;
    last = text;
    cues.push({ startS: +startS.toFixed(2), endS: +endS.toFixed(2), text });
  }
  return cues;
}

/**
 * The video's caption track (manual if present, else YouTube's auto-captions)
 * with timings — no media download. A scout uses it to find the second a
 * sentence is spoken, then imports a short window around it.
 */
export function fetchCaptions(url: string, lang = "en", timeoutMs = 90_000): Promise<CaptionTrack> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const dir = await mkdtemp(path.join(tmpdir(), "yt-caps-"));
      // --print implies --simulate (no files written) unless --no-simulate is given.
      const args = ["--skip-download", "--no-simulate", "--write-subs", "--write-auto-subs", "--sub-langs", `${lang}.*,${lang}`, "--sub-format", "vtt", "--no-warnings", "--quiet", "--print", "%(id)s\t%(duration)s\t%(title)s", "-o", path.join(dir, "cap"), url];
      const proc = spawn("yt-dlp", args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error(`caption fetch timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
      proc.stdout.on("data", (d) => (out += d.toString()));
      proc.stderr.on("data", (d) => (err += d.toString()));
      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      proc.on("close", async (code) => {
        clearTimeout(timer);
        try {
          const files = (await readdir(dir)).filter((f) => f.endsWith(".vtt"));
          const [videoId, durationS, title] = out.trim().split("\n").pop()?.split("\t") ?? ["", "", ""];
          if (!files.length) return reject(new Error(code === 0 ? "no caption track (manual or auto) for this video" : `yt-dlp exited ${code}: ${err.trim().slice(-300)}`));
          // prefer a manual track (cap.en.vtt) over auto (cap.en.vtt is also the auto name; yt-dlp writes one file per lang)
          const file = files.sort((a, b) => a.length - b.length)[0];
          const vtt = await readFile(path.join(dir, file), "utf8");
          const auto = !/Kind: captions/i.test(vtt) || /Language: /.test(vtt.slice(0, 200)) ? true : false;
          resolve({ videoId, lang: file.replace(/^cap\./, "").replace(/\.vtt$/, ""), auto, cues: parseVtt(vtt), durationS: Number(durationS) || null, title: title || null });
        } catch (e) {
          reject(e);
        } finally {
          await rm(dir, { recursive: true, force: true }).catch(() => null);
        }
      });
    })();
  });
}
