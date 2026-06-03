"use client";

import type { WindowState } from "@/types/window";

interface MinimizedBarProps {
  windows: WindowState[];
  onRestore: (id: string) => void;
}

export default function MinimizedBar({ windows, onRestore }: MinimizedBarProps) {
  const minimized = windows.filter((w) => w.isMinimized);
  if (minimized.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[9999] flex items-center gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
      {minimized.map((win) => (
        <button
          key={win.id}
          type="button"
          onClick={() => onRestore(win.id)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:bg-white/10 hover:text-[var(--color-fg)]"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] opacity-60" />
          <span>{win.title}</span>
        </button>
      ))}
    </div>
  );
}
