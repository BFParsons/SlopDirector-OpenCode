/**
 * Time MCP tool calls over ONE connection (no per-call server spawn):
 *   pnpm exec tsx tests/bench/calls.ts '<tool> <json>' '<tool> <json>' …
 */
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({ command: path.resolve("node_modules/.bin/tsx"), args: [path.resolve("mcp/server.ts")], env: process.env as Record<string, string>, stderr: "pipe" });
  const client = new Client({ name: "calls", version: "0.0.1" });
  const t0 = Date.now();
  await client.connect(transport);
  console.log(`connect ${Date.now() - t0} ms`);
  for (const spec of process.argv.slice(2)) {
    const sp = spec.indexOf(" ");
    const name = sp < 0 ? spec : spec.slice(0, sp);
    const args = sp < 0 ? {} : JSON.parse(spec.slice(sp + 1));
    const t1 = Date.now();
    const res = (await client.callTool({ name, arguments: args }, undefined, { timeout: 30 * 60_000 })) as { content: { type: string; text?: string }[]; isError?: boolean };
    const text = res.content.find((c) => c.type === "text")?.text ?? "";
    console.log(`${String(Date.now() - t1).padStart(6)} ms  ${name}${res.isError ? "  ERROR " + text.slice(0, 120) : ""}`);
  }
  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
