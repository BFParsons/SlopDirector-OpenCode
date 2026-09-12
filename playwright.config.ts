import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const baseURL = process.env.PW_BASE_URL ?? "http://127.0.0.1:38473";
const executablePath = process.env.PW_CHROMIUM ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

/**
 * End-to-end tests against the running dev server (SQLite desktop target, no
 * login). They drive the system Chromium at this laptop's logical viewport
 * (936×490 — 1080p at 2× scale) and talk to the same API the UI uses.
 *
 *   pnpm test:e2e            # `pnpm dev` must be up (the launcher / desktop:dev)
 *   pnpm test:e2e --ui       # Playwright's UI mode
 *
 * Tests create projects titled "… (pw)" and delete them when they finish.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 936, height: 490 },
    // The API's CSRF check wants this on mutating requests (matches src/lib/api.ts).
    extraHTTPHeaders: { "X-Requested-With": "spotforge" },
    launchOptions: { executablePath },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/launch-local.mjs --headless --dev",
    url: `${baseURL}/start`,
    env: { SLOPSTUDIO_PORT: new URL(baseURL).port || "38473" },
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
