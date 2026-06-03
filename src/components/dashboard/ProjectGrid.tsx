"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";

export interface ProjectItem {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  createdAt: string;
}

/** Dashboard project list with single + batch delete (soft delete via DELETE
 *  /api/projects/[id]). Selection checkboxes drive the batch toolbar; each card
 *  also has a hover trash button. Deletes route through a shared confirm. */
export function ProjectGrid({ projects }: { projects: ProjectItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string[] | null>(null); // ids awaiting confirm
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = projects.length > 0 && selected.size === projects.length;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function confirmDelete() {
    if (!pending?.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(pending.map((id) => api(`/api/projects/${id}`, { method: "DELETE" })));
      setSelected(new Set());
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Selection toolbar */}
      <div className="mb-3 flex items-center gap-3 text-xs text-[var(--color-muted)]">
        <label className="flex cursor-pointer items-center gap-1.5 select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(projects.map((p) => p.id)) : new Set())
            }
          />
          Select all
        </label>
        {selected.size > 0 ? (
          <>
            <span>{selected.size} selected</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="underline-offset-2 hover:text-[var(--color-fg)] hover:underline"
            >
              Clear
            </button>
            <Button
              variant="danger"
              className="ml-auto"
              disabled={busy}
              onClick={() => setPending([...selected])}
            >
              🗑 Delete {selected.size}
            </Button>
          </>
        ) : null}
      </div>

      {error ? <p className="mb-3 text-xs text-[var(--color-danger)]">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => {
          const isSel = selected.has(p.id);
          return (
            <Card
              key={p.id}
              className={`group relative h-full ${isSel ? "border-[var(--color-accent)]" : ""}`}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggle(p.id)}
                aria-label={`Select ${p.title}`}
                className="absolute left-3 top-3.5 z-20"
              />
              <Link href={`/projects/${p.id}`} className="block">
                <div className="mb-2 flex items-start justify-between gap-2 pl-6">
                  <h2 className="font-medium">{p.title}</h2>
                  <StatusBadge status={p.status} />
                </div>
                <p className="line-clamp-2 pl-6 text-sm text-[var(--color-muted)]">{p.subject}</p>
                <p className="mt-3 pl-6 text-xs text-[var(--color-muted)]">
                  {new Date(p.createdAt).toLocaleString()}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => setPending([p.id])}
                title="Delete project"
                aria-label={`Delete ${p.title}`}
                className="absolute bottom-3 right-3 z-20 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] text-[var(--color-muted)] opacity-0 transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] group-hover:opacity-100"
              >
                🗑
              </button>
            </Card>
          );
        })}
      </div>

      {/* Delete confirmation */}
      {pending ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setPending(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold">
              Delete {pending.length} project{pending.length === 1 ? "" : "s"}?
            </h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              {pending.length === 1
                ? "This project will be removed from your list."
                : "These projects will be removed from your list."}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={busy} onClick={confirmDelete}>
                {busy ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
