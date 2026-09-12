// Exercise the packaged Windows app, including the full MCP acceptance suite.
// Run after desktop:build:win: node tests/platform/desktop-smoke.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test entry. */
const { _electron, expect } = require("@playwright/test");
const { execFile } = require("node:child_process");
const { mkdirSync, mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const { randomBytes } = require("node:crypto");

async function main() {
  const root = path.resolve(__dirname, "../..");
  mkdirSync(path.join(root, ".data"), { recursive: true });
  const data = mkdtempSync(path.join(root, ".data", "packaged-smoke-"));
  const assets = path.join(data, "assets");
  mkdirSync(assets);
  const env = {
    ...process.env,
    SLOPSTUDIO_PORT: "38474",
    SLOPSTUDIO_URL: "http://127.0.0.1:38474",
    SLOPSTUDIO_AGENT_NAME: "Codex smoke test",
    DATABASE_URL: `file:${path.join(data, "slopstudio.db").replaceAll("\\", "/")}`,
    ASSET_ROOT: assets,
    SLOPSTUDIO_PYTHON: path.join(root, ".venv", "Scripts", "python.exe"),
    AUTH_SECRET: randomBytes(32).toString("hex"),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV;
  delete env.SLOPSTUDIO_FFMPEG_DIR;
  delete env.SLOPSTUDIO_FFMPEG_PATH;
  delete env.SLOPSTUDIO_FFPROBE_PATH;
  const desktop = await _electron.launch({
    executablePath: process.env.SLOPSTUDIO_TEST_EXE || path.join(root, "dist", "win-unpacked", "SlopStudio Pro.exe"),
    env,
    timeout: 60000,
  });
  let logs = "";
  for (const output of [desktop.process().stdout, desktop.process().stderr]) {
    output?.on("data", (chunk) => { logs += chunk.toString(); });
  }
  try {
    const page = await desktop.firstWindow();
    await expect(page.locator(".squish-title")).toHaveText(["Assembly", "Audio Studio"], { timeout: 60000 });
    if (!await desktop.evaluate(({ app }) => app.isPackaged)) throw new Error("Expected packaged app");
    const res = await page.request.get("http://127.0.0.1:38474/api/projects");
    if (!res.ok()) throw new Error(`Packaged API failed: ${res.status()}`);
    await page.screenshot({ path: path.join(root, ".data", "windows-desktop.png") });
    console.log("Packaged Electron window, fresh SQLite database and local API: PASS");
    const result = await promisify(execFile)(process.execPath, [require.resolve("tsx/cli"), path.join(root, "tests", "mcp", "run.ts")], {
      cwd: root, env, windowsHide: true, timeout: 600000, maxBuffer: 4 * 1024 * 1024,
    });
    console.log(result.stdout.trim().split(/\r?\n/).at(-1));
  } catch (error) {
    console.error(logs.slice(-12000));
    throw error;
  } finally {
    writeFileSync(path.join(data, "desktop.log"), logs);
    await desktop.close();
  }
}
main().catch((error) => { console.error(error.stderr || error); process.exitCode = 1; });
