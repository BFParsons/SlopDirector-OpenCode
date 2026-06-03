import type { WorkspaceLayoutData } from "@/types/window";
import type { PanelType } from "@/types/panel";
import { makeWindow } from "@/lib/studio/window-utils";

export type WorkspaceSection = "audio" | "video";

export type PresetFactory = (cw: number, ch: number) => WorkspaceLayoutData;

/** Panels that belong to the Audio Editing Suite (everything else is Video
 *  Assembly). Used to keep the two workspaces discrete and to self-heal a saved
 *  layout that accidentally mixed panels from both. */
export const AUDIO_STUDIO_PANELS = new Set<PanelType>([
  "audio-multitrack",
  "audio-visualizer",
  "audio-importer",
  "stem-separation",
  "audio-processing",
  "loudness-meter",
  "audio-tools",
]);

export function panelSection(type: PanelType): WorkspaceSection {
  return AUDIO_STUDIO_PANELS.has(type) ? "audio" : "video";
}

/** Panels allowed in BOTH suites (so they survive a section's layout sanitize).
 *  The Media Bucket is the project's asset shelf — useful in Video Assembly AND
 *  the Audio Studio (drag a bucket audio file straight onto the multitrack). */
export const SHARED_PANELS = new Set<PanelType>(["media-bucket"]);

/** Whether a panel may appear in the given section (its home section, or shared). */
export function panelAllowedIn(type: PanelType, section: WorkspaceSection): boolean {
  return panelSection(type) === section || SHARED_PANELS.has(type);
}

/** Which presets each section offers in the Workspace menu. */
export const SECTION_PRESETS: Record<WorkspaceSection, string[]> = {
  audio: ["audio-studio"],
  video: ["editing", "finishing", "audio", "everything"],
};

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
  // The hardcoded "Audio Studio Default" — captured from the user's saved layout
  // so it stays the permanent default. Fixed pixel positions (tuned on a wide
  // screen); bounds="parent" keeps every panel draggable on smaller displays.
  "audio-studio": () => ({
    version: 2,
    nextZIndex: 14,
    windows: [
      makeWindow("audio-importer", "Audio Importer", 8, 8, 322, 766, 1),
      makeWindow("audio-visualizer", "Visualizer", 338, 8, 1166, 439, 4),
      makeWindow("loudness-meter", "Loudness Meter", 1513, 7, 290, 320, 11),
      makeWindow("stem-separation", "Stem Separation", 1812, 9, 280, 323, 12),
      makeWindow("audio-processing", "Processing Rack", 1517, 340, 264, 430, 10),
      makeWindow("audio-tools", "Audio Tools", 1812, 344, 280, 427, 9),
      makeWindow("audio-multitrack", "Multitrack Timeline", 338, 455, 1169, 319, 13),
    ],
  }),
};
