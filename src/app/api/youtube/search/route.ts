import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { searchYouTube } from "@/lib/youtube/search";

/** GET ?q=…&max=8 → YouTube search candidates (id, url, title, channel, duration, views) via yt-dlp; nothing is downloaded. */
export async function GET(req: Request) {
  try {
    await requireApiUser();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) return err("q is required", 400);
    const max = Math.min(25, Math.max(1, Number(url.searchParams.get("max") ?? 8) || 8));
    const candidates = await searchYouTube(q, max);
    return ok({ query: q, candidates });
  } catch (e) {
    return handleApiError(e);
  }
}
