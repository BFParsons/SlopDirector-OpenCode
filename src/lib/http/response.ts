import { NextResponse } from "next/server";

/**
 * Standard API envelope: `{ data, error, meta? }`.
 * Every route handler returns one of these.
 */
export type ApiMeta = Record<string, unknown>;

export function ok<T>(
  data: T,
  meta?: ApiMeta,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(
    meta ? { data, error: null, meta } : { data, error: null },
    init,
  );
}

export function err(
  message: string,
  status = 400,
  meta?: ApiMeta,
): NextResponse {
  return NextResponse.json(
    meta ? { data: null, error: message, meta } : { data: null, error: message },
    { status },
  );
}
