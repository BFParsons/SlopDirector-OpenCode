import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { fetchCaptions } from "@/lib/youtube/captions";

/**
 * GET ?url=…&lang=en&q=…&from=&to= → the video's caption track with timings
 * (manual if present, else auto), optionally filtered to cues containing `q`
 * (case-insensitive) or inside [from, to] seconds. No media download.
 */
export async function GET(req: Request) {
  try {
    await requireApiUser();
    const u = new URL(req.url);
    const url = (u.searchParams.get("url") ?? "").trim();
    if (!url) return err("url is required", 400);
    const lang = (u.searchParams.get("lang") ?? "en").slice(0, 8);
    const q = (u.searchParams.get("q") ?? "").trim().toLowerCase();
    const from = Number(u.searchParams.get("from") ?? NaN);
    const to = Number(u.searchParams.get("to") ?? NaN);
    const track = await fetchCaptions(url, lang);
    let cues = track.cues;
    if (Number.isFinite(from)) cues = cues.filter((c) => c.endS >= from);
    if (Number.isFinite(to)) cues = cues.filter((c) => c.startS <= to);
    const matches = q ? cues.filter((c) => c.text.toLowerCase().includes(q)) : null;
    return ok({ ...track, cueCount: track.cues.length, cues: matches ? [] : cues.slice(0, 2000), matches });
  } catch (e) {
    return handleApiError(e);
  }
}
