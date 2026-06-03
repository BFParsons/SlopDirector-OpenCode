import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
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

  return (
    <>
      <AppHeader email={user.email} role={user.role} />
      <Link
        href="/start"
        className="mx-auto mt-4 block w-full max-w-5xl px-6 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        ← Modes
      </Link>
      <StoryboardWorkspace initial={snapshot} />
    </>
  );
}
