import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests. NOT part of `npm test` (that is Vitest, and CI runs it); these
 * need a built, running site:
 *
 *   npm run build
 *   node scripts/e2e/serve.mjs &            # sandbox DB only; refuses anything else
 *   npm run test:e2e
 *
 * `E2E_BASE_URL` points the suite at any running origin (e.g. a Vercel preview).
 * Tests that WRITE (admin email management) check the origin and skip unless it
 * is localhost, so pointing this at production cannot modify production data.
 *
 * Headless Chromium reports `visibilityState: "visible"`, so rAF runs and lazy
 * images load — unlike a background automation tab, which silently suspends
 * both and produced three phantom bugs in an earlier session.
 */
const PORT = process.env.E2E_PORT ?? "3210";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  outputDir: ".e2e/results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      // Real touch semantics (`hasTouch`) and the mobile layout viewport
      // (`isMobile`); each test sets the width it is about.
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 },
    },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
  ],
});
