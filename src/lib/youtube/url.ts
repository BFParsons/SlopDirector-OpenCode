/**
 * Pure YouTube URL helpers — no Node deps, safe to import in the browser.
 */

/**
 * Extract a YouTube video id from the common URL shapes. Returns null for
 * anything that isn't a recognizable YouTube URL — callers reject it so we
 * never hand an arbitrary host/string to yt-dlp.
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw; // bare id

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v") ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const m = /^\/(?:shorts|embed|v|live)\/([\w-]{11})/.exec(u.pathname);
    if (m) return m[1];
  }
  return null;
}

/** Canonical, safe URL we actually pass to yt-dlp (never the raw user string). */
export function canonicalYouTubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
