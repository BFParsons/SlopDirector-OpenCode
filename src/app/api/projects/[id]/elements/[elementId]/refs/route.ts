import { randomUUID } from "node:crypto";
import { requireApiUser } from "@/lib/auth/rbac";
import { saveAsset } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { encodeRefIds, parseRefIds } from "@/lib/db/reflist";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string; elementId: string }> };

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_REFS = 8;
const EXT = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

// Upload a reference image that informs this element's generation.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, elementId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const element = await prisma.storyElement.findFirst({
      where: { id: elementId, projectId: id },
      select: { id: true, refImageIds: true },
    });
    if (!element) return err("Element not found", 404);
    if (parseRefIds(element.refImageIds).length >= MAX_REFS) {
      return err(`At most ${MAX_REFS} reference images`, 409);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return err("file is required", 400);
    const ext = EXT.get(file.type);
    if (!ext) return err("Unsupported image format (use PNG, JPEG, or WebP)", 415);
    if (file.size > MAX_BYTES) return err("Image too large (max 10 MB)", 413);

    const asset = await saveAsset({
      projectId: id,
      kind: "UPLOAD_IMAGE",
      sub: "uploads",
      filename: `ref-${randomUUID()}.${ext}`,
      data: Buffer.from(await file.arrayBuffer()),
      mime: file.type,
    });

    await prisma.storyElement.update({
      where: { id: elementId },
      data: { refImageIds: encodeRefIds([...parseRefIds(element.refImageIds), asset.id]) },
    });
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
