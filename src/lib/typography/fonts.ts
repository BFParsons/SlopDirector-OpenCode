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
  | "NotoSerif-Bold"
  | "Jost-Regular"
  | "Jost-Medium"
  | "Jost-Bold"
  | "Montserrat-Light"
  | "Montserrat-SemiBold"
  | "Montserrat-Black"
  | "Oswald-Light"
  | "Oswald-Bold"
  | "BebasNeue-Regular"
  | "Anton-Regular"
  | "Cinzel-Regular"
  | "Cinzel-Bold"
  | "PlayfairDisplay-Regular"
  | "PlayfairDisplay-Bold"
  | "EBGaramond-Regular"
  | "EBGaramond-Bold"
  | "CormorantGaramond-Regular"
  | "CormorantGaramond-SemiBold"
  | "LibreFranklin-Bold"
  | "LibreFranklin-Black"
  | "LibreBaskerville-Regular"
  | "LibreBaskerville-Bold"
  | "CourierPrime-Regular"
  | "CourierPrime-Bold"
  | "ZillaSlab-Regular"
  | "ZillaSlab-Bold"
  | "Michroma-Regular"
  | "Nunito-Regular"
  | "Nunito-Bold"
  | "Archivo-ExpandedBold"
  | "PermanentMarker-Regular";

export interface Font {
  id: FontId;
  file: string;
  family: string;
  weight: 300 | 400 | 500 | 600 | 700 | 900;
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
  { id: "Jost-Regular", file: "Jost-Regular.ttf", family: "Jost", weight: 400, kind: "sans", avgAdvance: 0.53, voice: "geometric sans (Futura's stand-in) — Anderson's cards, A24 dates" },
  { id: "Jost-Medium", file: "Jost-Medium.ttf", family: "Jost", weight: 500, kind: "sans", avgAdvance: 0.54, voice: "geometric sans, medium — labels in the diorama" },
  { id: "Jost-Bold", file: "Jost-Bold.ttf", family: "Jost", weight: 700, kind: "sans", avgAdvance: 0.56, voice: "geometric sans, heavy — Futura Bold capitals on a colour field" },
  { id: "Montserrat-Light", file: "Montserrat-Light.ttf", family: "Montserrat", weight: 300, kind: "sans", avgAdvance: 0.6, voice: "wide geometric, light (Gotham Light / light Klavika) — Villeneuve, Woollen's cards" },
  { id: "Montserrat-SemiBold", file: "Montserrat-SemiBold.ttf", family: "Montserrat", weight: 600, kind: "sans", avgAdvance: 0.63, voice: "wide geometric, semi-bold (Gotham / Proxima) — creators' section titles" },
  { id: "Montserrat-Black", file: "Montserrat-Black.ttf", family: "Montserrat", weight: 900, kind: "sans", avgAdvance: 0.66, voice: "wide geometric, black (Gotham Bold / Avenir Black / Helvetica Neue Black) — Nolan titles, trailer titles" },
  { id: "Oswald-Light", file: "Oswald-Light.ttf", family: "Oswald", weight: 300, kind: "sans", avgAdvance: 0.4, voice: "condensed grotesk, light — thin trailer cards" },
  { id: "Oswald-Bold", file: "Oswald-Bold.ttf", family: "Oswald", weight: 700, kind: "sans", avgAdvance: 0.44, voice: "condensed grotesk, bold (Trade Gothic Bold Condensed / Tungsten) — attack-ad captions, trailer cards, wartime titles" },
  { id: "BebasNeue-Regular", file: "BebasNeue-Regular.ttf", family: "Bebas Neue", weight: 400, kind: "sans", avgAdvance: 0.4, voice: "condensed capitals — LEMMiNO titles, MrBeast thumbnails" },
  { id: "Anton-Regular", file: "Anton-Regular.ttf", family: "Anton", weight: 400, kind: "sans", avgAdvance: 0.44, voice: "heavy condensed (Impact's register) — MrBeast captions, Eisenstein intertitles, 1970s poster display" },
  { id: "Cinzel-Regular", file: "Cinzel-Regular.ttf", family: "Cinzel", weight: 400, kind: "serif", avgAdvance: 0.68, voice: "inscriptional capitals (Trajan's stand-in) — the epic title" },
  { id: "Cinzel-Bold", file: "Cinzel-Bold.ttf", family: "Cinzel", weight: 700, kind: "serif", avgAdvance: 0.7, voice: "inscriptional capitals, heavy" },
  { id: "PlayfairDisplay-Regular", file: "PlayfairDisplay-Regular.ttf", family: "Playfair Display", weight: 400, kind: "serif", avgAdvance: 0.5, voice: "display serif (Didot's stand-in) — A24 cards, Interstellar's register" },
  { id: "PlayfairDisplay-Bold", file: "PlayfairDisplay-Bold.ttf", family: "Playfair Display", weight: 700, kind: "serif", avgAdvance: 0.53, voice: "display serif, heavy" },
  { id: "EBGaramond-Regular", file: "EBGaramond-Regular.ttf", family: "EB Garamond", weight: 400, kind: "serif", avgAdvance: 0.45, voice: "book Garamond — Burns's names and dates, Apple Garamond's closing copy, Riney's card" },
  { id: "EBGaramond-Bold", file: "EBGaramond-Bold.ttf", family: "EB Garamond", weight: 700, kind: "serif", avgAdvance: 0.48, voice: "book Garamond, heavy — chapter titles" },
  { id: "CormorantGaramond-Regular", file: "CormorantGaramond-Regular.ttf", family: "Cormorant Garamond", weight: 400, kind: "serif", avgAdvance: 0.44, voice: "delicate display Garamond — Malick's title" },
  { id: "CormorantGaramond-SemiBold", file: "CormorantGaramond-SemiBold.ttf", family: "Cormorant Garamond", weight: 600, kind: "serif", avgAdvance: 0.46, voice: "delicate display Garamond, semi-bold" },
  { id: "LibreFranklin-Bold", file: "LibreFranklin-Bold.ttf", family: "Libre Franklin", weight: 700, kind: "sans", avgAdvance: 0.56, voice: "American gothic, bold (Franklin Gothic / Balto) — Vox and Harris labels, the Daisy card" },
  { id: "LibreFranklin-Black", file: "LibreFranklin-Black.ttf", family: "Libre Franklin", weight: 900, kind: "sans", avgAdvance: 0.58, voice: "American gothic, black — Harris's kinetic points" },
  { id: "LibreBaskerville-Regular", file: "LibreBaskerville-Regular.ttf", family: "Libre Baskerville", weight: 400, kind: "serif", avgAdvance: 0.55, voice: "Baskerville — Morris's cards (the typeface of truth)" },
  { id: "LibreBaskerville-Bold", file: "LibreBaskerville-Bold.ttf", family: "Libre Baskerville", weight: 700, kind: "serif", avgAdvance: 0.58, voice: "Baskerville, heavy — Morris's title" },
  { id: "CourierPrime-Regular", file: "CourierPrime-Regular.ttf", family: "Courier Prime", weight: 400, kind: "mono", avgAdvance: 0.6, voice: "typewriter (Courier / American Typewriter's register) — Chamberlain's captions" },
  { id: "CourierPrime-Bold", file: "CourierPrime-Bold.ttf", family: "Courier Prime", weight: 700, kind: "mono", avgAdvance: 0.6, voice: "typewriter, heavy" },
  { id: "ZillaSlab-Regular", file: "ZillaSlab-Regular.ttf", family: "Zilla Slab", weight: 400, kind: "serif", avgAdvance: 0.5, voice: "slab serif (Archer's stand-in) — Anderson's letters" },
  { id: "ZillaSlab-Bold", file: "ZillaSlab-Bold.ttf", family: "Zilla Slab", weight: 700, kind: "serif", avgAdvance: 0.52, voice: "slab serif, heavy" },
  { id: "Michroma-Regular", file: "Michroma-Regular.ttf", family: "Michroma", weight: 400, kind: "sans", avgAdvance: 0.78, voice: "extended technical sans (Eurostile Extended) — Villeneuve's monumental title" },
  { id: "Nunito-Regular", file: "Nunito-Regular.ttf", family: "Nunito", weight: 400, kind: "sans", avgAdvance: 0.55, voice: "rounded humanist sans (DIN Next Rounded's stand-in) — Jonze's lower-case, Gondry's credit" },
  { id: "Nunito-Bold", file: "Nunito-Bold.ttf", family: "Nunito", weight: 700, kind: "sans", avgAdvance: 0.57, voice: "rounded sans, bold — Vsauce labels" },
  { id: "Archivo-ExpandedBold", file: "Archivo-ExpandedBold.ttf", family: "Archivo Expanded", weight: 700, kind: "sans", avgAdvance: 0.72, voice: "extended grotesk, bold (Helvetica Extended — Nope, Get Out) — the horror trailer title" },
  { id: "PermanentMarker-Regular", file: "PermanentMarker-Regular.ttf", family: "Permanent Marker", weight: 400, kind: "sans", avgAdvance: 0.55, voice: "marker handwriting — Neistat's paper titles, McKinnon's brush flourish" },
];
export const FONT_IDS = FONTS.map((f) => f.id) as [FontId, ...FontId[]];
export const DEFAULT_FONT: FontId = "DejaVuSans-Bold";
export const fontById = (id: string | null | undefined): Font => FONTS.find((f) => f.id === id) ?? FONTS[0];
