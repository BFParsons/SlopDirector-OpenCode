"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/cost/estimate";
import { useCostStore } from "@/stores/costStore";
import { useProjectEditor } from "./ProjectEditorProvider";

/** Editor "File" menu — folds the old global-header items (cost estimate, who's
 *  signed in, Users, Settings, Sign out) into one dropdown by the project title. */
export function FileMenu({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const cents = useCostStore((s) => s.cents);
  const { guardedLeave } = useProjectEditor();

  // Leave the editor through the unsaved/empty-project guard.
  const leaveTo = (go: () => void) => {
    setOpen(false);
    guardedLeave(go);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    router.push("/login");
    router.refresh();
  }

  const item = "block w-full px-3 py-1.5 text-left text-[var(--color-fg)] transition-colors hover:bg-white/5";

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded px-2 py-1 text-xs text-[var(--color-muted)] transition-colors hover:bg-white/5 hover:text-[var(--color-fg)]"
      >
        File ▾
      </button>
      {open ? (
        <div className="absolute left-0 z-[10000] mt-1 w-56 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
          <div className="px-3 py-1.5 text-[var(--color-muted)]">
            <div className="truncate">
              {email}
              {isAdmin ? " · admin" : ""}
            </div>
            {cents != null ? (
              <div className="font-mono tnum">est. {formatCents(cents)}</div>
            ) : null}
          </div>
          <div className="my-1 border-t border-[var(--color-border)]" />
          {isAdmin ? (
            <button type="button" className={item} onClick={() => leaveTo(() => router.push("/admin/users"))}>
              Users
            </button>
          ) : null}
          <button type="button" className={item} onClick={() => leaveTo(() => router.push("/settings"))}>
            Settings
          </button>
          <button
            type="button"
            className={item}
            onClick={() => leaveTo(() => void logout())}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
