import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { detectSilences } from "@/lib/media/inspect";

type Ctx = { params: Promise<{ assetId: string }> };
const AUDIBLE = new Set(["UPLOAD_VIDEO", "SHOT_CLIP", "FINAL_MP4", "DRAFT_MP4", "UPLOAD_AUDIO", "OVERLAY_AUDIO", "VO_AUDIO"]);

/** GET ?noise=-30&min=0.5 → { silences: [...], speech: [...] } (the ranges an edit would keep). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    if (!AUDIBLE.has(asset.kind)) return err("Asset has no audio", 400);
    const q = new URL(req.url).searchParams;
    const noise = Math.min(0, Math.max(-90, Number(q.get("noise") ?? -30) || -30));
    const min = Math.min(60, Math.max(0.05, Number(q.get("min") ?? 0.5) || 0.5));
    const result = await detectSilences(absolutePath(asset.path), noise, min);
    return ok({ assetId: asset.id, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
