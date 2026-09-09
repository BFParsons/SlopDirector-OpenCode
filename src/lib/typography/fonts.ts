/**
 * The bundled faces (public/fonts, licences in LICENSES.md). A font id is what
 * a text overlay stores; the render joins `file` onto the fonts dir, the
 * preview uses `family` + `weight` through @font-face, the checks use
 * `avgAdvance` (average glyph advance in em) to estimate a text box.
 */
export type FontId =
  | "DejaVuSans-Bold"
  | "DejaVuSans"
  | "LiberationSans-Regular"
  | "LiberationSans-Bold"
  | "LiberationSerif-Regular"
  | "LiberationSerif-Bold"
  | "LiberationMono-Regular"
  | "LiberationMono-Bold"
  | "NotoSans-Regular"
  | "NotoSans-Bold"
  | "NotoSerif-Regular"
  | "NotoSerif-Bold";

export interface Font {
  id: FontId;
  file: string;
  family: string;
  weight: 400 | 700;
  kind: "sans" | "serif" | "mono";
  /** average advance width in em for mixed-case English text */
  avgAdvance: number;
  /** what it is for, in a line */
  voice: string;
}

export const FONTS: Font[] = [
  { id: "DejaVuSans-Bold", file: "DejaVuSans-Bold.ttf", family: "DejaVu Sans", weight: 700, kind: "sans", avgAdvance: 0.62, voice: "wide, heavy, unmistakable — kinetic captions and big numbers" },
  { id: "DejaVuSans", file: "DejaVuSans.ttf", family: "DejaVu Sans", weight: 400, kind: "sans", avgAdvance: 0.58, voice: "plain, wide — notes and small labels" },
  { id: "LiberationSans-Bold", file: "LiberationSans-Bold.ttf", family: "Liberation Sans", weight: 700, kind: "sans", avgAdvance: 0.55, voice: "the broadcast grotesk (Arial-metric) — lower-thirds, titles, trailer cards" },
  { id: "LiberationSans-Regular", file: "LiberationSans-Regular.ttf", family: "Liberation Sans", weight: 400, kind: "sans", avgAdvance: 0.52, voice: "neutral grotesk — date cards, credits, callouts" },
  { id: "LiberationSerif-Bold", file: "LiberationSerif-Bold.ttf", family: "Liberation Serif", weight: 700, kind: "serif", avgAdvance: 0.5, voice: "the book serif, heavy (Times-metric) — intertitles, chapter titles" },
  { id: "LiberationSerif-Regular", file: "LiberationSerif-Regular.ttf", family: "Liberation Serif", weight: 400, kind: "serif", avgAdvance: 0.47, voice: "the book serif — quotations, readings, editorial cards" },
  { id: "LiberationMono-Bold", file: "LiberationMono-Bold.ttf", family: "Liberation Mono", weight: 700, kind: "mono", avgAdvance: 0.6, voice: "typewriter, heavy — evidence, timestamps" },
  { id: "LiberationMono-Regular", file: "LiberationMono-Regular.ttf", family: "Liberation Mono", weight: 400, kind: "mono", avgAdvance: 0.6, voice: "typewriter — notes, sources, the vlogger's aside" },
  { id: "NotoSans-Bold", file: "NotoSans-Bold.ttf", family: "Noto Sans", weight: 700, kind: "sans", avgAdvance: 0.56, voice: "clean humanist sans, heavy — map labels, section titles" },
  { id: "NotoSans-Regular", file: "NotoSans-Regular.ttf", family: "Noto Sans", weight: 400, kind: "sans", avgAdvance: 0.53, voice: "clean humanist sans — archive cards, callouts, captions that explain" },
  { id: "NotoSerif-Bold", file: "NotoSerif-Bold.ttf", family: "Noto Serif", weight: 700, kind: "serif", avgAdvance: 0.54, voice: "modern serif, heavy — documentary chapter cards" },
  { id: "NotoSerif-Regular", file: "NotoSerif-Regular.ttf", family: "Noto Serif", weight: 400, kind: "serif", avgAdvance: 0.51, voice: "modern serif — quotes and dates on black" },
];
export const FONT_IDS = FONTS.map((f) => f.id) as [FontId, ...FontId[]];
export const DEFAULT_FONT: FontId = "DejaVuSans-Bold";
export const fontById = (id: string | null | undefined): Font => FONTS.find((f) => f.id === id) ?? FONTS[0];
