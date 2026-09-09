import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { cachedJson } from "@/lib/media/cache";
import { detectScenes } from "@/lib/media/inspect";

type Ctx = { params: Promise<{ assetId: string }> };
const VIDEO = new Set(["UPLOAD_VIDEO", "SHOT_CLIP", "FINAL_MP4", "DRAFT_MP4"]);

/** GET ?threshold=0.4 → { durationS, cuts: [t…], shots: [{startS,endS}] }. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    if (!VIDEO.has(asset.kind)) return err("Not a video asset", 400);
    const q = new URL(req.url).searchParams;
    const threshold = Math.min(1, Math.max(0.05, Number(q.get("threshold") ?? 0.4) || 0.4));
    const abs = absolutePath(asset.path);
    const result = await cachedJson(`scenes-${threshold}`, abs, () => detectScenes(abs, threshold));
    return ok({ assetId: asset.id, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
