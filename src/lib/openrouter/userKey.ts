import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/secret";

/**
 * The effective OpenRouter key for a project's owner: their decrypted personal
 * key if set, otherwise undefined (callers then fall back to the shared server
 * key inside orFetch). Never throws — a bad/undecryptable key degrades to the
 * server key rather than failing the job.
 */
export async function keyForProject(projectId: string): Promise<string | undefined> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { user: { select: { openrouterKeyEnc: true } } },
  });
  return decryptUserKey(project?.user?.openrouterKeyEnc ?? null);
}

export function decryptUserKey(enc: string | null): string | undefined {
  if (!enc) return undefined;
  try {
    return decryptSecret(enc);
  } catch {
    return undefined;
  }
}
