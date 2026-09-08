import { randomUUID } from "node:crypto";
import { requireApiUser } from "@/lib/auth/rbac";
import { saveAsset } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { notifyProjectChanged } from "@/lib/projects/changed";

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

// Upload a music bed mixed UNDER the voiceover at render. Independent of
// audioMode: it does not become the master track, so audioMode is left as-is.
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
      filename: `music-${randomUUID()}.${ext}`,
      data: buf,
      mime: file.type,
    });

    await prisma.project.update({
      where: { id },
      data: { musicAssetId: asset.id },
    });

    notifyProjectChanged(id, request);

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

// Remove the music bed (render reverts to voiceover-only / silent).
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    await prisma.project.update({ where: { id }, data: { musicAssetId: null } });
    notifyProjectChanged(id, _req);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
