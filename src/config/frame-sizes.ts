import { ASPECT_RATIOS, FRAME_DIMENSIONS, RESOLUTIONS } from "./models";

/**
 * Video frame sizes: the preset catalogue offered when creating a project, and
 * the helpers that turn a project's stored size into pixels.
 *
 * A project stores EITHER a custom `frameWidth`×`frameHeight` (px, even) or
 * nothing — in which case its `aspectRatio` + `resolution` preset applies.
 * Custom sizes still carry the closest aspectRatio/resolution so AI video
 * providers (which think in 16:9 / 9:16 / 1:1) and legacy code keep working.
 */

export type AspectKey = keyof typeof ASPECT_RATIOS;
export type ResolutionKey = keyof typeof RESOLUTIONS;

export interface FramePreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

export interface FramePresetGroup {
  group: string;
  presets: FramePreset[];
}

/** Popular sizes by medium, up to 4K. Each is a real encoder-friendly (even) size. */
export const FRAME_PRESET_GROUPS: FramePresetGroup[] = [
  {
    group: "YouTube / web (16:9)",
    presets: [
      { id: "hd-720", label: "HD 720p", w: 1280, h: 720 },
      { id: "fhd-1080", label: "Full HD 1080p", w: 1920, h: 1080 },
      { id: "qhd-1440", label: "QHD 1440p", w: 2560, h: 1440 },
      { id: "uhd-4k", label: "4K UHD", w: 3840, h: 2160 },
    ],
  },
  {
    group: "Cinema (DCI)",
    presets: [
      { id: "dci-2k", label: "DCI 2K", w: 2048, h: 1080 },
      { id: "dci-4k", label: "DCI 4K", w: 4096, h: 2160 },
    ],
  },
  {
    group: "Vertical — TikTok / Reels / Shorts (9:16)",
    presets: [
      { id: "v-720", label: "Vertical HD", w: 720, h: 1280 },
      { id: "v-1080", label: "Vertical Full HD", w: 1080, h: 1920 },
      { id: "v-4k", label: "Vertical 4K", w: 2160, h: 3840 },
    ],
  },
  {
    group: "Square — Instagram / Facebook feed (1:1)",
    presets: [
      { id: "sq-720", label: "Square 720", w: 720, h: 720 },
      { id: "sq-1080", label: "Square 1080", w: 1080, h: 1080 },
    ],
  },
  {
    group: "Portrait feed (4:5)",
    presets: [{ id: "p-1080", label: "Portrait 4:5", w: 1080, h: 1350 }],
  },
  {
    group: "Ultrawide (21:9)",
    presets: [
      { id: "uw-1080", label: "Ultrawide FHD", w: 2560, h: 1080 },
      { id: "uw-1440", label: "Ultrawide QHD", w: 3440, h: 1440 },
    ],
  },
  {
    group: "Classic TV (4:3)",
    presets: [
      { id: "tv-720", label: "4:3 SD+", w: 960, h: 720 },
      { id: "tv-1080", label: "4:3 Full HD", w: 1440, h: 1080 },
    ],
  },
];

export const FRAME_PRESETS: FramePreset[] = FRAME_PRESET_GROUPS.flatMap((g) => g.presets);
export const DEFAULT_FRAME_PRESET_ID = "fhd-1080";
export const CUSTOM_FRAME_ID = "custom";

/** Allowed custom size per side (px). 4320 admits DCI 4K (4096) and vertical 4K. */
export const FRAME_MIN = 16;
export const FRAME_MAX = 4320;

/** Round to the nearest even number (yuv420p needs even dimensions), within range. */
export function evenize(n: number): number {
  const v = Math.min(FRAME_MAX, Math.max(FRAME_MIN, Math.round(n)));
  return v % 2 === 0 ? v : v + 1 > FRAME_MAX ? v - 1 : v + 1;
}

export function presetFor(w: number, h: number): FramePreset | undefined {
  return FRAME_PRESETS.find((p) => p.w === w && p.h === h);
}

/** The pixel frame for a project: custom size if set, else the aspect/resolution preset. */
export function frameSize(p: {
  aspectRatio: AspectKey;
  resolution: ResolutionKey;
  frameWidth?: number | null;
  frameHeight?: number | null;
}): { w: number; h: number } {
  if (p.frameWidth && p.frameHeight && p.frameWidth > 0 && p.frameHeight > 0) {
    return { w: p.frameWidth, h: p.frameHeight };
  }
  return FRAME_DIMENSIONS[p.aspectRatio][p.resolution];
}

/** Nearest of the three provider-facing aspect presets (by log-ratio distance). */
export function closestAspect(w: number, h: number): AspectKey {
  const r = Math.log(w / h);
  const candidates: [AspectKey, number][] = [
    ["R16_9", Math.log(16 / 9)],
    ["R9_16", Math.log(9 / 16)],
    ["R1_1", 0],
  ];
  return candidates.sort((a, b) => Math.abs(r - a[1]) - Math.abs(r - b[1]))[0][0];
}

/** Nearest resolution tier by the frame's shorter side. */
export function closestResolution(w: number, h: number): ResolutionKey {
  const s = Math.min(w, h);
  return s <= 600 ? "R480P" : s <= 900 ? "R720P" : "R1080P";
}

const RATIO_NAMES: [string, number][] = [
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["21:9", 21 / 9],
  ["2.39:1", 2.39],
  ["1.85:1", 1.85],
  ["3:2", 3 / 2],
  ["2:3", 2 / 3],
];

/** Human label like "16:9 · Full HD" (or "1.78:1 · 4K" for odd ratios). */
export function describeFrame(w: number, h: number): string {
  const r = w / h;
  const named = RATIO_NAMES.find(([, v]) => Math.abs(r - v) / v < 0.01);
  const ratio = named ? named[0] : `${r.toFixed(2)}:1`;
  const s = Math.min(w, h);
  const tier = s >= 2160 ? "4K" : s >= 1440 ? "QHD" : s >= 1080 ? "Full HD" : s >= 720 ? "HD" : "SD";
  return `${ratio} · ${tier}`;
}
