"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { desktop } from "@/lib/desktop";
import { ExitSaveDialog } from "./ExitSaveDialog";

/**
 * Guards leaving an editor (Assembly / Audio Studio): when the
 * project still looks like a throwaway (`shouldGuard`), an attempt to navigate
 * away pops the {@link ExitSaveDialog} forcing the user to name+save or discard
 * (delete) the project — so empty/unsaved projects don't accumulate.
 *
 *  - `guardedLeave(go)` — call instead of navigating directly; runs `go` now if
 *    safe, else opens the dialog and runs it after save/discard.
 *  - `dialog` — render this in your tree (null when not prompting).
 *  - also installs a `beforeunload` warning for hard tab/window closes. In the
 *    desktop shell that warning can't be a native prompt (Electron shows none, and
 *    a modal would block the main process), so Electron routes the blocked
 *    close/reload back here (`onUnloadBlocked`) → the same dialog → then the
 *    close/reload is finished with the guard bypassed (`finishUnload`).
 */
export function useLeaveGuard(opts: {
  shouldGuard: boolean;
  projectId: string;
  initialName: string;
  /** Persist the project under `name`; return true on success. */
  onSave: (name: string) => Promise<boolean>;
  /** Save-button label + busy label + dialog note (e.g. audio "Mix down & Save"). */
  saveLabel?: string;
  busyLabel?: string;
  note?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Read the latest guard flag from inside stable callbacks / event handlers.
  const guardRef = useRef(opts.shouldGuard);
  guardRef.current = opts.shouldGuard;
  const saveRef = useRef(opts.onSave);
  saveRef.current = opts.onSave;

  const guardedLeave = useCallback((go: () => void) => {
    if (guardRef.current) setPending(() => go);
    else go();
  }, []);

  // Native warning for hard closes / reloads (can't run a custom dialog there).
  // `bypassRef` lets a deliberate follow-through (after save/discard) unload.
  const bypassRef = useRef(false);
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!guardRef.current || bypassRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Desktop shell: a blocked window close / reload comes back here instead of a
  // native modal. Show the save/discard dialog; on save/discard, finish the
  // original action with the guard bypassed. Cancel simply keeps the window.
  useEffect(() => {
    const d = desktop();
    if (!d?.onUnloadBlocked) return;
    return d.onUnloadBlocked(({ kind }) => {
      guardedLeave(() => {
        bypassRef.current = true;
        void d.finishUnload?.(kind);
      });
    });
  }, [guardedLeave]);

  const run = (go: (() => void) | null) => (go ?? (() => router.push("/start")))();

  async function handleSave(name: string) {
    setBusy(true);
    setErr(null);
    try {
      if (await saveRef.current(name)) {
        const go = pending;
        setPending(null);
        run(go);
      } else {
        setErr("Couldn't save — please try again.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    setBusy(true);
    try {
      await api(`/api/projects/${opts.projectId}`, { method: "DELETE" }).catch(() => {});
      const go = pending;
      setPending(null);
      run(go);
    } finally {
      setBusy(false);
    }
  }

  const dialog = pending ? (
    <ExitSaveDialog
      initialName={opts.initialName}
      busy={busy}
      saveLabel={opts.saveLabel}
      busyLabel={opts.busyLabel}
      note={opts.note}
      error={err}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onCancel={() => {
        if (busy) return;
        setErr(null);
        setPending(null);
      }}
    />
  ) : null;

  return { guardedLeave, dialog };
}
