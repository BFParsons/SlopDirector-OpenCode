/**
 * Client-side fetch wrapper. Unwraps the `{ data, error }` envelope and throws
 * on error. Adds an X-Requested-With marker; skips JSON content-type for
 * FormData bodies so multipart uploads work.
 */
import { withBase } from "./basePath";

/**
 * Per-page-load client id, sent as X-Slop-Client. The server echoes it on
 * `project.changed` events so this client can ignore its own edits and only
 * resync when someone else (another window, an agent over the API) changed
 * the project.
 */
export const CLIENT_ID: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export async function api<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const isForm =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    "X-Requested-With": "spotforge",
    "X-Slop-Client": CLIENT_ID,
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
