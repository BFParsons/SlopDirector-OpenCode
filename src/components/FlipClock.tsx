"use client";

/** A single flip-clock cell. Digits get a split-flap card; separators ($ . :)
 *  render as plain glyphs between cards. The inner span is keyed by the char so
 *  it remounts — and replays the flip — whenever the value changes. */
function FlipCell({ ch }: { ch: string }) {
  if (!/[0-9]/.test(ch)) {
    return (
      <span className="px-0.5 font-mono text-2xl font-bold text-[var(--color-muted)]">
        {ch}
      </span>
    );
  }
  return (
    <span
      className="relative inline-flex h-12 w-9 items-center justify-center overflow-hidden rounded-md border border-black/50 bg-gradient-to-b from-[#2c313c] to-[#101319] shadow-soft"
      style={{ perspective: "260px" }}
    >
      <span
        key={ch}
        className="font-mono text-3xl font-bold tabular-nums text-white"
        style={{ animation: "flip-in 360ms var(--ease-out-soft)", transformOrigin: "center" }}
      >
        {ch}
      </span>
      {/* center seam + top-half sheen for the split-flap look */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-black/60"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/5"
      />
    </span>
  );
}

export function FlipClock({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-8 gap-y-4 rounded-xl border border-[var(--color-border)] bg-[#0b0e14] px-5 py-4 shadow-soft">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            {[...it.value].map((ch, i) => (
              <FlipCell key={i} ch={ch} />
            ))}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}
