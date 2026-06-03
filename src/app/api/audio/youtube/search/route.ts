import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";
import { searchYouTube } from "@/lib/audio/ytmp3";

export const dynamic = "force-dynamic";

/** Search YouTube (metadata only) for the Audio Importer's search popup. */
export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    if (!q.trim()) return ok([]);
    const limit = Number(url.searchParams.get("limit")) || 12;
    const results = await searchYouTube(q, limit);
    return ok(results);
  } catch (e) {
    return handleApiError(e);
  }
}
