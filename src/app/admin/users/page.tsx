import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminUsers } from "@/components/AdminUsers";
import { requirePageUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { user } = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { projects: true } },
    },
  });

  const initialUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    projectCount: u._count.projects,
  }));

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Users</h1>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ← Back
          </Link>
        </div>
        <AdminUsers initialUsers={initialUsers} currentUserId={user.id} />
      </main>
    </>
  );
}
