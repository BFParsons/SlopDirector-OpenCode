"use client";

import { useEffect, useRef, useState } from "react";

export interface OptionItem {
  key: string;
  label: string;
}

/**
 * A compact, collapsed single-select control (accordion/drawer): shows the
 * current selection, expands on click to a list, and collapses on pick. Replaces
 * expanded radio/tab button rows for information density.
 */
export function OptionDrawer({
  value,
  options,
  onChange,
  label,
  align = "left",
  className = "",
}: {
  value: string;
  options: OptionItem[];
  onChange: (key: string) => void;
  /** Optional prefix shown before the value, e.g. "Tool". */
  label?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = options.find((o) => o.key === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-[11px] hover:border-[#39414f]"
      >
        <span className="truncate">
          {label ? <span className="text-[var(--color-muted)]">{label}: </span> : null}
          {current?.label ?? value}
        </span>
        <span className="shrink-0 text-[var(--color-muted)]">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div
          className={`absolute z-30 mt-1 min-w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              className={`block w-full whitespace-nowrap px-2 py-1 text-left text-[11px] transition-colors hover:bg-white/5 ${
                o.key === value ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"
              }`}
            >
              <span className="mr-1 inline-block w-2 text-[var(--color-fg)]">{o.key === value ? "•" : ""}</span>
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
