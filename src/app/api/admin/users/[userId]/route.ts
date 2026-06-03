import { requireApiRole } from "@/lib/auth/rbac";
import { deleteProjectAssets } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";

type Ctx = { params: Promise<{ userId: string }> };

// Delete an account (admin only). Refuses to delete yourself to avoid lockout.
// Cascades sessions + projects; remove each project's asset files first.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiRole("ADMIN");
    const { userId } = await params;
    if (userId === user.id) {
      return err("You can't delete your own account", 400);
    }
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, projects: { select: { id: true } } },
    });
    if (!target) return err("User not found", 404);

    for (const p of target.projects) {
      await deleteProjectAssets(p.id).catch(() => {});
    }
    await prisma.user.delete({ where: { id: userId } });
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
