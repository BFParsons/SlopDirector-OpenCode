import type { WorkspaceLayoutData } from "@/types/window";
import { makeWindow } from "@/lib/studio/window-utils";

export type PresetFactory = (cw: number, ch: number) => WorkspaceLayoutData;

/** Named workspace presets. Each is recomputed to the live container size, so the
 *  same preset "fits whatever display" you apply it on. */
export const PRESETS: Record<string, PresetFactory> = {
  editing: (cw, ch) => ({
    version: 2,
    nextZIndex: 4,
    windows: [
      makeWindow("visual", "Visual / Media", 8, 8, cw * 0.26, ch - 16, 1),
      makeWindow("monitor", "Program Monitor", cw * 0.26 + 16, 8, cw * 0.72 - 24, ch * 0.55, 3),
      makeWindow("timeline", "Timeline", cw * 0.26 + 16, ch * 0.55 + 16, cw * 0.72 - 24, ch * 0.45 - 24, 2),
    ],
  }),
  finishing: (cw, ch) => ({
    version: 2,
    nextZIndex: 4,
    windows: [
      makeWindow("monitor", "Program Monitor", 8, 8, cw * 0.6 - 12, ch - 16, 3),
      makeWindow("polish", "Polish", cw * 0.6 + 4, 8, cw * 0.4 - 12, ch * 0.6, 2),
      makeWindow("text-overlays", "Text Overlays", cw * 0.6 + 4, ch * 0.6 + 16, cw * 0.4 - 12, ch * 0.4 - 24, 1),
    ],
  }),
  audio: (cw, ch) => ({
    version: 2,
    nextZIndex: 4,
    windows: [
      makeWindow("monitor", "Program Monitor", 8, 8, cw * 0.5 - 12, ch * 0.55, 3),
      makeWindow("audio", "Audio", cw * 0.5 + 4, 8, cw * 0.5 - 12, ch * 0.55, 2),
      makeWindow("timeline", "Timeline", 8, ch * 0.55 + 16, cw - 16, ch * 0.45 - 24, 1),
    ],
  }),
  everything: (cw, ch) => ({
    version: 2,
    nextZIndex: 7,
    windows: [
      makeWindow("visual", "Visual / Media", 8, 8, cw * 0.24, ch - 16, 1),
      makeWindow("monitor", "Program Monitor", cw * 0.24 + 16, 8, cw * 0.46, ch * 0.55, 6),
      makeWindow("timeline", "Timeline", cw * 0.24 + 16, ch * 0.55 + 16, cw * 0.46, ch * 0.45 - 24, 5),
      makeWindow("audio", "Audio", cw * 0.72 + 16, 8, cw * 0.28 - 24, ch * 0.34, 2),
      makeWindow("polish", "Polish", cw * 0.72 + 16, ch * 0.34 + 16, cw * 0.28 - 24, ch * 0.34, 3),
      makeWindow("text-overlays", "Text Overlays", cw * 0.72 + 16, ch * 0.68 + 24, cw * 0.28 - 24, ch * 0.32 - 32, 4),
    ],
  }),
  // The Audio Studio default arrangement: an importer/tools column on the left,
  // the multitrack timeline filling the center bottom, with the visualizer and
  // stem-separation/processing tools across the top.
  "audio-studio": (cw, ch) => ({
    version: 2,
    nextZIndex: 8,
    windows: [
      makeWindow("audio-importer", "Audio Importer", 8, 8, cw * 0.22, ch - 16, 1),
      makeWindow("audio-visualizer", "Visualizer", cw * 0.22 + 16, 8, cw * 0.42, ch * 0.42, 4),
      makeWindow("stem-separation", "Stem Separation", cw * 0.64 + 16, 8, cw * 0.36 - 24, ch * 0.42, 5),
      makeWindow("audio-multitrack", "Multitrack Timeline", cw * 0.22 + 16, ch * 0.42 + 16, cw * 0.78 - 24, ch * 0.58 - 24, 3),
      makeWindow("audio-processing", "Processing Rack", cw * 0.64 + 16, ch * 0.42 + 16, cw * 0.18, ch * 0.58 - 24, 6),
      makeWindow("audio-tools", "Audio Tools", cw * 0.82 + 16, ch * 0.42 + 16, cw * 0.18 - 24, ch * 0.58 - 24, 7),
      makeWindow("loudness-meter", "Loudness Meter", cw * 0.44, ch * 0.2, cw * 0.2, ch * 0.5, 2),
    ],
  }),
};
