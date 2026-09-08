import type { Asset } from "@prisma/client";
import { AuthError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";

export type OwnedAsset = Asset & { project: { id: string; userId: string; bundlePath: string | null } };

/**
 * Fetch an asset and assert the caller owns its project (or is ADMIN). 404 for
 * both missing and not-owned, like getOwnedProject.
 */
export async function getOwnedAsset(
  assetId: string,
  user: { id: string; role: string },
): Promise<OwnedAsset> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { project: { select: { id: true, userId: true, bundlePath: true } } },
  });
  if (!asset || (asset.project.userId !== user.id && user.role !== "ADMIN")) {
    throw new AuthError("Asset not found", 404);
  }
  return asset;
}
