import { requireApiUser } from "@/lib/auth/rbac";
import { PROTECTED_LAYOUT_NAME } from "@/config/studio-default-layout";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { deleteLayoutSchema, putLayoutSchema } from "@/lib/validation/workspace";

/** GET → the user's saved Studio layouts for a section (array, newest first). */
export async function GET(request: Request) {
  try {
    const { user } = await requireApiUser();
    const sectionParam = new URL(request.url).searchParams.get("section");
    const section = sectionParam === "audio" ? "audio" : "video";
    const rows = await prisma.workspaceLayout.findMany({
      where: { userId: user.id, section },
      orderBy: { updatedAt: "desc" },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        isDefault: r.isDefault,
        layout: r.layout,
        updatedAt: r.updatedAt,
      })),
    );
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT → upsert a layout. With `id` it updates that layout (name/layout/default);
 *  without `id` it creates a new one. Setting `isDefault` clears the flag on the
 *  user's other layouts so exactly one default exists. */
export async function PUT(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, putLayoutSchema, 512 * 1024);

    const section = body.section ?? "video";

    const row = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        // Only one default per (user, section) — keeps Audio & Video discrete.
        await tx.workspaceLayout.updateMany({
          where: { userId: user.id, section, isDefault: true },
          data: { isDefault: false },
        });
      }

      if (body.id) {
        // Update — scoped to the owner; if it isn't theirs, updateMany affects 0
        // rows and we treat it as a no-op create-less miss.
        const data: Record<string, unknown> = {};
        if (body.name !== undefined) data.name = body.name;
        if (body.layout !== undefined) data.layout = body.layout;
        if (body.isDefault !== undefined) data.isDefault = body.isDefault;
        if (body.section !== undefined) data.section = body.section;
        const res = await tx.workspaceLayout.updateMany({
          where: { id: body.id, userId: user.id },
          data,
        });
        if (res.count > 0) {
          const updated = await tx.workspaceLayout.findUnique({ where: { id: body.id } });
          if (updated) return updated;
        }
        // Fall through to create if the id didn't resolve to an owned row.
      }

      return tx.workspaceLayout.create({
        data: {
          userId: user.id,
          name: body.name ?? "Workspace",
          section,
          layout: body.layout ?? { version: 2, windows: [], nextZIndex: 1 },
          isDefault: body.isDefault ?? false,
        },
      });
    });

    return ok({ id: row.id, name: row.name });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE → remove one of the user's layouts. */
export async function DELETE(request: Request) {
  try {
    const { user } = await requireApiUser();
    const { id } = await parseJsonBody(request, deleteLayoutSchema, 4 * 1024);
    const target = await prisma.workspaceLayout.findFirst({
      where: { id, userId: user.id },
      select: { name: true },
    });
    if (target?.name === PROTECTED_LAYOUT_NAME) {
      return err(`“${PROTECTED_LAYOUT_NAME}” cannot be deleted`, 403);
    }
    await prisma.workspaceLayout.deleteMany({ where: { id, userId: user.id } });
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
