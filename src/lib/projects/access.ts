import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { AuthError } from "@/lib/auth/rbac";

/**
 * Fetch a project and assert the caller owns it (or is ADMIN). Returns 404 for
 * both missing and not-owned to avoid leaking existence. Fetch relations
 * separately when needed.
 */
export async function getOwnedProject(
  projectId: string,
  user: { id: string; role: string },
): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || (project.userId !== user.id && user.role !== "ADMIN")) {
    throw new AuthError("Project not found", 404);
  }
  return project;
}
