import { defineConfig } from "@playwright/test";

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
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 936, height: 490 },
    // The API's CSRF check wants this on mutating requests (matches src/lib/api.ts).
    extraHTTPHeaders: { "X-Requested-With": "spotforge" },
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/usr/bin/chromium" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/start",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
