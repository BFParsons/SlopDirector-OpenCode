import { stat } from "node:fs/promises";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { probeDuration, probeVideoStream } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";

type Ctx = { params: Promise<{ assetId: string }> };

/**
 * GET → what an agent needs to know about a media file: kind, duration, video
 * stream (codec / size / pixel format) and the absolute path on this machine
 * (so a finished export can be handed to the person, opened, or moved).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    const abs = absolutePath(asset.path);
    const [durationS, video, st] = await Promise.all([
      probeDuration(abs),
      probeVideoStream(abs).catch(() => null),
      stat(abs).catch(() => null),
    ]);
    return ok({
      id: asset.id,
      projectId: asset.project.id,
      kind: asset.kind,
      mime: asset.mime,
      sizeBytes: st?.size ?? asset.sizeBytes,
      durationS,
      video: video ? { codec: video.codec, width: video.width, height: video.height, pixFmt: video.pixFmt } : null,
      path: abs,
      createdAt: asset.createdAt,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
