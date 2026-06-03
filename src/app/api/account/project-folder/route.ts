import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { ok } from "@/lib/http/response";

const bodySchema = z.object({ folder: z.string().min(1).max(1024) });

// Save the caller's default project folder — new projects create a named bundle
// subfolder under it (desktop). The path is chosen via the native folder picker.
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const { folder } = await parseJsonBody(request, bodySchema, 4 * 1024);
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultProjectFolder: folder },
    });
    return ok({ folder });
  } catch (e) {
    return handleApiError(e);
  }
}

// Clear the default — new projects then stay as legacy DB projects.
export async function DELETE() {
  try {
    const { user } = await requireApiUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultProjectFolder: null },
    });
    return ok({ folder: null });
  } catch (e) {
    return handleApiError(e);
  }
}
