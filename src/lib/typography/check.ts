/**
 * Mechanical typography checks (guide Part II §12): every text box inside
 * title-safe (error outside action-safe, warn outside title-safe), readable
 * size, line length, reading time, line count, and two overlays on top of
 * each other at the same time.
 */
import { estimateTextBox, readingTimeS } from "./measure";
import { anchorNum } from "./place";
import { overflow, safeAreas, type Rect, type SafeAreas, type SafeProfile } from "./safe";
import { roleOf, type TypeSystem } from "./styleType";

export interface TextOverlayLike {
  id?: string;
  text: string;
  position: string;
  sizePct: number;
  marginPx: number;
  font?: string | null;
  boxEnabled: boolean;
  startS: number;
  endS: number | null;
  preset?: string | null;
  transform?: string | null;
}

export interface TextFinding {
  severity: "error" | "warn" | "info";
  rule: string;
  message: string;
  overlayId?: string;
  fix?: string;
}

export interface TextCheck {
  safe: SafeAreas;
  boxes: { id?: string; text: string; font: string; preset: string | null; box: Rect; inTitleSafe: boolean; inActionSafe: boolean }[];
  findings: TextFinding[];
  pass: boolean;
}

const short = (t: string) => (t.length > 28 ? t.slice(0, 27) + "…" : t).replace(/\s+/g, " ");
const sides = (o: ReturnType<typeof overflow>) =>
  (["left", "top", "right", "bottom"] as const)
    .filter((k) => o[k] > 0)
    .map((k) => `${k} ${Math.round(o[k])} px`)
    .join(", ");

export function checkText(overlays: TextOverlayLike[], frame: { w: number; h: number }, profile?: SafeProfile | string | null, durationS?: number | null, style?: TypeSystem | null): TextCheck {
  const safe = safeAreas(frame.w, frame.h, profile);
  const findings: TextFinding[] = [];
  const boxes: TextCheck["boxes"] = [];
  const vertical = frame.w / Math.max(1, frame.h) < 0.8;
  const minPct = vertical ? 2.4 : 2.2;
  for (const o of overlays) {
    const fontPx = Math.max(8, Math.round((o.sizePct / 100) * frame.h));
    const tb = estimateTextBox(o.text, o.font ?? "DejaVuSans-Bold", fontPx, o.boxEnabled);
    const { x, y } = anchorNum(o.position, safe.title, o.marginPx, tb.w, tb.h);
    const box: Rect = { x, y, w: tb.w, h: tb.h };
    const offTitle = overflow(safe.title, box);
    const offAction = overflow(safe.action, box);
    const inTitle = !Object.values(offTitle).some((v) => v > 0);
    const inAction = !Object.values(offAction).some((v) => v > 0);
    boxes.push({ id: o.id, text: o.text, font: o.font ?? "DejaVuSans-Bold", preset: o.preset ?? null, box, inTitleSafe: inTitle, inActionSafe: inAction });
    const label = `"${short(o.text)}"`;
    if (!inAction) findings.push({ severity: "error", rule: "§12 safe areas: text inside title-safe", overlayId: o.id, message: `${label} leaves the ACTION-safe area (${sides(offAction)}) — it will be cut or covered on delivery`, fix: "shorter text, a smaller size, or a line break; the anchor is already the title-safe edge — marginPx moves it further in" });
    else if (!inTitle) findings.push({ severity: "warn", rule: "§12 safe areas: text inside title-safe", overlayId: o.id, message: `${label} leaves the title-safe area (${sides(offTitle)})`, fix: "shorter text, a smaller size, or a line break" });
    if (o.sizePct < minPct) findings.push({ severity: "warn", rule: "§12 readable size", overlayId: o.id, message: `${label} is ${o.sizePct} % of the frame height — under ${minPct} % it will not read on a phone`, fix: "sizePct ≥ 3 for a lower-third, ≥ 4 for a card" });
    if (tb.longest > (vertical ? 26 : 44)) findings.push({ severity: "warn", rule: "§12 line length", overlayId: o.id, message: `${label} has a ${tb.longest}-character line; ${vertical ? "26" : "44"} is the ceiling — break it or cut it`, fix: "a line break in the text, or fewer words" });
    if (tb.lines.length > 3) findings.push({ severity: "warn", rule: "§12 three lines at most", overlayId: o.id, message: `${label} runs ${tb.lines.length} lines` });
    const end = o.endS ?? durationS ?? null;
    if (end != null) {
      const hold = end - o.startS;
      const need = readingTimeS(o.text);
      if (hold < need) findings.push({ severity: hold < need * 0.6 ? "error" : "warn", rule: "§12 reading time", overlayId: o.id, message: `${label} holds ${hold.toFixed(1)} s; reading it takes ≈ ${need} s`, fix: `endS ≥ ${(o.startS + need).toFixed(1)}` });
    }
  }
  // Overlaps in time and space.
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = overlays[i];
      const b = overlays[j];
      const ae = a.endS ?? durationS ?? Infinity;
      const be = b.endS ?? durationS ?? Infinity;
      const inTime = a.startS < be && b.startS < ae;
      const A = boxes[i].box;
      const B = boxes[j].box;
      const inSpace = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
      if (inTime && inSpace) findings.push({ severity: "warn", rule: "§12 one thing at a time", message: `"${short(a.text)}" and "${short(b.text)}" overlap on screen at the same time`, fix: "stagger them, or move one to another anchor" });
    }
  // The directing style's type (§12): no text where the style has none, one
  // family, the style's case, the roles it uses.
  if (style && overlays.length) {
    const rule = `style: ${style.name} type`;
    if (style.noText) findings.push({ severity: "warn", rule, message: `${style.name} puts no text on the frame beyond a title; ${overlays.length} overlay(s) planned`, fix: "let the picture and the voice carry it, or say in notes why this piece departs" });
    const foreign = overlays.filter((o) => o.font && !style.faces.includes(o.font as (typeof style.faces)[number]));
    if (foreign.length) findings.push({ severity: "warn", rule, message: `${foreign.length} overlay(s) use a face outside ${style.name}'s family (${style.faces.join(", ")}): ${[...new Set(foreign.map((o) => o.font))].join(", ")}`, fix: "add_text_overlay with a role (the style's face is filled in) or pass one of the style's faces" });
    for (const o of overlays) {
      const label = `"${short(o.text)}"`;
      const letters = o.text.replace(/[^\p{L}]/gu, "");
      const allCaps = letters.length >= 4 && letters === letters.toUpperCase();
      const anyCaps = /\p{Lu}/u.test(letters.slice(1));
      if ((style.case === "sentence" || style.case === "lower") && allCaps) findings.push({ severity: "warn", rule, overlayId: o.id, message: `${label} is set in capitals; ${style.name} sets text in ${style.case} case` });
      if ((style.case === "upper" || style.case === "tracked-upper") && letters.length >= 4 && !allCaps && !anyCaps) findings.push({ severity: "info", rule, overlayId: o.id, message: `${label} is not in capitals; ${style.name}'s titles and cards are` });
      const role = roleOf(o.preset);
      if (role && style.never?.includes(role)) findings.push({ severity: "warn", rule, overlayId: o.id, message: `${label} is a ${role}; ${style.name} does not use one`, fix: `the style's roles: ${Object.keys(style.roles).join(", ")}` });
    }
  }
  return { safe, boxes, findings, pass: !findings.some((f) => f.severity === "error") };
}
