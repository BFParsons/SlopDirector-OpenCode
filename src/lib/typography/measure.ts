/**
 * A text box estimate without a font engine: lines × line height, the
 * longest line × the face's average advance. Conservative enough for a
 * safe-area check (upper-case and digits run wider; a 12 % pad is added).
 */
import { fontById } from "./fonts";

export interface TextBox {
  w: number;
  h: number;
  lines: string[];
  longest: number;
  /** box padding used when a background box is drawn (px each side) */
  pad: number;
}

const wideRatio = (s: string) => {
  const letters = s.replace(/\s/g, "");
  if (!letters) return 1;
  const wide = (letters.match(/[A-Z0-9MW@#%&]/g) ?? []).length / letters.length;
  return 1 + wide * 0.18;
};

/**
 * Spaced capitals ("T H E   V E R D I C T") are tracked in the text itself
 * (drawtext has no letter-spacing): for reading and line-length rules the
 * letters are collapsed back into words; for the box width they are not.
 */
export const isTracked = (t: string) => {
  const toks = t.trim().split(/\s+/).filter(Boolean);
  return toks.length >= 4 && toks.filter((x) => x.length === 1).length > toks.length * 0.6;
};
export const untrack = (t: string) => (isTracked(t) ? t.split(/\r?\n/).map((line) => line.trim().split(/\s{2,}/).map((w) => w.replace(/\s+/g, "")).join(" ")).join("\n") : t);

export function estimateTextBox(text: string, fontId: string, fontPx: number, boxEnabled: boolean): TextBox {
  const f = fontById(fontId);
  const lines = text.split(/\r?\n/);
  const longest = Math.max(...untrack(text).split(/\r?\n/).map((l) => l.length), 0);
  const widest = lines.reduce((a, l) => Math.max(a, l.length * f.avgAdvance * wideRatio(l)), 0);
  const w = Math.ceil(widest * fontPx * 1.12);
  const h = Math.ceil(lines.length * fontPx * 1.15);
  const pad = boxEnabled ? Math.max(4, Math.round(fontPx * 0.35)) : 0;
  return { w: w + pad * 2, h: h + pad * 2, lines, longest, pad };
}

/** Seconds a viewer needs: a fixed pick-up plus ~0.32 s a word (about 190 wpm). */
export const readingTimeS = (text: string) => +(0.8 + untrack(text).trim().split(/\s+/).filter(Boolean).length * 0.32).toFixed(2);
