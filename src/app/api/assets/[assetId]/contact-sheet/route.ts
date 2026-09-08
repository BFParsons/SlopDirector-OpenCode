import { readFile } from "node:fs/promises";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { contactSheet } from "@/lib/media/inspect";

type Ctx = { params: Promise<{ assetId: string }> };
const VIDEO = new Set(["UPLOAD_VIDEO", "SHOT_CLIP", "FINAL_MP4", "DRAFT_MP4"]);

/**
 * GET ?cols=4&rows=3&w=1280&start=0&end=<duration> → a JPEG grid of
 * timestamped frames. Add `format=json` for the sample times instead of the
 * image (the image URL is the same request without `format`).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    if (!VIDEO.has(asset.kind)) return err("Not a video asset", 400);
    const abs = absolutePath(asset.path);
    const q = new URL(req.url).searchParams;
    const num = (k: string, d: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, Number(q.get(k) ?? d) || d));
    const durationS = await probeDuration(abs);
    const cols = Math.round(num("cols", 4, 1, 10));
    const rows = Math.round(num("rows", 3, 1, 10));
    const width = Math.round(num("w", 1280, 256, 3840));
    const startS = num("start", 0, 0, Math.max(0, durationS));
    const endS = num("end", durationS, startS + 0.1, Math.max(startS + 0.1, durationS));
    const sheet = await contactSheet(abs, asset.project.id, asset.id, { cols, rows, width, startS, endS });
    if (q.get("format") === "json") {
      return ok({
        assetId: asset.id,
        durationS,
        cols,
        rows,
        width,
        startS,
        endS,
        times: sheet.times,
        cellWidth: sheet.cellWidth,
      });
    }
    const body = await readFile(sheet.path);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Frame-Times": JSON.stringify(sheet.times),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
