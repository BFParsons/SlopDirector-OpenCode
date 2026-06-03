"use client";

import { useEffect, useRef, useState } from "react";
import { PROTECTED_LAYOUT_NAME } from "@/config/studio-default-layout";
import { useStudioWorkspaceStore } from "@/stores/studioWorkspaceStore";

/** Workspace menu: save the current panel arrangement (optionally as the
 *  default), save-as a new named workspace, switch/set-default/delete saved
 *  workspaces, apply a preset, or reset to the system default. */
export function SaveMenu() {
  const [open, setOpen] = useState(false);
  const [saveForm, setSaveForm] = useState(false);
  const [name, setName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLayoutName = useStudioWorkspaceStore((s) => s.currentLayoutName);
  const savedLayouts = useStudioWorkspaceStore((s) => s.savedLayouts);
  const isDirty = useStudioWorkspaceStore((s) => s.isDirty);
  const layoutId = useStudioWorkspaceStore((s) => s.layoutId);
  const saveLayout = useStudioWorkspaceStore((s) => s.saveLayout);
  const saveLayoutAs = useStudioWorkspaceStore((s) => s.saveLayoutAs);
  const loadLayoutById = useStudioWorkspaceStore((s) => s.loadLayoutById);
  const setDefaultLayout = useStudioWorkspaceStore((s) => s.setDefaultLayout);
  const deleteLayout = useStudioWorkspaceStore((s) => s.deleteLayout);
  const resetLayout = useStudioWorkspaceStore((s) => s.resetLayout);
  const applyPreset = useStudioWorkspaceStore((s) => s.applyPreset);
  const getPresetNames = useStudioWorkspaceStore((s) => s.getPresetNames);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSaveForm(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const presets = getPresetNames();
  const currentIsDefault = savedLayouts.find((l) => l.id === layoutId)?.isDefault ?? false;

  function close() {
    setOpen(false);
    setSaveForm(false);
  }

  function openSaveForm() {
    setName(currentLayoutName ?? "My workspace");
    setMakeDefault(false);
    setSaveForm(true);
  }

  function submitSaveAs() {
    const n = name.trim();
    if (!n) return;
    void saveLayoutAs(n, makeDefault);
    close();
  }

  const item =
    "block w-full px-3 py-1.5 text-left text-[var(--color-fg)] transition-colors hover:bg-white/5";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        title="Workspaces"
      >
        <span>⊞ {currentLayoutName ?? "Workspace"}</span>
        {isDirty ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" title="Unsaved changes" /> : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[10000] mt-1 w-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
          {layoutId ? (
            <button type="button" className={item} onClick={() => { void saveLayout(); close(); }}>
              💾 Save changes{currentLayoutName ? ` to “${currentLayoutName}”` : ""}
            </button>
          ) : null}

          {!saveForm ? (
            <button type="button" className={item} onClick={openSaveForm}>
              ＋ Save Workspace…
            </button>
          ) : (
            <div className="space-y-2 px-3 py-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSaveAs();
                  if (e.key === "Escape") setSaveForm(false);
                }}
                placeholder="Workspace name"
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-fg)]"
              />
              <label className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                Make default (loads when you open a project)
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded px-2 py-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]" onClick={() => setSaveForm(false)}>
                  Cancel
                </button>
                <button type="button" className="rounded bg-[var(--color-control)] px-2.5 py-1 font-medium text-[var(--color-accent-fg)] hover:brightness-110 disabled:opacity-40" disabled={!name.trim()} onClick={submitSaveAs}>
                  Save
                </button>
              </div>
            </div>
          )}

          {layoutId && !currentIsDefault ? (
            <button type="button" className={item} onClick={() => { void setDefaultLayout(layoutId); close(); }}>
              ★ Make this the default
            </button>
          ) : null}

          <button type="button" className={item} onClick={() => { resetLayout(); close(); }}>
            ↺ Reset to default arrangement
          </button>

          {presets.length > 0 ? (
            <>
              <div className="mt-1 border-t border-[var(--color-border)] px-3 pb-0.5 pt-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Presets</div>
              {presets.map((p) => (
                <button key={p} type="button" className={`${item} capitalize`} onClick={() => { applyPreset(p); close(); }}>
                  {p}
                </button>
              ))}
            </>
          ) : null}

          {savedLayouts.length > 0 ? (
            <>
              <div className="mt-1 border-t border-[var(--color-border)] px-3 pb-0.5 pt-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Saved workspaces</div>
              {savedLayouts.map((l) => (
                <div key={l.id} className="group flex items-center justify-between px-3 py-1.5 hover:bg-white/5">
                  <button type="button" className="flex-1 truncate text-left text-[var(--color-fg)]" onClick={() => { void loadLayoutById(l.id); close(); }}>
                    {l.name}
                    {l.isDefault ? <span className="ml-1 text-[10px] text-[var(--color-accent)]" title="Default">★</span> : null}
                    {l.id === layoutId ? <span className="ml-1 text-[10px] text-[var(--color-muted)]">(current)</span> : null}
                  </button>
                  {!l.isDefault ? (
                    <button type="button" title="Make default" className="px-1 text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-accent)] group-hover:opacity-100" onClick={() => void setDefaultLayout(l.id)}>★</button>
                  ) : null}
                  {l.name === PROTECTED_LAYOUT_NAME ? (
                    <span className="px-1 text-[10px] text-[var(--color-muted)]" title="Permanent — can’t be deleted">🔒</span>
                  ) : (
                    <button type="button" title="Delete" className="px-1 text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100" onClick={() => void deleteLayout(l.id)}>✕</button>
                  )}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
