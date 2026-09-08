/**
 * Per-clip effect stack. Stored in `Segment.effects` as a JSON array of
 * EffectSpec, applied in order by BOTH the preview (`draw.ts`) and the ffmpeg
 * export (`assemble.ts` via the registry in `src/config/effects.ts`).
 *
 * Preview fidelity: Canvas2D can preview a few effects live (blur); the rest are
 * export-accurate and show an "applied on export" badge in the monitor until the
 * WebGL compositor lands (then all preview live).
 */
export type EffectKind =
  | "blur"
  | "chromaKey"
  | "crop"
  | "mirror"
  | "rotate"
  | "pixelate"
  | "sharpen"
  // Export-only additions (ffmpeg 9 filters present in both the system and bundled builds):
  | "denoise"
  | "detail"
  | "deinterlace"
  | "deshake"
  | "stabilize"
  | "smoothSlowmo"
  | "tonemap";

export interface EffectSpec {
  id: string;
  kind: EffectKind;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

export const EFFECT_KINDS: readonly EffectKind[] = [
  "blur",
  "chromaKey",
  "crop",
  "mirror",
  "rotate",
  "pixelate",
  "sharpen",
  "denoise",
  "detail",
  "deinterlace",
  "deshake",
  "stabilize",
  "smoothSlowmo",
  "tonemap",
];

const KIND_SET = new Set<string>(EFFECT_KINDS);

/** Tolerant coercion of the JSON column into a clean EffectSpec[]. */
export function asEffects(raw: unknown): EffectSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: EffectSpec[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (typeof r.kind !== "string" || !KIND_SET.has(r.kind)) continue;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : `fx_${out.length}_${r.kind}`,
      kind: r.kind as EffectKind,
      enabled: r.enabled !== false,
      params:
        r.params && typeof r.params === "object"
          ? (r.params as Record<string, number | string | boolean>)
          : {},
    });
  }
  return out;
}
