/**
 * Client-side fetch wrapper. Unwraps the `{ data, error }` envelope and throws
 * on error. Adds an X-Requested-With marker; skips JSON content-type for
 * FormData bodies so multipart uploads work.
 */
import { withBase } from "./basePath";

export async function api<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const isForm =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    "X-Requested-With": "spotforge",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (!isForm && init.body) headers["Content-Type"] = "application/json";

  const res = await fetch(withBase(url), { ...init, headers });
  const json = (await res.json().catch(() => ({ error: "Invalid response" }))) as {
    data?: T;
    error?: string | null;
  };
  if (!res.ok || json.error) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data as T;
}
