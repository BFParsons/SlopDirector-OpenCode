import { requireApiUser } from "@/lib/auth/rbac";
import { streamAsset } from "@/lib/assets/serve";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err } from "@/lib/http/response";

type Ctx = { params: Promise<{ assetId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { project: { select: { userId: true } } },
    });
    if (!asset) return err("Not found", 404);
    if (asset.project.userId !== user.id && user.role !== "ADMIN") {
      return err("Not found", 404);
    }

    return await streamAsset(asset.path, asset.mime, req.headers.get("range"));
  } catch (e) {
    return handleApiError(e);
  }
}
