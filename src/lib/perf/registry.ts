/**
 * Live MediaCache registry for the perf HUD.
 *
 * The compositor's `<video>` decoders (src/lib/render/draw.ts → MediaCache) are
 * created with `document.createElement("video")` and **never appended to the
 * DOM**, so a `querySelectorAll("video")` census can't see them. The preview
 * engine registers its cache here on mount so the HUD can read the *real*
 * decoder population (count + readyState + playing). Registering is a Set
 * add/delete — free enough to leave on unconditionally.
 */
import type { MediaCache } from "@/lib/render/draw";

const caches = new Set<MediaCache>();

export function registerCache(c: MediaCache): void {
  caches.add(c);
}

export function unregisterCache(c: MediaCache): void {
  caches.delete(c);
}

export interface MediaStats {
  /** number of live MediaCache instances (normally 1). */
  caches: number;
  /** total `<video>` decoders held across the cache(s). */
  videos: number;
  /** decoders with a current frame available (readyState >= 2). */
  ready: number;
  /** decoders currently playing (not paused) — actively consuming a pipeline. */
  decoding: number;
}

export function mediaStats(): MediaStats {
  let videos = 0;
  let ready = 0;
  let decoding = 0;
  for (const c of caches) {
    for (const v of c.videos.values()) {
      videos++;
      if (v.readyState >= 2) ready++;
      if (!v.paused) decoding++;
    }
  }
  return { caches: caches.size, videos, ready, decoding };
}
