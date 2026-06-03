import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { absolutePath } from "./storage";

/**
 * Stream a file as an HTTP response with Range support (for video scrubbing).
 * Caller has already verified ownership/auth.
 */
export async function streamAsset(
  relativePath: string,
  mime: string,
  rangeHeader: string | null,
): Promise<Response> {
  const abs = absolutePath(relativePath);
  const { size } = await stat(abs);

  const baseHeaders: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : size - 1;
      if (start >= size || end >= size || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const stream = createReadStream(abs, { start, end });
      return new Response(
        Readable.toWeb(stream) as unknown as ReadableStream,
        {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Content-Length": String(end - start + 1),
          },
        },
      );
    }
  }

  const stream = createReadStream(abs);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}

/** Build a data URI from a stored image asset (for image-to-video payloads). */
export async function fileToDataUri(
  relativePath: string,
  mime: string,
): Promise<string> {
  const buf = await readFile(absolutePath(relativePath));
  return `data:${mime};base64,${buf.toString("base64")}`;
}
