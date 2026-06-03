"use client";

import type { RenderSpec } from "@/lib/render/spec";
import { VideoPlayer } from "../VideoPlayer";
import { PreviewMonitor } from "./PreviewMonitor";
import type { usePreviewEngine } from "./usePreviewEngine";

type Engine = ReturnType<typeof usePreviewEngine>;
type Mode = "live" | "rendered";

export interface RenderAsset {
  assetId: string;
  durationS?: number | null;
}

function tab(activeTab: boolean): string {
  return `rounded px-2 py-0.5 transition-colors ${
    activeTab
      ? "bg-[var(--color-control)] text-[var(--color-accent-fg)]"
      : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
  }`;
}

/**
 * One monitor, two states: the exact rendered MP4 ("Rendered") vs. the live
 * browser-composited preview of the current edit ("Live"). They never show at
 * once. The toggle only appears when a finished render exists; otherwise the
 * monitor is always Live. When the render is stale (edited since), a note nudges
 * a re-render. ffmpeg stays the source of truth — Live is an approximation.
 */
export function ProgramMonitor({
  mode,
  onMode,
  engine,
  spec,
  renderAsset,
  dirty,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  engine: Engine;
  spec: RenderSpec;
  renderAsset: RenderAsset | null;
  dirty: boolean;
}) {
  const hasRender = !!renderAsset;
  const showRendered = mode === "rendered" && hasRender;

  return (
    <div className="relative flex h-full flex-col">
      {/* Live/Rendered toggle floats over the video so it doesn't steal space. */}
      {hasRender ? (
        <div className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)]/85 p-0.5 text-[11px] backdrop-blur">
          <button type="button" onClick={() => onMode("live")} className={tab(mode === "live")}>
            Live
          </button>
          <button type="button" onClick={() => onMode("rendered")} className={tab(mode === "rendered")}>
            Rendered
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {showRendered ? (
          <VideoPlayer assetId={renderAsset!.assetId} durationS={renderAsset!.durationS} fill />
        ) : (
          <PreviewMonitor {...engine} spec={spec} />
        )}
      </div>

      {hasRender && dirty ? (
        <p className="mt-1 shrink-0 text-[11px] text-[var(--color-warning)]">
          {showRendered ? (
            <>
              Edited since render — this MP4 is out of date.{" "}
              <button type="button" className="underline" onClick={() => onMode("live")}>
                Switch to Live
              </button>
              .
            </>
          ) : (
            <>Live preview (approximate) — rendered MP4 is out of date.</>
          )}
        </p>
      ) : null}
    </div>
  );
}
