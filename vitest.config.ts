/**
 * Vitest configuration (SUB-PR 4.5).
 *
 *  - `environment: "jsdom"` lets us add component / DOM tests later
 *    without reconfiguring; pure-function tests are unaffected.
 *  - `globals: false` keeps test files explicit (`import { describe, it,
 *    expect } from "vitest"`). We avoid the global types route so
 *    `tsconfig.json` stays minimal — no `types: ["vitest/globals"]`
 *    pollution for app code.
 *  - The `@` path alias mirrors the production `tsconfig.json` so test
 *    imports look identical to app imports.
 *  - Vitest auto-discovers `**` / `*.{test,spec}.{ts,tsx,js,jsx}` so we
 *    co-locate tests next to source (e.g. `src/lib/seo.test.ts`).
 */

import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    // Vercel-style env restoration between tests — `vi.stubEnv` calls inside
    // tests are auto-rolled-back by this hook so env mutations don't leak.
    unstubEnvs: true,
    // Browser tests live in `e2e/` and run under Playwright (`npm run test:e2e`).
    // Vitest's default glob would otherwise try to run them and fail on import.
    exclude: ["**/node_modules/**", "**/dist/**", ".e2e/**", "e2e/**"],
    // Skip coverage thresholds for v1; opt in later when we have a real
    // coverage baseline to enforce.
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
