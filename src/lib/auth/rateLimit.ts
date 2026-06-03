/**
 * Minimal in-memory fixed-window rate limiter. Single-instance only (fine for
 * one Hetzner box). Keyed by an arbitrary string (usually `route:ip`).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

// Opportunistic cleanup so the map doesn't grow unbounded.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 60_000);
  // Don't keep the event loop alive for this.
  if (typeof timer.unref === "function") timer.unref();
}
