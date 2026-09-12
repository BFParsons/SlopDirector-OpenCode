// Stable MCP entry for Windows/Codex and other stdio clients. No shell shims.
// Resolve guide files and TypeScript aliases relative to the repo, not the host.
process.chdir(require("node:path").resolve(__dirname, ".."));
require("tsx/cjs");
require("./server.ts").startMcpServer().catch((error) => {
  console.error("[slopstudio-mcp] fatal:", error);
  process.exitCode = 1;
});
