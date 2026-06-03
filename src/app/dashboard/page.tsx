import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button, Card, StatusBadge } from "@/components/ui";
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
      <AppHeader email={user.email} role={user.role} />
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your videos</h1>
          <Link href="/start">
            <Button>+ New video</Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card className="text-center text-sm text-[var(--color-muted)]">
            No videos yet. Click <span className="text-[var(--color-fg)]">+ New video</span>{" "}
            to write a brief and generate your first one.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full transition hover:border-[var(--color-accent)]">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="font-medium">{p.title}</h2>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-[var(--color-muted)]">
                    {p.subject}
                  </p>
                  <p className="mt-3 text-xs text-[var(--color-muted)]">
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
