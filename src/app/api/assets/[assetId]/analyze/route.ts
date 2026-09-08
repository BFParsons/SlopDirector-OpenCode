import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { measureLoudness } from "@/lib/audio/analyze";
import { probeDuration, probeVideoStream } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { detectBlack, detectFrozen, detectSilences } from "@/lib/media/inspect";

type Ctx = { params: Promise<{ assetId: string }> };
const KINDS = new Set(["black", "freeze", "loudness", "silence", "probe"]);

/**
 * GET ?kinds=black,freeze,loudness,silence,probe — the technical checks an
 * export verification needs in one call (each kind is an ffmpeg pass; ask only
 * for what you need). Defaults to all.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    const abs = absolutePath(asset.path);
    const q = new URL(req.url).searchParams;
    const kinds = (q.get("kinds") ?? "black,freeze,loudness,silence,probe").split(",").map((k) => k.trim()).filter((k) => KINDS.has(k));
    if (kinds.length === 0) return err("kinds must include some of: black, freeze, loudness, silence, probe", 400);
    const isVideo = ["UPLOAD_VIDEO", "SHOT_CLIP", "FINAL_MP4", "DRAFT_MP4"].includes(asset.kind);
    const [probe, black, frozen, loudness, silence] = await Promise.all([
      kinds.includes("probe") ? Promise.all([probeDuration(abs), probeVideoStream(abs).catch(() => null)]).then(([d, v]) => ({ durationS: d, video: v })) : null,
      kinds.includes("black") && isVideo ? detectBlack(abs) : null,
      kinds.includes("freeze") && isVideo ? detectFrozen(abs) : null,
      kinds.includes("loudness") ? measureLoudness(abs).catch((e: Error) => ({ error: e.message })) : null,
      kinds.includes("silence") ? detectSilences(abs, -40, 0.5) : null,
    ]);
    return ok({
      assetId: asset.id,
      kind: asset.kind,
      probe,
      black: black?.black ?? null,
      frozen: frozen?.frozen ?? null,
      loudness,
      silences: silence?.silences ?? null,
      speech: silence?.speech ?? null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
