"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { desktop } from "@/lib/desktop";

/**
 * Default project-save folder. New projects create a named subfolder here
 * holding their project.json + assets. Uses the native folder picker in the
 * desktop app; in the web build there's no local filesystem, so we say so.
 */
export function ProjectFolderSettings({ initialFolder }: { initialFolder: string | null }) {
  const [folder, setFolder] = useState<string | null>(initialFolder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasPicker, setHasPicker] = useState(true);

  useEffect(() => {
    setHasPicker(desktop() != null);
  }, []);

  async function choose() {
    const bridge = desktop();
    if (!bridge) return;
    setError(null);
    setSaved(false);
    const picked = await bridge.pickFolder({ title: "Choose where to save projects" });
    if (!picked) return;
    setBusy(true);
    try {
      await api("/api/account/project-folder", {
        method: "POST",
        body: JSON.stringify({ folder: picked }),
      });
      setFolder(picked);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/account/project-folder", { method: "DELETE" });
      setFolder(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Default project folder</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          New projects are saved as a named folder here, each holding its{" "}
          <span className="font-mono">project.json</span> file and an{" "}
          <span className="font-mono">assets/</span> folder. Copy a project folder
          to back it up or move it to another machine.
        </p>
      </div>

      <p className="text-sm">
        {folder ? (
          <>
            Saving projects under:{" "}
            <span className="font-mono break-all text-[var(--color-fg)]">{folder}</span>
          </>
        ) : (
          <span className="text-[var(--color-muted)]">
            No folder set — projects are stored in the app&apos;s internal data.
          </span>
        )}
      </p>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {saved ? <p className="text-sm text-[var(--color-success)]">Saved.</p> : null}

      {hasPicker ? (
        <div className="flex items-center gap-2">
          <Button onClick={choose} disabled={busy}>
            {busy ? "Saving…" : folder ? "Change folder" : "Choose folder"}
          </Button>
          {folder ? (
            <Button variant="ghost" onClick={clear} disabled={busy}>
              Clear
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          Folder selection is available in the desktop app.
        </p>
      )}
    </Card>
  );
}
