/**
 * Burned-in captions via libass. Turns the proportionally-timed caption cues
 * (captions.ts) into an .ass subtitle file the `ass` filter renders with real
 * typography: outline + shadow, an opaque box, or a "pop" entrance — none of
 * which drawtext can do well. Fonts come from the bundled DejaVu faces
 * (FONTS_DIR is passed as the filter's fontsdir).
 */
import type { SafeAreas } from "@/lib/typography/safe";
import type { CaptionCue } from "./captions";

export type CaptionStyle = "OUTLINE" | "BOX" | "POP";
export const CAPTION_STYLES: { value: CaptionStyle; label: string; blurb: string }[] = [
  { value: "OUTLINE", label: "Outline", blurb: "White text, black outline + soft shadow (broadcast look)." },
  { value: "BOX", label: "Box", blurb: "White text on a translucent black box (social / muted autoplay)." },
  { value: "POP", label: "Pop", blurb: "Outline style with a quick fade-and-scale entrance per cue." },
];

/** ASS numpad alignment for the 9-grid overlay positions. */
function alignment(position: string): number {
  const top = position.startsWith("TOP");
  const bottom = position.startsWith("BOTTOM");
  const left = position.endsWith("LEFT");
  const right = position.endsWith("RIGHT");
  const col = left ? 1 : right ? 3 : 2;
  return top ? 6 + col : bottom ? col : 3 + col;
}

/** Seconds → ASS timestamp H:MM:SS.cc */
function ts(s: number): string {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Escape cue text for an ASS Dialogue line (no override tags from user text). */
function esc(text: string): string {
  return text.replace(/[{}]/g, (c) => (c === "{" ? "(" : ")")).replace(/\r?\n/g, "\\N");
}

export function buildAss(
  cues: CaptionCue[],
  opts: { width: number; height: number; style: CaptionStyle; fontName?: string; safe?: SafeAreas },
): string {
  const { width, height } = opts;
  const font = opts.fontName ?? "DejaVu Sans";
  const first = cues[0];
  const sizePct = first?.sizePct ?? 6;
  const fontSize = Math.max(10, Math.round((sizePct / 100) * height));
  const align = alignment(first?.position ?? "BOTTOM_CENTER");
  // Margins from the title-safe area (plus the cue's own inset) — MarginV is
  // measured from the top for top alignments (7–9) and from the bottom otherwise.
  const inset = Math.max(0, Math.round(first?.marginPx ?? 0));
  const T = opts.safe?.title;
  const marginL = (T ? T.x : 40) + inset;
  const marginR = (T ? width - (T.x + T.w) : 40) + inset;
  const marginV = (T ? (align >= 7 ? T.y : height - (T.y + T.h)) : 40) + inset;
  const outline = Math.max(1, Math.round(fontSize * 0.08));
  const shadow = Math.max(0, Math.round(fontSize * 0.04));
  // BorderStyle 3 = opaque box (BackColour), 1 = outline + shadow.
  const box = opts.style === "BOX";
  const styleLine = [
    "Style: Caption",
    font,
    String(fontSize),
    "&H00FFFFFF", // PrimaryColour (white)
    "&H000000FF", // SecondaryColour
    "&H00000000", // OutlineColour (black)
    box ? "&H60000000" : "&H80000000", // BackColour (box ≈ 62% / shadow 50% black)
    "-1", // Bold
    "0", // Italic
    "0", // Underline
    "0", // StrikeOut
    "100",
    "100", // ScaleX/Y
    "0", // Spacing
    "0", // Angle
    box ? "3" : "1", // BorderStyle
    String(box ? Math.round(fontSize * 0.25) : outline), // Outline (box: padding)
    String(box ? 0 : shadow), // Shadow
    String(align),
    String(marginL), // MarginL
    String(marginR), // MarginR
    String(marginV), // MarginV
    "1", // Encoding
  ].join(",");

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    styleLine,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const pop = opts.style === "POP" ? "{\\fad(120,120)\\fscx88\\fscy88\\t(0,140,\\fscx100\\fscy100)}" : "";
  const fade = opts.style !== "POP" ? "{\\fad(60,60)}" : "";
  const lines = cues
    .filter((c) => c.text.trim() && c.endS > c.startS)
    .map((c) => `Dialogue: 0,${ts(c.startS)},${ts(c.endS)},Caption,,0,0,0,,${pop || fade}${esc(c.text)}`);

  return [...header, ...lines, ""].join("\n");
}
