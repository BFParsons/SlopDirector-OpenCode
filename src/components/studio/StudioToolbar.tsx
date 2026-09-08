"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { Button } from "@/components/ui";
import { CostPreview } from "@/components/CostPreview";
import { FileMenu } from "./FileMenu";
import { useStudioWorkspaceStore } from "@/stores/studioWorkspaceStore";
import type { PanelGroup } from "@/types/panel";
import { getAllPanels } from "./PanelRegistry";
import { useProjectEditor } from "./ProjectEditorProvider";
import { SaveMenu } from "./SaveMenu";

const GROUP_ORDER: PanelGroup[] = ["Viewer", "Edit", "Audio", "Finish", "Library"];

function PanelLauncher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const addWindow = useStudioWorkspaceStore((s) => s.addWindow);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const panels = getAllPanels();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)]"
      >
        +<span className="max-md:hidden"> Panel</span>
      </button>
      {open ? (
        // Never taller than the window (scrolls past that). On short screens the
        // 18 panels won't fit in one column, so it becomes two: the Audio group
        // (the tallest) fills the right column, the other groups stack on the left.
        <div className="absolute left-0 z-[10000] mt-1 max-h-[calc(100dvh-4rem)] w-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)] short:grid short:w-[26rem] short:grid-cols-2 short:items-start">
          {GROUP_ORDER.map((group) => {
            const inGroup = panels.filter((p) => p.group === group);
            if (inGroup.length === 0) return null;
            return (
              <div key={group} className={group === "Audio" ? "short:col-start-2 short:row-start-1 short:row-span-4" : undefined}>
                <div className="px-3 pb-0.5 pt-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{group}</div>
                {inGroup.map((p) => (
                  <button
                    key={p.type}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--color-fg)] hover:bg-white/5"
                    onClick={() => { addWindow(p.type, p.title); setOpen(false); }}
                  >
                    <span className="w-4 text-center text-[var(--color-accent)]">{p.icon}</span>
                    <span>{p.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function StudioToolbar() {
  const {
    snapshot,
    isAdmin,
    userEmail,
    save,
    saving,
    saved,
    readOnly,
    renderBlocker,
    openRender,
    showCost,
    setShowCost,
    refetch,
    undo,
    redo,
    canUndo,
    canRedo,
    guardedLeave,
  } = useProjectEditor();
  const router = useRouter();
  const arrangeWindows = useStudioWorkspaceStore((s) => s.arrangeWindows);

  const blocker = renderBlocker();
  const iconBtn =
    "flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] disabled:opacity-30 disabled:hover:text-[var(--color-muted)]";

  // Inline rename — editable at all times; persists the project title on blur/Enter.
  const [title, setTitle] = useState(snapshot.title);
  async function commitTitle() {
    const t = title.trim();
    if (!t) {
      setTitle(snapshot.title);
      return;
    }
    if (t === snapshot.title) return;
    try {
      await api(`/api/projects/${snapshot.id}`, { method: "PATCH", body: JSON.stringify({ title: t }) });
    } catch {
      setTitle(snapshot.title);
    }
  }

  return (
    <>
      {/* One row, always: labels never wrap (a wrapped "+ Panel" used to double
          the toolbar height on narrow windows), the title shrinks first, and below
          `md` the labels collapse to icons. NB: no `overflow-*` here — it would turn
          the bar into a clip box and hide the Panel / Workspace / File dropdowns. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => guardedLeave(() => router.push("/start"))}
            title="Home"
            aria-label="Home"
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase("/logo.png")} alt="SlopStudio Pro" className="h-6 w-auto object-contain transition-opacity hover:opacity-80" />
          </button>
          <FileMenu email={userEmail} isAdmin={isAdmin} />
        </div>

        {/* Centered project title — shrinks before anything else does; hidden on
            very narrow windows (below md), where even the icons barely fit */}
        <div className="flex min-w-0 shrink items-center gap-2 max-md:hidden">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                setTitle(snapshot.title);
                e.currentTarget.blur();
              }
            }}
            title="Rename project"
            aria-label="Project title"
            spellCheck={false}
            style={{ width: `${Math.min(40, Math.max(8, title.length + 1))}ch`, fontFamily: "Lora, serif" }}
            className="max-w-full truncate rounded bg-transparent px-1 text-center text-base font-bold text-[var(--color-fg)] outline-none transition-colors hover:bg-white/5 focus:bg-white/10"
          />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="flex items-center gap-1">
            <button type="button" className={iconBtn} onClick={undo} disabled={!canUndo || readOnly} title="Undo (Cmd/Ctrl+Z)">
              ↶
            </button>
            <button type="button" className={iconBtn} onClick={redo} disabled={!canRedo || readOnly} title="Redo (Cmd/Ctrl+Shift+Z)">
              ↷
            </button>
          </div>
          <PanelLauncher />
          <button
            type="button"
            onClick={arrangeWindows}
            className="whitespace-nowrap rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            title="Tile all open panels"
          >
            ▦<span className="max-md:hidden"> Arrange</span>
          </button>
          <SaveMenu />

          <div className="ml-1 flex items-center gap-2 border-l border-[var(--color-border)] pl-2">
            {blocker ? <span className="hidden text-xs text-[var(--color-muted)] lg:inline">{blocker}</span> : null}
            {saved ? <span className="text-xs text-[var(--color-success)]">Saved</span> : null}
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={save} disabled={saving || readOnly}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button className="px-3 py-1.5 text-xs" onClick={openRender} disabled={saving || readOnly || !!blocker}>
              Export<span className="max-md:hidden"> →</span>
            </Button>
          </div>
        </div>
      </div>

      {showCost ? (
        <CostPreview
          projectId={snapshot.id}
          onClose={() => setShowCost(false)}
          onConfirmed={() => {
            setShowCost(false);
            void refetch();
          }}
        />
      ) : null}
    </>
  );
}
