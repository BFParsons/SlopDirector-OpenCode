/**
 * `StoryElement.refImageIds` reconciliation across DB targets.
 *
 * It's a native `String[]` on Postgres (web) but a JSON-encoded `String` on
 * SQLite (desktop — SQLite has no array type). These helpers let app code read
 * and write it identically regardless of which client is active. The desktop
 * runtime sets `SLOPSTUDIO_DB=sqlite` (see electron/main.js) so writes are
 * JSON-encoded there.
 */
const isSqlite = process.env.SLOPSTUDIO_DB === "sqlite";

/** Read a refImageIds value (array on Postgres, JSON string on SQLite) as string[]. */
export function parseRefIds(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Encode a string[] for writing to the refImageIds update field. The Prisma
 * update-input type differs per client (string[] vs string), so the result is
 * intentionally untyped — callers assign it straight to the update field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encodeRefIds(ids: string[]): any {
  return isSqlite ? JSON.stringify(ids) : ids;
}
