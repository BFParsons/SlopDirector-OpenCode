import { randomUUID } from "node:crypto";
import { requireApiUser } from "@/lib/auth/rbac";
import { absolutePath, saveAsset } from "@/lib/assets/storage";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB (buffered in memory — keep modest)

const IMAGE_EXT = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const VIDEO_EXT = new Map<string, string>([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
]);
const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB
const AUDIO_EXT = new Map<string, string>([
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/aac", "aac"],
  ["audio/ogg", "ogg"],
  ["audio/webm", "weba"],
  ["audio/flac", "flac"],
]);

// Upload an image (reference / still / driver) or a video clip for a segment.
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const form = await request.formData();
    const projectId = String(form.get("projectId") ?? "");
    const file = form.get("file");

    if (!projectId) return err("projectId is required", 400);
    await getOwnedProject(projectId, user);
    if (!(file instanceof File)) return err("file is required", 400);

    const imageExt = IMAGE_EXT.get(file.type);
    const videoExt = VIDEO_EXT.get(file.type);
    const audioExt = AUDIO_EXT.get(file.type);

    if (imageExt) {
      if (file.size > MAX_IMAGE_BYTES) return err("Image too large (max 10 MB)", 413);
      const buf = Buffer.from(await file.arrayBuffer());
      const asset = await saveAsset({
        projectId,
        kind: "UPLOAD_IMAGE",
        sub: "uploads",
        filename: `${randomUUID()}.${imageExt}`,
        data: buf,
        mime: file.type,
      });
      return ok({ id: asset.id, mime: asset.mime, sizeBytes: asset.sizeBytes });
    }

    if (videoExt) {
      if (file.size > MAX_VIDEO_BYTES) return err("Video too large (max 100 MB)", 413);
      const buf = Buffer.from(await file.arrayBuffer());
      const asset = await saveAsset({
        projectId,
        kind: "UPLOAD_VIDEO",
        sub: "uploads",
        filename: `${randomUUID()}.${videoExt}`,
        data: buf,
        mime: file.type,
      });
      const durationS = await probeDuration(absolutePath(asset.path));
      return ok({
        id: asset.id,
        mime: asset.mime,
        sizeBytes: asset.sizeBytes,
        durationS,
      });
    }

    if (audioExt) {
      if (file.size > MAX_AUDIO_BYTES) return err("Audio too large (max 50 MB)", 413);
      const buf = Buffer.from(await file.arrayBuffer());
      const asset = await saveAsset({
        projectId,
        kind: "UPLOAD_AUDIO",
        sub: "uploads",
        filename: `${randomUUID()}.${audioExt}`,
        data: buf,
        mime: file.type,
      });
      const durationS = await probeDuration(absolutePath(asset.path));
      return ok({ id: asset.id, mime: asset.mime, sizeBytes: asset.sizeBytes, durationS });
    }

    return err("Only images, video (MP4/MOV/WebM) or audio (MP3/WAV/M4A/AAC/OGG/FLAC) are allowed", 415);
  } catch (e) {
    return handleApiError(e);
  }
}
