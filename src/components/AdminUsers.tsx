"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, Select, StatusBadge } from "@/components/ui";

interface UserRow {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  projectCount: number;
}

export function AdminUsers({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function refresh() {
    const list = await api<UserRow[]>("/api/admin/users");
    setUsers(list);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const u = await api<{ email: string }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      });
      setCreated(u.email);
      setEmail("");
      setPassword("");
      setRole("USER");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, addr: string) {
    if (!confirm(`Delete ${addr}? This removes their projects and assets.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Create a user</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Public sign-up is closed — accounts are created here. Share the email +
            password with the person; they can set their own OpenRouter key in Settings.
          </p>
        </div>
        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label hint="min 8 characters">Temporary password</Label>
              <Input
                type="text"
                required
                minLength={8}
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="w-40">
              <Label>Role</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </div>
            <Button type="submit" disabled={busy || !email || password.length < 8}>
              {busy ? "Saving…" : "Create user"}
            </Button>
          </div>
          {created ? (
            <p className="text-sm text-[var(--color-success)]">Created {created}.</p>
          ) : null}
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">Accounts ({users.length})</h2>
        <div className="divide-y divide-[var(--color-border)]">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="truncate font-medium">{u.email}</span>
                <span className="ml-2 text-xs text-[var(--color-muted)]">
                  {u.projectCount} project{u.projectCount === 1 ? "" : "s"} ·{" "}
                  {new Date(u.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={u.role} />
                {u.id === currentUserId ? (
                  <span className="text-xs text-[var(--color-muted)]">you</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                    onClick={() => void remove(u.id, u.email)}
                  >
                    delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
