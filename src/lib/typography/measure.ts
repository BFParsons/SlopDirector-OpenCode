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

export function estimateTextBox(text: string, fontId: string, fontPx: number, boxEnabled: boolean): TextBox {
  const f = fontById(fontId);
  const lines = text.split(/\r?\n/);
  const longest = Math.max(...lines.map((l) => l.length), 0);
  const widest = lines.reduce((a, l) => Math.max(a, l.length * f.avgAdvance * wideRatio(l)), 0);
  const w = Math.ceil(widest * fontPx * 1.12);
  const h = Math.ceil(lines.length * fontPx * 1.15);
  const pad = boxEnabled ? Math.max(4, Math.round(fontPx * 0.35)) : 0;
  return { w: w + pad * 2, h: h + pad * 2, lines, longest, pad };
}

/** Seconds a viewer needs: a fixed pick-up plus ~0.32 s a word (about 190 wpm). */
export const readingTimeS = (text: string) => +(0.8 + text.trim().split(/\s+/).filter(Boolean).length * 0.32).toFixed(2);
