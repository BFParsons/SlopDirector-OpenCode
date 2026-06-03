/**
 * Auto-captions from the voiceover script. We have the script text and the VO
 * duration, but not word-level timestamps, so cues are timed proportionally by
 * character length across the span — a good approximation for muted social
 * autoplay. The same cues feed the live preview (RenderText) and the ffmpeg
 * export (TextOverlaySpec); both share this shape.
 */

export interface CaptionStyle {
  position: string;
  sizePct: number;
  marginPx: number;
}

export interface CaptionCue {
  text: string;
  position: string;
  sizePct: number;
  color: string;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  marginPx: number;
  startS: number;
  endS: number;
  animation: "NONE" | "FADE";
}

const MAX_CHARS = 42; // per cue line
const MAX_WORDS = 7;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Split `rawText` into timed caption cues filling `spanS` seconds. */
export function buildCaptions(rawText: string, spanS: number, style: CaptionStyle): CaptionCue[] {
  const text = (rawText ?? "").replace(/\s+/g, " ").trim();
  if (!text || spanS <= 0) return [];

  // Pack words into short cues (~7 words / ~42 chars), preferring sentence ends.
  const words = text.split(" ");
  const cues: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    const tooLong = cur && (cand.length > MAX_CHARS || cur.split(" ").length >= MAX_WORDS);
    if (tooLong) {
      cues.push(cur);
      cur = w;
    } else {
      cur = cand;
    }
    if (/[.!?]$/.test(w) && cur.length >= 12) {
      cues.push(cur);
      cur = "";
    }
  }
  if (cur) cues.push(cur);

  const totalChars = cues.reduce((a, c) => a + c.length, 0) || 1;
  const out: CaptionCue[] = [];
  let t = 0;
  for (const c of cues) {
    const dur = (c.length / totalChars) * spanS;
    const startS = r2(t);
    t += dur;
    out.push({
      text: c,
      position: style.position,
      sizePct: style.sizePct,
      color: "#FFFFFF",
      boxEnabled: true,
      boxColor: "#000000",
      boxOpacity: 0.6,
      marginPx: style.marginPx,
      startS,
      endS: r2(t),
      animation: "NONE",
    });
  }
  return out;
}
