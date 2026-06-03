import { decryptSecret } from "@/lib/crypto/secret";
import { prisma } from "@/lib/db/client";

/**
 * The effective fal.ai key for a project's owner: their decrypted personal key
 * if set, otherwise undefined (callers then fall back to the shared env FAL_KEY).
 * Never throws — a bad/undecryptable key degrades to the server key.
 */
export async function falKeyForProject(projectId: string): Promise<string | undefined> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { user: { select: { falKeyEnc: true } } },
  });
  const enc = project?.user?.falKeyEnc ?? null;
  if (!enc) return undefined;
  try {
    return decryptSecret(enc);
  } catch {
    return undefined;
  }
}
