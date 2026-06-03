"use client";

import { formatCents } from "@/lib/cost/estimate";
import { useCostStore } from "@/stores/costStore";

/** Compact running-cost chip in the global header; hidden off the project page. */
export function HeaderCost() {
  const cents = useCostStore((s) => s.cents);
  if (cents == null) return null;
  return (
    <span className="font-mono tnum text-[var(--color-fg)]" title="Estimated render cost">
      <span className="text-[var(--color-muted)]">est.</span> {formatCents(cents)}
    </span>
  );
}
