import { randomUUID } from "node:crypto";
import { requireApiUser } from "@/lib/auth/rbac";
import { saveAsset } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 16 * 1024 * 1024; // a 64^3 .cube is ~7 MB

// Upload a 3D LUT (.cube) applied to every clip at final render (Polish →
// Custom LUT). Validated by content (LUT_3D_SIZE header), not by MIME — browsers
// send .cube files as application/octet-stream or text/plain.
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
    if (!/\.cube$/i.test(file.name)) return err("Upload a .cube LUT file", 415);
    if (file.size > MAX_BYTES) return err("LUT too large (max 16 MB)", 413);

    const buf = Buffer.from(await file.arrayBuffer());
    const head = buf.subarray(0, 64 * 1024).toString("utf8");
    if (!/^\s*LUT_3D_SIZE\s+\d+/m.test(head)) {
      return err("That doesn't look like a 3D .cube LUT (missing LUT_3D_SIZE)", 415);
    }

    const asset = await saveAsset({
      projectId: id,
      kind: "LUT",
      sub: "uploads",
      filename: `lut-${randomUUID()}.cube`,
      data: buf,
      mime: "text/plain",
    });

    await prisma.project.update({ where: { id }, data: { lutAssetId: asset.id } });
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

// Remove the LUT (render reverts to the built-in color look only).
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    await prisma.project.update({ where: { id }, data: { lutAssetId: null } });
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
