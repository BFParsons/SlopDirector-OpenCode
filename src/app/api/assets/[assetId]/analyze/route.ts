import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { measureLoudness } from "@/lib/audio/analyze";
import { hasAudioStream, probeDuration, probeVideoStream } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { detectBlack, detectFrozen, detectSilences, loudnessTimeline } from "@/lib/media/inspect";

type Ctx = { params: Promise<{ assetId: string }> };
const KINDS = new Set(["black", "freeze", "loudness", "silence", "probe", "timeline"]);

/**
 * GET ?kinds=black,freeze,loudness,silence,probe,timeline — the technical checks
 * an export verification needs in one call (each kind is an ffmpeg pass; ask
 * only for what you need). Defaults to all but `timeline` (short-term loudness
 * every 100 ms, for voice-vs-music balance).
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
    // A file with no audio stream (every shot muted, no music) is a legitimate
    // answer, not a server error: audio kinds come back null with hasAudio=false.
    const hasAudio = await hasAudioStream(abs);
    const [probe, black, frozen, loudness, silence, timeline] = await Promise.all([
      kinds.includes("probe") ? Promise.all([probeDuration(abs), probeVideoStream(abs).catch(() => null)]).then(([d, v]) => ({ durationS: d, video: v, hasAudio })) : null,
      kinds.includes("black") && isVideo ? detectBlack(abs).catch(() => null) : null,
      kinds.includes("freeze") && isVideo ? detectFrozen(abs).catch(() => null) : null,
      kinds.includes("loudness") && hasAudio ? measureLoudness(abs).catch((e: Error) => ({ error: e.message })) : null,
      kinds.includes("silence") && hasAudio ? detectSilences(abs, -40, 0.5).catch(() => null) : null,
      kinds.includes("timeline") && hasAudio ? loudnessTimeline(abs).catch(() => null) : null,
    ]);
    return ok({
      assetId: asset.id,
      kind: asset.kind,
      hasAudio,
      probe,
      black: black?.black ?? null,
      frozen: frozen?.frozen ?? null,
      loudness,
      silences: silence?.silences ?? null,
      speech: silence?.speech ?? null,
      timeline,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
