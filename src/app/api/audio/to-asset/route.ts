import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { resolveAudioFile, audioMimeForPath } from "@/lib/audio/workspace";
import { saveAsset } from "@/lib/assets/storage";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().min(1),
  relPath: z.string().min(1),
});

/**
 * Bridge: register an Audio Studio *workspace* file as a project DB Asset
 * (kind UPLOAD_AUDIO, or UPLOAD_VIDEO for an audiogram .mp4). Lets an
 * imported/separated/mixed track — or a rendered audiogram — be dropped onto the
 * Media Bucket or the video timeline, which both speak in Asset ids.
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    const abs = resolveAudioFile(body.projectId, body.relPath);
    if (!abs) return err("Invalid audio path", 400);

    const data = await readFile(abs);
    const mime = audioMimeForPath(abs);
    const isVideo = mime.startsWith("video/");
    const asset = await saveAsset({
      projectId: body.projectId,
      kind: isVideo ? "UPLOAD_VIDEO" : "UPLOAD_AUDIO",
      sub: "uploads",
      filename: path.basename(abs),
      data,
      mime,
    });

    return ok({ id: asset.id, assetId: asset.id, isAudio: !isVideo });
  } catch (e) {
    return handleApiError(e);
  }
}
