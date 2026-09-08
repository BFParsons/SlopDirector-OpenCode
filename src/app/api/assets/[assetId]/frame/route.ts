import { readFile } from "node:fs/promises";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { handleApiError } from "@/lib/http/handleError";
import { err } from "@/lib/http/response";
import { frameAt } from "@/lib/media/inspect";

type Ctx = { params: Promise<{ assetId: string }> };
const VISUAL = new Set(["UPLOAD_VIDEO", "SHOT_CLIP", "FINAL_MP4", "DRAFT_MP4", "UPLOAD_IMAGE"]);

/** GET ?t=<seconds>&w=<px> → one JPEG frame (agent "look at time t"). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    if (!VISUAL.has(asset.kind)) return err("Not a visual asset", 400);
    const url = new URL(req.url);
    const t = Math.max(0, Number(url.searchParams.get("t") ?? 0) || 0);
    const w = Math.min(1920, Math.max(64, Number(url.searchParams.get("w") ?? 640) || 640));
    const file = await frameAt(absolutePath(asset.path), asset.project.id, asset.id, t, w);
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Frame-Time": String(t),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
