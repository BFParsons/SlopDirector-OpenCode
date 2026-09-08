import type { WorkspaceLayoutData } from "@/types/window";
import type { PanelType } from "@/types/panel";
import { makeWindow } from "@/lib/studio/window-utils";
import { panelMin } from "@/config/panel-min-sizes";

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
  // The "Audio Studio Default" — the arrangement captured from the user's saved
  // layout (Importer column | Visualizer over Multitrack | a 2×2 grid of
  // Loudness / Stems / Rack / Tools), expressed as fractions of the live
  // workspace so it fits any display. (It was fixed pixels tuned for a
  // ~2100×780 workspace, which put most panels off-screen on a laptop.) The
  // fixed columns/rows never drop below their panels' minimums; the flexible
  // centre (Visualizer + Multitrack) absorbs the difference.
  "audio-studio": (cw, ch) => {
    const g = 8;
    const m = panelMin;
    const impW = Math.max(Math.round(cw * 0.155), m("audio-importer").width);
    const colW = Math.max(
      Math.round(cw * 0.135),
      m("loudness-meter").width, m("stem-separation").width, m("audio-processing").width, m("audio-tools").width,
    );
    const midW = Math.max(cw - g * 5 - impW - colW * 2, m("audio-visualizer").width, m("audio-multitrack").width);
    const midX = g + impW + g;
    const rightX = midX + midW + g;
    const col2X = rightX + colW + g;
    const rowH = Math.max(Math.round(ch * 0.41), m("loudness-meter").height, m("stem-separation").height);
    const row2Y = g + rowH + g;
    const row2H = Math.max(ch - row2Y - g, m("audio-processing").height, m("audio-tools").height);
    const mtH = Math.max(Math.round(ch * 0.42), m("audio-multitrack").height);
    const visH = Math.max(ch - g * 3 - mtH, m("audio-visualizer").height);
    const mtY = g + visH + g;
    return {
      version: 2,
      nextZIndex: 14,
      container: { width: cw, height: ch },
      windows: [
        makeWindow("audio-importer", "Audio Importer", g, g, impW, Math.max(ch - g * 2, m("audio-importer").height), 1),
        makeWindow("audio-visualizer", "Visualizer", midX, g, midW, visH, 4),
        makeWindow("loudness-meter", "Loudness Meter", rightX, g, colW, rowH, 11),
        makeWindow("stem-separation", "Stem Separation", col2X, g, colW, rowH, 12),
        makeWindow("audio-processing", "Processing Rack", rightX, row2Y, colW, row2H, 10),
        makeWindow("audio-tools", "Audio Tools", col2X, row2Y, colW, row2H, 9),
        makeWindow("audio-multitrack", "Multitrack Timeline", midX, mtY, midW, mtH, 13),
      ],
    };
  },
};
