import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * End-to-end tests.
 *
 *   npm run test:e2e
 *
 * Uses the Chrome already installed on the machine (`channel: "chrome"`) rather
 * than downloading Playwright's own browser bundle — this project lives on a
 * disk that has run out of space before, and a ~1.5 GB download for something
 * Chrome already does is not worth it. That means `npx playwright install` is
 * NOT required; a normal Chrome is.
 *
 * The dev server is started automatically and reused if one is already running.
 * The first compile on this machine is slow (OneDrive), hence the long timeouts.
 */
export default defineConfig({
  testDir: "./e2e",
  /**
   * One worker on purpose. The dev server compiles routes on demand and every
   * page render opens a Prisma connection to Supabase's pooler; running specs in
   * parallel produced aborted navigations (ERR_ABORTED) and exhausted the
   * connection pool, which surfaced as failures that had nothing to do with the
   * app. Serial is slower and honest.
   */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Pages are compiled on demand in dev; be patient rather than flaky.
    navigationTimeout: 120_000,
    actionTimeout: 20_000,
  },

  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],

  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p " + PORT,
    url: BASE_URL,
    reuseExistingServer: true,
    // A cold Next dev compile here can take a couple of minutes.
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
