/**
 * Per-clip Motion (Effect Controls): a keyframable zoom + pan applied to a clip
 * over its on-screen life. Keyframe times are NORMALIZED (0..1 of the clip), so
 * they survive trims and resolution changes. The live preview samples the tracks
 * each frame; the ffmpeg export turns them into a `zoompan` expression — the same
 * mechanism the Ken Burns stills already use, so the two paths agree.
 *
 * Conventions: scale ∈ [0.1,4] (1 = untransformed; <1 shrinks the clip with empty
 * space around it, >1 zooms in), posX/posY ∈ [-1,1] pan within the margin (0 = centred).
 */

export interface Keyframe {
  t: number; // 0..1 normalized clip progress
  v: number;
}

export interface ClipTransform {
  scale: Keyframe[];
  posX: Keyframe[];
  posY: Keyframe[];
}

export const SCALE_DEFAULT = 1;
export const POS_DEFAULT = 0;

export function emptyTransform(): ClipTransform {
  return { scale: [], posX: [], posY: [] };
}

/** Tolerant coercion of the JSON column into a ClipTransform. */
export function asTransform(raw: unknown): ClipTransform | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const track = (x: unknown): Keyframe[] =>
    Array.isArray(x)
      ? x
          .filter((k): k is Keyframe => !!k && typeof k === "object" && typeof (k as Keyframe).t === "number" && typeof (k as Keyframe).v === "number")
          .map((k) => ({ t: Math.min(1, Math.max(0, k.t)), v: k.v }))
      : [];
  const tr: ClipTransform = { scale: track(r.scale), posX: track(r.posX), posY: track(r.posY) };
  return isIdentityTransform(tr) ? null : tr;
}

export function isIdentityTransform(tr?: ClipTransform | null): boolean {
  if (!tr) return true;
  const off = (track: Keyframe[], def: number) => track.some((k) => Math.abs(k.v - def) > 1e-4);
  return !(off(tr.scale, SCALE_DEFAULT) || off(tr.posX, POS_DEFAULT) || off(tr.posY, POS_DEFAULT));
}

function sampleTrack(track: Keyframe[], p: number, def: number): number {
  if (!track || track.length === 0) return def;
  const ks = [...track].sort((a, b) => a.t - b.t);
  if (p <= ks[0].t) return ks[0].v;
  const last = ks[ks.length - 1];
  if (p >= last.t) return last.v;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (p >= a.t && p <= b.t) {
      const f = b.t === a.t ? 0 : (p - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * f;
    }
  }
  return last.v;
}

/** Sample all three tracks at normalized progress p (0..1). */
export function sampleTransform(tr: ClipTransform | null | undefined, p: number): {
  scale: number;
  posX: number;
  posY: number;
} {
  return {
    scale: Math.max(0.1, sampleTrack(tr?.scale ?? [], p, SCALE_DEFAULT)),
    posX: sampleTrack(tr?.posX ?? [], p, POS_DEFAULT),
    posY: sampleTrack(tr?.posY ?? [], p, POS_DEFAULT),
  };
}

const f4 = (n: number) => Number(n.toFixed(4)).toString();

/** Piecewise-linear ffmpeg expression for a track, in progress variable P. */
function exprTrack(track: Keyframe[], def: number, P: string): string {
  if (!track || track.length === 0) return f4(def);
  const ks = [...track].sort((a, b) => a.t - b.t);
  if (ks.length === 1) return f4(ks[0].v);
  let expr = f4(ks[ks.length - 1].v); // tail value past the last key
  for (let i = ks.length - 2; i >= 0; i--) {
    const a = ks[i];
    const b = ks[i + 1];
    const lerp = `(${f4(a.v)}+(${f4(b.v - a.v)})*(${P}-${f4(a.t)})/(${f4(b.t - a.t)}))`;
    expr = `if(lte(${P},${f4(b.t)}),${lerp},${expr})`;
  }
  return `if(lte(${P},${f4(ks[0].t)}),${f4(ks[0].v)},${expr})`;
}

/**
 * A `zoompan` filter that animates this transform over `durationS`, or "" if the
 * transform is identity (so untransformed clips are byte-for-byte unchanged).
 */
export function zoompanTransformFilter(
  tr: ClipTransform | null | undefined,
  w: number,
  h: number,
  durationS: number,
  fps: number,
): string {
  if (isIdentityTransform(tr) || !tr) return "";
  // Constant shrink (scale < 1): zoompan can't zoom out, so scale the clip down
  // and pad it back to frame size with the pan offset. (Animated scale that dips
  // below 1 falls through to zoompan, which clamps those frames to 1×.)
  const sk = tr.scale;
  const constScale = sk.length === 0 ? 1 : sk.every((k) => Math.abs(k.v - sk[0].v) < 1e-4) ? sk[0].v : null;
  if (constScale !== null && constScale < 1) {
    const s = Math.min(0.999, Math.max(0.1, constScale));
    const px = sampleTrack(tr.posX, 0, POS_DEFAULT);
    const py = sampleTrack(tr.posY, 0, POS_DEFAULT);
    const cox = (1 - s) / (2 * s); // half-margin as a fraction of the scaled-down size
    const x = `iw*${f4(cox)}*(1+(${f4(px)}))`;
    const y = `ih*${f4(cox)}*(1+(${f4(py)}))`;
    return `scale=iw*${f4(s)}:ih*${f4(s)},pad=iw/${f4(s)}:ih/${f4(s)}:${x}:${y}:color=black`;
  }
  const frames = Math.max(2, Math.round(durationS * fps));
  const P = `(on/${frames - 1})`;
  const z = `max(1,${exprTrack(tr.scale, SCALE_DEFAULT, P)})`;
  const x = `((iw-iw/zoom)/2*(1+(${exprTrack(tr.posX, POS_DEFAULT, P)})))`;
  const y = `((ih-ih/zoom)/2*(1+(${exprTrack(tr.posY, POS_DEFAULT, P)})))`;
  return `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${w}x${h}:fps=${fps}`;
}
