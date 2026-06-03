import type { ZodType } from "zod";

/** Thrown by parseJsonBody; route handlers map this to an error response. */
export class BodyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BodyError";
    this.status = status;
  }
}

/**
 * Read, size-limit, JSON-parse, and zod-validate a request body in one step.
 * `maxSize` is in bytes (default 64KB). Throws BodyError on any failure.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  maxSize = 64 * 1024,
): Promise<T> {
  const text = await request.text();
  // Byte length, not char length — multibyte chars count for more.
  if (Buffer.byteLength(text, "utf8") > maxSize) {
    throw new BodyError("Request body too large", 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BodyError("Invalid JSON body", 400);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new BodyError(`Validation failed: ${detail}`, 422);
  }
  return parsed.data;
}
