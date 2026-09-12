/**
 * Typography presets: a use (lower-third, card, caption…) resolved to a face,
 * a size, a placement inside the title-safe area, a treatment (box, outline,
 * shadow) and an entrance. The styles (src/lib/styles) point at them; the
 * MCP add_text_overlay takes `preset` and fills the fields from here.
 *
 * Sizes are % of frame height. On a vertical frame the height is the long
 * side, so a lower-third that is 4 % of 1080 reads as 4 % of 1920 — too big
 * for a name, right for a caption; `sizePctVertical` says what to use there.
 */
import type { FontId } from "./fonts";

export type TextAnimationId = "NONE" | "FADE" | "SLIDE_UP" | "POP";
export type Transform = "none" | "upper" | "lower" | "tracked-upper";

export interface TypePreset {
  id: string;
  name: string;
  /** when to reach for it */
  use: string;
  font: FontId;
  transform: Transform;
  sizePct: number;
  sizePctVertical: number;
  position: string;
  color: string;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  /** outline width as % of the font size (0 = none) */
  outlineW: number;
  /** drop shadow offset as % of the font size (0 = none) */
  shadow: number;
  animation: TextAnimationId;
  /** inset beyond the title-safe edge (px at 1080p; scaled by frame height) */
  marginPx: number;
  /** default hold when endS is not given */
  holdS: number;
  /** longest comfortable line (characters) */
  maxChars: number;
}

export const TYPE_PRESETS: TypePreset[] = [
  { id: "lower-third", name: "Lower-third", use: "a name and a role, a place and a time — broadcast style, bottom-left, on a translucent bar", font: "LiberationSans-Bold", transform: "none", sizePct: 4, sizePctVertical: 3.2, position: "BOTTOM_LEFT", color: "#FFFFFF", boxEnabled: true, boxColor: "#000000", boxOpacity: 0.6, outlineW: 0, shadow: 0, animation: "SLIDE_UP", marginPx: 0, holdS: 3.5, maxChars: 34 },
  { id: "callout", name: "Callout", use: "a number, a spec, a fact spoken by the narrator, shown when it is said — small, top-left, thin box", font: "NotoSans-Regular", transform: "none", sizePct: 3.4, sizePctVertical: 2.8, position: "TOP_LEFT", color: "#FFFFFF", boxEnabled: true, boxColor: "#000000", boxOpacity: 0.45, outlineW: 0, shadow: 0, animation: "FADE", marginPx: 0, holdS: 3, maxChars: 40 },
  { id: "caption-pop", name: "Pop caption", use: "the key words as they are spoken — heavy, centred low, outlined, popping in on the word (retention cuts, attack ads)", font: "DejaVuSans-Bold", transform: "upper", sizePct: 6.5, sizePctVertical: 5.5, position: "BOTTOM_CENTER", color: "#FFFFFF", boxEnabled: false, boxColor: "#000000", boxOpacity: 0, outlineW: 9, shadow: 0, animation: "POP", marginPx: 0, holdS: 1.8, maxChars: 22 },
  { id: "card-archive", name: "Archive card", use: "one line of the argument on black — small, plain, lower-case, centred (the essay film)", font: "NotoSans-Regular", transform: "lower", sizePct: 4.2, sizePctVertical: 3.6, position: "CENTER", color: "#FFFFFF", boxEnabled: false, boxColor: "#000000", boxOpacity: 0, outlineW: 0, shadow: 0, animation: "NONE", marginPx: 0, holdS: 3.5, maxChars: 44 },
  { id: "card-editorial", name: "Editorial card", use: "a quote, a date, a chapter — serif, centred, fading (the prestige trailer, the chronicle)", font: "LiberationSerif-Regular", transform: "none", sizePct: 5.2, sizePctVertical: 4.2, position: "CENTER", color: "#FFFFFF", boxEnabled: false, boxColor: "#000000", boxOpacity: 0, outlineW: 0, shadow: 0, animation: "FADE", marginPx: 0, holdS: 3, maxChars: 40 },
  { id: "title", name: "Film title", use: "the name of the clip or film — its own display treatment, centred with breathing room; use card or intertitle for statements and chapters", font: "LiberationSans-Bold", transform: "upper", sizePct: 9, sizePctVertical: 6.5, position: "CENTER", color: "#FFFFFF", boxEnabled: false, boxColor: "#000000", boxOpacity: 0, outlineW: 0, shadow: 0, animation: "FADE", marginPx: 0, holdS: 4, maxChars: 18 },
  { id: "intertitle", name: "Intertitle", use: "a line between sequences, capitals in a serif on black (silent-film grammar, the collision cut)", font: "LiberationSerif-Bold", transform: "upper", sizePct: 6, sizePctVertical: 4.6, position: "CENTER", color: "#FFFFFF", boxEnabled: false, boxColor: "#000000", boxOpacity: 0, outlineW: 0, shadow: 0, animation: "NONE", marginPx: 0, holdS: 2.5, maxChars: 28 },
  { id: "quote", name: "Quote", use: "a reading or a quotation over picture — serif, left, no box, the attribution as a second line", font: "LiberationSerif-Regular", transform: "none", sizePct: 4.4, sizePctVertical: 3.6, position: "MIDDLE_LEFT", color: "#FFFFFF", boxEnabled: false, boxColor: "#000000", boxOpacity: 0, outlineW: 4, shadow: 0, animation: "FADE", marginPx: 0, holdS: 5, maxChars: 44 },
  { id: "date-card", name: "Date card", use: "a place and a date, small, bottom-right, no box — the chronicle's stamp", font: "LiberationSans-Regular", transform: "none", sizePct: 3.6, sizePctVertical: 3, position: "BOTTOM_RIGHT", color: "#FFFFFF", boxEnabled: false, boxColor: "#000000", boxOpacity: 0, outlineW: 5, shadow: 0, animation: "FADE", marginPx: 0, holdS: 3, maxChars: 30 },
  { id: "map-label", name: "Map label", use: "a place name landing on the map as it is spoken — heavy sans, small box", font: "NotoSans-Bold", transform: "none", sizePct: 3, sizePctVertical: 2.6, position: "CENTER", color: "#FFFFFF", boxEnabled: true, boxColor: "#000000", boxOpacity: 0.35, outlineW: 0, shadow: 0, animation: "SLIDE_UP", marginPx: 0, holdS: 2.5, maxChars: 24 },
  { id: "mono-note", name: "Mono note", use: "a source, a timestamp, the vlogger's aside — typewriter, bottom-left, box", font: "LiberationMono-Regular", transform: "none", sizePct: 3.2, sizePctVertical: 2.8, position: "BOTTOM_LEFT", color: "#FFFFFF", boxEnabled: true, boxColor: "#000000", boxOpacity: 0.5, outlineW: 0, shadow: 0, animation: "NONE", marginPx: 0, holdS: 2.5, maxChars: 40 },
  { id: "citation", name: "Citation", use: "film · year, or a source line, under a clip — tiny, bottom-left, thin box, gone before it is noticed", font: "NotoSans-Regular", transform: "none", sizePct: 2.6, sizePctVertical: 2.2, position: "BOTTOM_LEFT", color: "#FFFFFF", boxEnabled: true, boxColor: "#000000", boxOpacity: 0.4, outlineW: 0, shadow: 0, animation: "FADE", marginPx: 0, holdS: 2.5, maxChars: 48 },
];
export const presetById = (id: string | null | undefined) => TYPE_PRESETS.find((p) => p.id === id);

export interface OverlayFields {
  text: string;
  position: string;
  sizePct: number;
  color: string;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  marginPx: number;
  font: FontId;
  outlineW: number;
  shadow: number;
  animation: TextAnimationId;
  startS: number;
  endS: number | null;
  preset: string;
}

/** tracked-upper: capitals with a space between letters (three between words) — drawtext has no letter-spacing, so the tracking is in the text. */
export const transformText = (t: string, how: Transform) =>
  how === "upper" ? t.toUpperCase() : how === "lower" ? t.toLowerCase() : how === "tracked-upper" ? t.toUpperCase().split(/\r?\n/).map((line) => line.split(/\s+/).filter(Boolean).map((w) => [...w].join(" ")).join("   ")).join("\n") : t;
const transform = transformText;

/** Resolve a preset for a frame into overlay fields; explicit overrides win. */
export function applyPreset(preset: TypePreset, frame: { w: number; h: number }, text: string, startS: number, overrides: Partial<Omit<OverlayFields, "text" | "preset" | "startS">> & { endS?: number | null } = {}): OverlayFields {
  const vertical = frame.w / Math.max(1, frame.h) < 0.8;
  const sizePct = overrides.sizePct ?? (vertical ? preset.sizePctVertical : preset.sizePct);
  const scale = frame.h / 1080;
  return {
    text: transform(text, preset.transform),
    position: overrides.position ?? preset.position,
    sizePct: Math.round(sizePct),
    color: overrides.color ?? preset.color,
    boxEnabled: overrides.boxEnabled ?? preset.boxEnabled,
    boxColor: overrides.boxColor ?? preset.boxColor,
    boxOpacity: overrides.boxOpacity ?? preset.boxOpacity,
    marginPx: overrides.marginPx ?? Math.round(preset.marginPx * scale),
    font: overrides.font ?? preset.font,
    outlineW: overrides.outlineW ?? preset.outlineW,
    shadow: overrides.shadow ?? preset.shadow,
    animation: overrides.animation ?? preset.animation,
    startS,
    endS: overrides.endS === undefined ? +(startS + preset.holdS).toFixed(2) : overrides.endS,
    preset: preset.id,
  };
}
