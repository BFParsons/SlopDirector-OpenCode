"use client";

import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";

/** Factory for placeholder panels that aren't built yet (Media Bucket, YouTube
 *  Importer). Registered directly (not lazy) since there's nothing to code-split. */
export function makeComingSoonPanel(label: string, icon: string) {
  return function ComingSoonPanel({ windowControls }: PanelProps) {
    return (
      <PanelChrome title={label} icon={icon} {...windowControls}>
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="text-2xl opacity-50">{icon}</div>
          <p className="text-sm font-medium text-[var(--color-fg)]">{label}</p>
          <p className="text-xs text-[var(--color-muted)]">Coming soon.</p>
        </div>
      </PanelChrome>
    );
  };
}
