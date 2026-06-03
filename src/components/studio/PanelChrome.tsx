"use client";

import type { ReactNode } from "react";

interface PanelChromeProps {
  title: string;
  icon?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  // Accepted (passed via windowControls) but not shown — minimize/maximize live
  // in the window's right-click menu; the title bar keeps only Close.
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  /** Render with no title bar at all (panel manages its own header/drag handle). */
  bare?: boolean;
}

/** Window chrome for a Studio panel: a slim drag-handle title bar with a Close
 *  button (resize/move the window directly; min/max are in the right-click menu),
 *  and the panel body scrolling beneath. With `bare`, the title bar is omitted. */
export default function PanelChrome({ title, icon, children, actions, onClose, bare }: PanelChromeProps) {
  if (bare) {
    return (
      <div className="flex h-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]">
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]">
      <div className="window-drag-handle flex shrink-0 items-center justify-between gap-2 bg-[var(--color-surface)] px-2 py-0 leading-none">
        <div className="flex select-none items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider leading-none text-[var(--color-muted)]">
          {icon ? <span className="text-[var(--color-accent)]">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {onClose ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="flex h-3 w-3 items-center justify-center rounded text-[var(--color-muted)] transition-colors hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]"
              title="Close"
              aria-label="Close panel"
            >
              <svg width="8" height="8" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.3">
                <line x1="1" y1="1" x2="8" y2="8" />
                <line x1="8" y1="1" x2="1" y2="8" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
