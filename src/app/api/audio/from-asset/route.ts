import { copyFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { prisma } from "@/lib/db/client";
import { absolutePath } from "@/lib/assets/storage";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { audioProjectDir, audioRelPath, ensureAudioDir, newAudioFilename } from "@/lib/audio/workspace";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().min(1),
  assetId: z.string().min(1),
});

/**
 * Bridge: copy a project DB Asset's audio file into the Audio Studio workspace,
 * so a Media Bucket audio item can be dropped into the Audio Importer and then
 * separated / processed / mixed like any imported track.
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    const asset = await prisma.asset.findUnique({ where: { id: body.assetId } });
    if (!asset) return err("Asset not found", 404);
    // The user must own the asset's project (covers Browse-reused, cross-project assets).
    await getOwnedProject(asset.projectId, user);

    const isAudio = asset.mime.startsWith("audio") || asset.kind === "UPLOAD_AUDIO" || asset.kind === "OVERLAY_AUDIO";
    if (!isAudio) return err("Not an audio asset", 415);

    const ext = (path.extname(asset.path).replace(".", "").toLowerCase() || "mp3").slice(0, 5);
    await ensureAudioDir(body.projectId);
    const filename = newAudioFilename(`bucket-audio.${ext}`, ext);
    const destAbs = path.join(audioProjectDir(body.projectId), filename);
    await copyFile(absolutePath(asset.path), destAbs);

    const relPath = audioRelPath(body.projectId, filename);
    const durationS = await probeDuration(destAbs);
    return ok({
      relPath,
      name: "Bucket audio",
      durationS,
      url: `/api/audio/file?projectId=${encodeURIComponent(body.projectId)}&p=${encodeURIComponent(relPath)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
