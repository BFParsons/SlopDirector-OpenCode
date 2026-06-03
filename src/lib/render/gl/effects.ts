/**
 * Maps a clip's effect stack to PixiJS render state — built-in filters
 * (blur/pixelate) plus geometry (mirror/rotate/crop) the GLCompositor applies to
 * the sprite. Each effect mirrors its ffmpeg builder in `@/config/effects` so the
 * GL preview tracks the export.
 *
 * Filters are CACHED per (clip, effect) — recreating Pixi filters every frame
 * (especially the custom chroma/sharpen GLSL programs) leaks GPU resources and
 * stalls playback. The cache reuses a filter while its params are unchanged and
 * destroys+replaces it only when they change.
 */
import type { Filter } from "pixi.js";
import type { EffectSpec } from "../effects";
import { hexToRgb01, makeChromaKey, makeSharpen } from "./shaders";

type Pixi = typeof import("pixi.js");
type PixiFilters = typeof import("pixi-filters");

export interface CachedFilter {
  key: string; // kind + serialized params — identity of the current filter
  filter: Filter;
}
export type FilterCache = Map<string, CachedFilter>; // keyed by `${clipId}|${effectId}`

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const sstr = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);

export interface EffectResult {
  filters: Filter[];
  flipX: boolean;
  flipY: boolean;
  rotationRad: number;
  /** Punch-in crop as edge fractions, or null. Clamped so the kept region is sane. */
  crop: { l: number; r: number; t: number; b: number } | null;
}

/** Reuse-or-(re)create the filter for a slot; recreates only when params change. */
function filterFor(cache: FilterCache, slot: string, paramKey: string, create: () => Filter): Filter {
  const cur = cache.get(slot);
  if (cur && cur.key === paramKey) return cur.filter;
  if (cur) {
    try {
      cur.filter.destroy();
    } catch {
      /* ignore */
    }
  }
  const filter = create();
  cache.set(slot, { key: paramKey, filter });
  return filter;
}

export function buildEffects(
  pixi: Pixi,
  pf: PixiFilters,
  effects: EffectSpec[] | undefined,
  clipId: string,
  cache: FilterCache,
): EffectResult {
  const filters: Filter[] = [];
  let flipX = false;
  let flipY = false;
  let rotationRad = 0;
  let crop: EffectResult["crop"] = null;
  if (!effects?.length) return { filters, flipX, flipY, rotationRad, crop };

  for (const e of effects) {
    if (!e.enabled) continue;
    const slot = `${clipId}|${e.id}`;
    const paramKey = `${e.kind}|${JSON.stringify(e.params)}`;
    switch (e.kind) {
      case "blur": {
        const amount = num(e.params.amount, 8);
        if (amount > 0) {
          filters.push(filterFor(cache, slot, paramKey, () => new pixi.BlurFilter({ strength: amount, quality: 4 })));
        }
        break;
      }
      case "pixelate": {
        const size = Math.max(2, Math.round(num(e.params.size, 12)));
        filters.push(filterFor(cache, slot, paramKey, () => new pf.PixelateFilter(size)));
        break;
      }
      case "chromaKey": {
        const rgb = hexToRgb01(sstr(e.params.color, "#00ff00"));
        filters.push(
          filterFor(cache, slot, paramKey, () =>
            makeChromaKey(pixi, rgb, num(e.params.similarity, 0.3), num(e.params.blend, 0.1)),
          ),
        );
        break;
      }
      case "sharpen": {
        const amount = num(e.params.amount, 1);
        if (amount > 0) {
          filters.push(filterFor(cache, slot, paramKey, () => makeSharpen(pixi, amount)));
        }
        break;
      }
      case "mirror": {
        const a = sstr(e.params.axis, "h");
        if (a === "h" || a === "both") flipX = !flipX;
        if (a === "v" || a === "both") flipY = !flipY;
        break;
      }
      case "rotate": {
        rotationRad += (num(e.params.angle, 0) * Math.PI) / 180;
        break;
      }
      case "crop": {
        const l = Math.min(0.44, Math.max(0, num(e.params.left, 0)));
        const r = Math.min(0.44, Math.max(0, num(e.params.right, 0)));
        const t = Math.min(0.44, Math.max(0, num(e.params.top, 0)));
        const b = Math.min(0.44, Math.max(0, num(e.params.bottom, 0)));
        if (l + r + t + b > 0) crop = { l, r, t, b };
        break;
      }
      default:
        break;
    }
  }
  return { filters, flipX, flipY, rotationRad, crop };
}
