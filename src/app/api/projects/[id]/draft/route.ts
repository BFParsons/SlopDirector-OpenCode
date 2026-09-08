import { requireApiUser } from "@/lib/auth/rbac";
import { streamAsset } from "@/lib/assets/serve";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";

type Ctx = { params: Promise<{ id: string }> };

/** GET → the latest draft preview file (POST /render with { draft: true } makes one). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const fr = await prisma.finalRender.findUnique({ where: { projectId: id } });
    if (!fr?.draftAssetId) return err("No draft preview yet", 404);
    const asset = await prisma.asset.findUnique({ where: { id: fr.draftAssetId } });
    if (!asset) return err("No draft preview yet", 404);
    return await streamAsset(asset.path, asset.mime, req.headers.get("range"));
  } catch (e) {
    return handleApiError(e);
  }
}
