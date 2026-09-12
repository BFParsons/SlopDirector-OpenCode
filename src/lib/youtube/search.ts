import { spawn } from "node:child_process";

export type YouTubeCandidate = {
  id: string;
  url: string;
  title: string;
  channel: string | null;
  durationS: number | null;
  viewCount: number | null;
  uploadDate: string | null;
};

/**
 * yt-dlp search (no download): `ytsearchN:<query>` as a flat playlist, one
 * JSON object per line. Duration/channel/view count are what the search page
 * exposes; the licence is not (open the video page for that).
 */
export function searchYouTube(query: string, max = 8, timeoutMs = 60_000): Promise<YouTubeCandidate[]> {
  const n = Math.min(25, Math.max(1, Math.floor(max)));
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", [`ytsearch${n}:${query}`, "--flat-playlist", "--dump-json", "--no-warnings", "--quiet"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let errText = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`youtube search timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (errText += d.toString()));
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const rows: YouTubeCandidate[] = [];
      for (const line of out.split("\n")) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line) as Record<string, unknown>;
          const id = String(j.id ?? "");
          if (!id) continue;
          rows.push({
            id,
            url: `https://www.youtube.com/watch?v=${id}`,
            title: String(j.title ?? ""),
            channel: (j.channel as string) ?? (j.uploader as string) ?? null,
            durationS: typeof j.duration === "number" ? j.duration : null,
            viewCount: typeof j.view_count === "number" ? j.view_count : null,
            uploadDate: (j.upload_date as string) ?? null,
          });
        } catch {
          /* skip malformed line */
        }
      }
      if (!rows.length && code !== 0) return reject(new Error(`yt-dlp search failed: ${errText.trim().slice(-300) || `exit ${code}`}`));
      resolve(rows);
    });
  });
}
