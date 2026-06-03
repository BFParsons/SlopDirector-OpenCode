import { notFound } from "next/navigation";
import { StoryboardWorkspace } from "@/components/StoryboardWorkspace";
import { requirePageUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StoryboardProjectPage({ params }: Props) {
  const { user } = await requirePageUser();
  const { id } = await params;

  try {
    await getOwnedProject(id, user);
  } catch {
    notFound();
  }
  const snapshot = await projectSnapshot(id);
  if (!snapshot) notFound();

  return <StoryboardWorkspace initial={snapshot} />;
}
