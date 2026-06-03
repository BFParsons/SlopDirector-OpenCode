"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

/**
 * Forces a decision when leaving a new/unsaved project: name it and save, or
 * discard it — so abandoned, empty projects don't pile up. Presentational; the
 * leave/discard/save plumbing lives in {@link useLeaveGuard}.
 */
export function ExitSaveDialog({
  initialName,
  busy,
  saveLabel = "Save",
  busyLabel = "Saving…",
  note,
  error,
  onSave,
  onDiscard,
  onCancel,
}: {
  initialName: string;
  busy: boolean;
  saveLabel?: string;
  busyLabel?: string;
  note?: string;
  error?: string | null;
  onSave: (name: string) => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const canSave = name.trim().length > 0 && !busy;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Save this project?</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {note ??
            "Name and save it to keep it, or discard it so it doesn't clutter your projects."}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Project name
          </label>
          <Input
            autoFocus
            value={name}
            disabled={busy}
            placeholder="Untitled project"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) onSave(name.trim());
            }}
          />
        </div>

        {error ? <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p> : null}

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="danger" disabled={busy} onClick={onDiscard}>
            {busy ? "…" : "Discard"}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={() => onSave(name.trim())}>
              {busy ? busyLabel : saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
