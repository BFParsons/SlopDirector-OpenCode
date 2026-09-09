import type { PanelType } from "@/types/panel";
import type { WindowSize } from "@/types/window";

/**
 * Minimum panel sizes — FLOORS for react-rnd resizing, not design sizes.
 *
 * They are deliberately small so a full layout (5–7 panels) still fits a
 * ~936×411 workspace (a 1080p laptop at 2× display scale): panel bodies scroll
 * (PanelChrome) when squeezed. The default layouts/presets allocate columns and
 * rows no smaller than these, and `fitLayoutToContainer` respects them, so a
 * panel is never rendered larger than its stored size *and* off-screen.
 */
export const PANEL_MIN_SIZE: Partial<Record<PanelType, WindowSize>> = {
  monitor: { width: 280, height: 180 },
  "video-edit": { width: 260, height: 200 },
  "video-gen": { width: 180, height: 200 },
  voiceover: { width: 220, height: 180 },
  timeline: { width: 320, height: 140 },
  visual: { width: 240, height: 200 },
  "effect-controls": { width: 160, height: 140 },
  polish: { width: 240, height: 200 },
  "text-overlays": { width: 180, height: 140 },
  // Audio Studio: seven panels share one screen, so these are tighter still.
  "audio-multitrack": { width: 320, height: 140 },
  "audio-visualizer": { width: 160, height: 56 },
  "audio-importer": { width: 160, height: 160 },
  "stem-separation": { width: 160, height: 150 },
  "audio-processing": { width: 160, height: 160 },
  "loudness-meter": { width: 150, height: 150 },
  "audio-tools": { width: 160, height: 150 },
  "media-bucket": { width: 220, height: 180 },
  agent: { width: 260, height: 200 },
  "youtube-importer": { width: 260, height: 180 },
};

/** Fallback for panel types without an explicit entry. */
export const DEFAULT_PANEL_MIN: WindowSize = { width: 200, height: 120 };

export function panelMin(type: PanelType): WindowSize {
  return PANEL_MIN_SIZE[type] ?? DEFAULT_PANEL_MIN;
}
