import { writeFile } from "node:fs/promises";
import path from "node:path";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { audioProjectDir, audioRelPath, ensureAudioDir, newAudioFilename } from "@/lib/audio/workspace";

export const dynamic = "force-dynamic";

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB — full songs / long recordings
const ALLOWED = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "weba", "webm"]);

/** Import an audio file into the project's Audio Studio working area. */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const form = await request.formData();
    const projectId = String(form.get("projectId") ?? "");
    const file = form.get("file");

    if (!projectId) return err("projectId is required", 400);
    await getOwnedProject(projectId, user);
    if (!(file instanceof File)) return err("file is required", 400);
    if (file.size > MAX_BYTES) return err("Audio too large (max 200 MB)", 413);

    const ext = (path.extname(file.name).replace(".", "").toLowerCase() || "wav").slice(0, 5);
    if (!ALLOWED.has(ext)) return err(`Unsupported audio type: .${ext}`, 415);

    await ensureAudioDir(projectId);
    const filename = newAudioFilename(file.name, ext);
    const abs = path.join(audioProjectDir(projectId), filename);
    await writeFile(abs, Buffer.from(await file.arrayBuffer()));

    const relPath = audioRelPath(projectId, filename);
    const durationS = await probeDuration(abs);

    return ok({
      relPath,
      name: file.name,
      durationS,
      url: `/api/audio/file?projectId=${encodeURIComponent(projectId)}&p=${encodeURIComponent(relPath)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
