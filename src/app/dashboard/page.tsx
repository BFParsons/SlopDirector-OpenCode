import { Card } from "@/components/ui";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { DashboardNewButtons } from "@/components/dashboard/DashboardNewButtons";
import { requirePageUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { user } = await requirePageUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your Projects</h1>
          <DashboardNewButtons />
        </div>

        {projects.length === 0 ? (
          <Card className="text-center text-sm text-[var(--color-muted)]">
            No projects yet. Click{" "}
            <span className="text-[var(--color-fg)]">+ New Video</span> or{" "}
            <span className="text-[var(--color-fg)]">+ New Audio Composition</span>{" "}
            to get started.
          </Card>
        ) : (
          <ProjectGrid
            projects={projects.map((p) => ({
              id: p.id,
              title: p.title,
              subject: p.subject,
              status: p.status,
              createdAt: p.createdAt.toISOString(),
            }))}
          />
        )}
      </main>
    </>
  );
}
