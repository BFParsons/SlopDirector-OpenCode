import { env, requireEnv } from "@/env";

export class OpenRouterError extends Error {
  status: number;
  body?: unknown;
  retryable: boolean;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.body = body;
    this.retryable = status === 429 || status >= 500;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Exponential backoff with full jitter, capped at 20s. */
function backoffMs(attempt: number): number {
  const base = Math.min(20_000, 500 * 2 ** attempt);
  return Math.floor(Math.random() * base);
}

/**
 * Low-level OpenRouter fetch: injects auth + ranking headers, retries 429/5xx
 * with backoff, and throws OpenRouterError on non-OK terminal responses.
 * Returns the raw Response so callers can parse JSON or read bytes (TTS/video).
 */
export async function orFetch(
  path: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number; apiKey?: string } = {},
): Promise<Response> {
  // Prefer a caller-supplied (per-user) key; fall back to the shared server key.
  let key: string;
  if (opts.apiKey && opts.apiKey.trim()) {
    key = opts.apiKey.trim();
  } else {
    try {
      key = requireEnv("OPENROUTER_API_KEY");
    } catch {
      // Non-retryable: a missing key won't fix itself by retrying.
      throw new OpenRouterError("No OpenRouter API key configured", 401);
    }
  }
  const url = path.startsWith("http") ? path : `${env.OPENROUTER_BASE_URL}${path}`;
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "X-Title": "SpotForge",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (env.PUBLIC_BASE_URL) headers["HTTP-Referer"] = env.PUBLIC_BASE_URL;

  let attempt = 0;
  for (;;) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers, signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries) {
        await sleep(backoffMs(attempt));
        attempt++;
        continue;
      }
      throw new OpenRouterError(
        `Network error calling OpenRouter: ${(e as Error).message}`,
        0,
      );
    }
    clearTimeout(timer);

    if (res.ok) return res;

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : backoffMs(attempt),
      );
      attempt++;
      continue;
    }

    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    throw new OpenRouterError(
      `OpenRouter ${res.status}: ${text.slice(0, 500)}`,
      res.status,
      parsed,
    );
  }
}

export async function orJson<T = unknown>(
  path: string,
  init?: RequestInit,
  opts?: { retries?: number; timeoutMs?: number; apiKey?: string },
): Promise<T> {
  const res = await orFetch(path, init, opts);
  return (await res.json()) as T;
}
