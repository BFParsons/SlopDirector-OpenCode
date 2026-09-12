/**
 * Call one MCP tool from the shell (for driving the harness by hand):
 *   pnpm exec tsx scripts/mcp-call.ts <tool> '<json args>' [--out DIR]
 * Text results print as-is; image results are saved as DIR/<tool>-<n>.jpg.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const [tool, argsJson = "{}", ...rest] = process.argv.slice(2);
  if (!tool) {
    console.error("usage: mcp-call <tool> '<json>' [--out DIR]");
    process.exit(2);
  }
  const outIdx = rest.indexOf("--out");
  const outDir = outIdx >= 0 ? rest[outIdx + 1] : process.env.MCP_OUT ?? ".";
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve(__dirname, "../mcp/run.cjs")], env: process.env as Record<string, string>, stderr: "pipe" });
  const client = new Client({ name: "mcp-call", version: "0.0.1" });
  await client.connect(transport);
  const res = (await client.callTool({ name: tool, arguments: JSON.parse(argsJson) }, undefined, { timeout: 10 * 60_000 })) as { content: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean };
  let n = 0;
  for (const c of res.content) {
    if (c.type === "text") console.log(c.text);
    else if (c.type === "image" && c.data) {
      mkdirSync(outDir, { recursive: true });
      const file = path.join(outDir, `${tool}-${++n}.${(c.mimeType ?? "image/jpeg").split("/")[1] === "png" ? "png" : "jpg"}`);
      writeFileSync(file, Buffer.from(c.data, "base64"));
      console.log(`[image saved: ${file}]`);
    }
  }
  await client.close();
  process.exit(res.isError ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
