import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { requirePageUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ws?: string }>;
};

export default async function ProjectPage({ params, searchParams }: Props) {
  const { user } = await requirePageUser();
  const { id } = await params;
  const { ws } = await searchParams; // workspace preset launcher (e.g. audio-studio)

  try {
    await getOwnedProject(id, user);
  } catch {
    notFound();
  }

  const snapshot = await projectSnapshot(id);
  if (!snapshot) notFound();

  // Full-bleed: the editor's own toolbar carries navigation + the File menu, so
  // there's no global header here — the workspace fills the whole viewport.
  return (
    <main className="h-screen">
      <ProjectWorkspace
        initial={snapshot}
        isAdmin={user.role === "ADMIN"}
        userEmail={user.email}
        ws={typeof ws === "string" ? ws : undefined}
      />
    </main>
  );
}
