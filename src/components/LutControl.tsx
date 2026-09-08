"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, Label } from "@/components/ui";

/**
 * Upload / remove a 3D LUT (.cube) that is applied to every clip at final
 * render, after the built-in color look. Export-only: the Canvas2D preview
 * can't apply a LUT, so the badge says so.
 */
export function LutControl({
  projectId,
  lutAssetId,
  readOnly,
  save,
  refetch,
}: {
  projectId: string;
  lutAssetId: string | null;
  readOnly: boolean;
  save: () => Promise<boolean>;
  refetch: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!(await save())) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/projects/${projectId}/lut`, { method: "POST", body: fd });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    if (!(await save())) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/lut`, { method: "DELETE" });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label hint="a .cube 3D LUT applied after the color look (on export)">Custom LUT</Label>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".cube"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        {lutAssetId ? (
          <>
            <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-success)]">LUT loaded</span>
            <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-muted)]" title="Applied at export — the live preview doesn't show it">
              on export
            </span>
            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy || readOnly} onClick={() => fileRef.current?.click()}>
              Replace…
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy || readOnly} onClick={remove}>
              Remove
            </Button>
          </>
        ) : (
          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy || readOnly} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "+ Upload .cube LUT"}
          </Button>
        )}
      </div>
      {error ? <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
