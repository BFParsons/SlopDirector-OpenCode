import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const text = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

export const image = (bytes: Buffer, mimeType: string, caption?: string): CallToolResult => ({
  content: [
    { type: "image", data: bytes.toString("base64"), mimeType },
    ...(caption ? [{ type: "text" as const, text: caption }] : []),
  ],
});

export const failure = (e: unknown): CallToolResult => ({
  content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

/** Wrap a tool body so any thrown error becomes an isError result instead of a protocol failure. */
export function guarded<A>(fn: (args: A) => Promise<CallToolResult>): (args: A) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return await fn(args);
    } catch (e) {
      return failure(e);
    }
  };
}
