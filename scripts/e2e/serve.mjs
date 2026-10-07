#!/usr/bin/env node
/**
 * Start the PRODUCTION build for the browser tests — safely.
 *
 *   npm run build
 *   node scripts/e2e/serve.mjs            # http://localhost:3210
 *   E2E_PORT=3333 node scripts/e2e/serve.mjs
 *
 * Why a wrapper instead of `next start`:
 *
 *  1. IT REFUSES TO RUN AGAINST ANYTHING BUT THE SANDBOX DATABASE. `next start`
 *     loads `.env.production.local` ahead of `.env.local`, so a pulled
 *     production env silently outranks the sandbox one. The browser tests add,
 *     edit and delete contacts; they must never be able to do that to
 *     production. This computes the env Next will actually use and exits unless
 *     the database is `bookstore`.
 *
 *  2. IT SILENCES THE THIRD PARTIES. `.env.local` carries a real MailerLite
 *     token and group (a lead-magnet funnel) and the book storage keys. An
 *     empty-string variable in the process environment outranks every .env file
 *     (Next only fills variables that are undefined), so blanking them here
 *     means no test can subscribe a real address, send mail, or write to R2.
 *
 *  3. IT CHECKS THE PORT IS FREE. A `next start` that loses the port exits with
 *     EADDRINUSE; run in the background you never see it and end up measuring
 *     whatever stale build already owns the port. Several Valice servers run on
 *     this machine at once.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const port = Number(process.env.E2E_PORT || 3210);
const root = process.cwd();

// What Next will really use for a production start.
loadEnvConfig(root, false);

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
if (dbName !== "bookstore") {
  console.error(
    `REFUSING TO START: DATABASE_URL points at "${dbName || "(unset or unparseable)"}", not the sandbox "bookstore".\n` +
      "The e2e suite writes to the database. Fix .env.local, and make sure no .env.production.local is present.",
  );
  process.exit(1);
}

const free = await new Promise((resolve) => {
  const probe = net.createServer().once("error", () => resolve(false)).once("listening", () => probe.close(() => resolve(true)));
  probe.listen(port, "127.0.0.1");
});
if (!free) {
  console.error(`REFUSING TO START: port ${port} is already in use (check \`ss -ltnp | grep :${port}\`). Pick another with E2E_PORT.`);
  process.exit(1);
}

// Blank, not deleted: an empty string is "defined", so no .env file overrides it.
const SILENCE = [
  "MAILERLITE_API_TOKEN",
  "MAILERLITE_GROUP_ID",
  "MAILERLITE_API_TOKEN_WEATHER_PERMITTING",
  "MAILERLITE_GROUP_ID_WEATHER_PERMITTING",
  "RESEND_API_KEY",
  "RESEND_AUDIENCE_ID",
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_WEBHOOK_SECRET",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];
const env = { ...process.env, PORT: String(port), NEXT_TELEMETRY_DISABLED: "1" };
for (const key of SILENCE) env[key] = "";

console.log(`e2e server → http://localhost:${port}  (database: ${dbName}; third-party keys blanked)`);
const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
  cwd: root,
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
