"use client";

import type { RenderSpec } from "@/lib/render/spec";
import { usePreviewEngine } from "./usePreviewEngine";

function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const cs = Math.floor((t - s) * 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${cs}`;
}

/**
 * Live preview body — composites the timeline in the browser in real time
 * (canvas + transport, no surrounding card). Edits reflect instantly (no server
 * render); the exported MP4 is the truth. Wrapped by {@link ProgramMonitor}.
 */
export function PreviewMonitor({
  spec,
  time,
  playing,
  toggle,
  seek,
  volume,
  setVolume,
  canvasRef,
  voRef,
  musicRef,
}: ReturnType<typeof usePreviewEngine> & { spec: RenderSpec }) {
  // Match the Video Edit panel: flat grey transport buttons, no accent circle.
  const ctrlBtn =
    "flex h-5 items-center justify-center rounded border border-[var(--color-border)] px-1.5 text-[11px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] disabled:opacity-40";
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-black">
        <canvas
          ref={canvasRef}
          width={spec.width}
          height={spec.height}
          className="block max-h-full max-w-full cursor-pointer"
          style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
          onClick={toggle}
        />
      </div>

      <audio ref={voRef} preload="auto" />
      <audio ref={musicRef} preload="auto" />

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" className={ctrlBtn} title="Play" aria-label="Play" disabled={playing} onClick={toggle}>
          ▶
        </button>
        <button type="button" className={ctrlBtn} title="Pause" aria-label="Pause" disabled={!playing} onClick={toggle}>
          ❚❚
        </button>
        <input
          type="range"
          min={0}
          max={spec.duration}
          step={0.01}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 flex-1 accent-[var(--color-fg)]"
        />
        <span className="shrink-0 font-mono tnum text-[11px] text-[var(--color-muted)]">
          {clock(time)} / {clock(spec.duration)}
        </span>
        <button
          type="button"
          className={ctrlBtn}
          title={volume === 0 ? "Unmute" : "Mute"}
          aria-label={volume === 0 ? "Unmute" : "Mute"}
          onClick={() => setVolume(volume === 0 ? 1 : 0)}
        >
          {volume === 0 ? "🔇" : "🔊"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          title="Volume"
          aria-label="Volume"
          className="h-1 w-14 shrink-0 accent-[var(--color-fg)]"
        />
      </div>
    </div>
  );
}
