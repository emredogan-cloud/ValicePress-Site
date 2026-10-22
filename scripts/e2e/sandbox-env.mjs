#!/usr/bin/env node
/**
 * Run a command with the SANDBOX catalogue's environment — whatever
 * `.env.production.local` says.
 *
 *   node scripts/e2e/sandbox-env.mjs npm run build
 *   node scripts/e2e/sandbox-env.mjs node scripts/e2e/serve.mjs
 *
 * Why it exists: `next build` and `next start` load `.env.production.local`
 * ahead of `.env.local`. On a machine where that file is a `vercel env pull`,
 * its secrets are redaction placeholders — `DATABASE_URL` included — so a plain
 * build pre-renders every catalogue page from an empty result (each query's
 * `safeQuery` fallback) and still exits 0, and `serve.mjs` refuses to start.
 * A variable already in the process environment outranks every .env file, so
 * this puts `.env.local` there, and nothing on disk changes.
 *
 * The same two guards as `serve.mjs`:
 *  1. It refuses unless `.env.local`'s database is the sandbox `bookstore`.
 *  2. It blanks the third-party keys, so neither a build nor a test run can
 *     subscribe a real address, send mail, take a payment call, report to
 *     Sentry or write to R2. A `NEXT_PUBLIC_` value is inlined at BUILD time,
 *     which `serve.mjs` blanking it at start time cannot undo.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

const root = process.cwd();
const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/e2e/sandbox-env.mjs <command> [args…]");
  process.exit(2);
}

const local = parseEnv(readFileSync(path.join(root, ".env.local"), "utf8"));
const dbName = (() => {
  try {
    return new URL(local.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
if (dbName !== "bookstore") {
  console.error(
    `REFUSING TO RUN: .env.local's DATABASE_URL points at "${dbName || "(unset or unparseable)"}", not the sandbox "bookstore".`,
  );
  process.exit(1);
}

// The list `serve.mjs` blanks, for the same reasons.
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
const env = { ...process.env, ...local, NEXT_TELEMETRY_DISABLED: "1" };
for (const key of SILENCE) env[key] = "";

console.log(`sandbox env → ${[command, ...args].join(" ")}  (database: ${dbName}; third-party keys blanked)`);
const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
