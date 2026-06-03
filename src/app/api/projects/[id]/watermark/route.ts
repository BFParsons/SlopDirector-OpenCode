import { randomUUID } from "node:crypto";
import { requireApiUser } from "@/lib/auth/rbac";
import { saveAsset } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Map<string, string>([
  ["image/png", "png"], // PNG preferred (alpha preserved for transparent logos)
  ["image/webp", "webp"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
]);

// Upload a logo / watermark composited over the whole ad at final render.
// Position/scale/opacity/margin are tuned separately via PATCH.
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
    if (!ext) return err("Unsupported image format (use PNG, WebP, or JPEG)", 415);
    if (file.size > MAX_BYTES) return err("Image too large (max 10 MB)", 413);

    const buf = Buffer.from(await file.arrayBuffer());
    const asset = await saveAsset({
      projectId: id,
      kind: "WATERMARK",
      sub: "uploads",
      filename: `watermark-${randomUUID()}.${ext}`,
      data: buf,
      mime: file.type,
    });

    await prisma.project.update({
      where: { id },
      data: { watermarkAssetId: asset.id },
    });

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

// Remove the watermark (render reverts to no logo).
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    await prisma.project.update({ where: { id }, data: { watermarkAssetId: null } });
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
