import { randomUUID } from "node:crypto";
import { requireApiUser } from "@/lib/auth/rbac";
import { absolutePath, saveAsset } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED = new Map<string, string>([
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/aac", "aac"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/ogg", "ogg"],
]);

// Upload a master audio track (a VO recording or a music bed); sets the project
// to UPLOAD_AUDIO and marks the voiceover READY (no TTS needed).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return err("file is required", 400);
    const ext = ALLOWED.get(file.type);
    if (!ext) return err("Unsupported audio format (use MP3, M4A, AAC, WAV, OGG)", 415);
    if (file.size > MAX_BYTES) return err("Audio too large (max 50 MB)", 413);

    const buf = Buffer.from(await file.arrayBuffer());
    const asset = await saveAsset({
      projectId: id,
      kind: "UPLOAD_AUDIO",
      sub: "vo",
      filename: `${randomUUID()}.${ext}`,
      data: buf,
      mime: file.type,
    });
    const durationS = await probeDuration(absolutePath(asset.path));

    await prisma.voiceoverAsset.upsert({
      where: { projectId: id },
      create: {
        projectId: id,
        assetId: asset.id,
        source: "UPLOADED",
        status: "READY",
        durationS,
      },
      update: {
        assetId: asset.id,
        source: "UPLOADED",
        status: "READY",
        durationS,
        error: null,
      },
    });
    await prisma.project.update({
      where: { id },
      data: { audioMode: "UPLOAD_AUDIO" },
    });

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

// Clear the uploaded audio and fall back to a silent track.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    await prisma.voiceoverAsset.deleteMany({ where: { projectId: id } });
    await prisma.project.update({ where: { id }, data: { audioMode: "NONE" } });
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
