#!/usr/bin/env node
/**
 * Browser tests for the ADMIN area, which needs a signed-in administrator — and
 * a test machine cannot sign in to Clerk (the production keys only work on the
 * production domain, and a test must never touch the production Clerk).
 *
 *   node scripts/e2e/admin-harness.mjs            # build, serve, run e2e/admin.pw.ts, stop
 *   node scripts/e2e/admin-harness.mjs --keep     # …and leave the server up for a look (Ctrl-C to stop)
 *   node scripts/e2e/admin-harness.mjs --no-build # reuse the last build of the copy
 *   node scripts/e2e/admin-harness.mjs --project=desktop-chromium -g "suppress"   # anything else goes to Playwright
 *
 * HOW, AND WHY IT IS SAFE. The identity check — `requireAdmin` in `src/lib/auth.ts`
 * — is replaced by a stub, but ONLY IN A THROW-AWAY COPY of the repository built
 * under the system temp directory. Nothing in this repository contains a way
 * around the gate: no flag, no header, no environment variable in the shipped
 * code. (A bypass guarded by "only if NODE_ENV is …" is a bypass that one wrong
 * environment variable away from open.) The stub is applied by exact-string
 * replacement and the harness FAILS LOUDLY if a pattern is not found, so it can
 * never quietly test a build with the real gate.
 *
 * On top of that:
 *   - it refuses unless DATABASE_URL names the `bookstore` sandbox (the admin
 *     tests write contacts) — the same rule as `scripts/e2e/serve.mjs`;
 *   - third-party keys are blanked, so no test can email, subscribe or write to
 *     storage;
 *   - the server listens on 127.0.0.1 only, so nothing else on the network can
 *     reach an admin area with no gate;
 *   - the copy lives in /tmp and is never committed or deployed.
 *
 * The stub also honours a cookie, so one build serves both halves of the test:
 *   e2e_admin=denied → a signed-in NON-admin; e2e_admin=out → signed out.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const OWN_FLAGS = new Set(["--keep", "--no-build"]);
const args = new Set(process.argv.slice(2).filter((a) => OWN_FLAGS.has(a)));
/** Everything that is not ours goes to Playwright (e.g. --project=desktop-chromium, -g "suppress"). */
const playwrightArgs = process.argv.slice(2).filter((a) => !OWN_FLAGS.has(a));
if (!playwrightArgs.some((a) => a.startsWith("--workers"))) playwrightArgs.push("--workers=1"); // the tests write rows; one at a time
const repo = process.cwd();
const port = Number(process.env.E2E_ADMIN_PORT || 3211);
const work = path.join(os.tmpdir(), "valice-admin-e2e");

// ---- guards ---------------------------------------------------------------------
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  console.error("REFUSING TO RUN: this builds an app with no admin gate. It is for a developer machine only.");
  process.exit(1);
}
loadEnvConfig(repo, false);
const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
if (dbName !== "bookstore") {
  console.error(`REFUSING TO RUN: DATABASE_URL points at "${dbName || "(unset)"}", not the sandbox "bookstore". The admin tests write contacts.`);
  process.exit(1);
}

// Blank, not deleted: an empty string is "defined", so no .env file overrides it.
const SILENCE = [
  "MAILERLITE_API_TOKEN",
  "MAILERLITE_GROUP_ID",
  "MAILERLITE_API_TOKEN_WEATHER_PERMITTING",
  "MAILERLITE_GROUP_ID_WEATHER_PERMITTING",
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
  // No Clerk at all in the copy: the proxy then does not enforce a session, and the stub supplies the identity.
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "OPS_DIAG_TOKEN",
];
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
for (const key of SILENCE) env[key] = "";
// Not blank, and not real: unsubscribe links are SIGNED with this key, so a test can make a valid one.
// With no audience id (blanked above) the unsubscribe route never calls Resend at all.
const DUMMY_RESEND_KEY = "e2e-dummy-key-for-signing-unsubscribe-links";
env.RESEND_API_KEY = DUMMY_RESEND_KEY;

// ---- the copy ---------------------------------------------------------------------
function copyRepo() {
  fs.mkdirSync(work, { recursive: true });
  // ANCHORED (leading slash): an unanchored `images` also matched `public/images`, and the copy lost every cover and the logo.
  const exclude = ["/.git", "/node_modules", "/.next", "/.e2e", "/docs", "/QA", "/images", "/assets", "/scripts/tmp", "/.venv-factory", "/valice-house", "/01_REPORTS", "/roadmap", "/sub-pr-report", "/tsconfig.tsbuildinfo"];
  const r = spawnSync("rsync", ["-a", "--delete", ...exclude.flatMap((e) => ["--exclude", e]), `${repo}/`, `${work}/`], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("rsync failed");
  const link = path.join(work, "node_modules");
  if (!fs.existsSync(link)) fs.symlinkSync(path.join(repo, "node_modules"), link, "dir");
}

/** Exact-string replacement that refuses to continue if the text is not there. */
function patch(file, from, to) {
  const p = path.join(work, file);
  const text = fs.readFileSync(p, "utf8");
  if (!text.includes(from)) throw new Error(`stub patch FAILED — pattern not found in ${file}:\n${from.slice(0, 120)}`);
  fs.writeFileSync(p, text.replace(from, to));
}

function applyStub() {
  // 1. the identity: an administrator, unless a cookie says otherwise
  const authPath = path.join(work, "src/lib/auth.ts");
  const auth = fs.readFileSync(authPath, "utf8");
  const start = auth.indexOf("export const requireAdmin = cache(");
  if (start < 0) throw new Error("stub patch FAILED — requireAdmin not found in src/lib/auth.ts");
  const stub = `export const requireAdmin = cache(async (): Promise<AdminIdentity> => {
  // E2E STUB — written by scripts/e2e/admin-harness.mjs into a throw-away copy. Not in the repository.
  const { cookies } = await import("next/headers");
  const mode = (await cookies()).get("e2e_admin")?.value;
  if (mode === "out") throw new AdminAccessError("not_signed_in");
  if (mode === "denied") throw new AdminAccessError("not_admin");
  return { email: "qa-admin@e2e.invalid", localUserId: "00000000-0000-4000-8000-000000000001" };
});
`;
  fs.writeFileSync(authPath, auth.slice(0, start) + stub);
  if (!fs.readFileSync(authPath, "utf8").includes("E2E STUB")) throw new Error("stub patch FAILED — marker missing after write");

  // 2. WEBPACK, not Turbopack, builds the copy (Turbopack refuses a node_modules symlink that points
  //    out of the project), and webpack's route-type check rejects `validateEventPayload` exported from
  //    `src/app/api/events/route.ts` — a latent problem in the app that the Turbopack build the site
  //    actually ships with does not enforce. Types are checked by the real `npm run build`; the copy only
  //    needs to run.
  patch("next.config.ts", "const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n  typescript: { ignoreBuildErrors: true },");

  // 3. no Clerk in the copy, so the proxy must not run `clerkMiddleware` (it throws without a key)
  patch("src/proxy.ts", "  return withClerk(req, event);", "  void withClerk; void event;\n  return NextResponse.next();");

  // 4. the "configuration required" check should not ask for Clerk keys the copy deliberately lacks
  patch(
    "src/lib/admin/context.ts",
    "  const missing = missingAdminEnv();",
    '  const missing = missingAdminEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "stub", CLERK_SECRET_KEY: "stub", DATABASE_URL: process.env.DATABASE_URL });',
  );
}

function build() {
  console.log(`copying the repository to ${work} …`);
  copyRepo();
  applyStub();
  console.log("building the stub-auth copy (sandbox database, third parties blanked) …");
  const r = spawnSync(process.execPath, [path.join(work, "node_modules/next/dist/bin/next"), "build", "--webpack"], { cwd: work, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error("next build failed in the copy");
}

async function portFree() {
  return new Promise((resolve) => {
    const probe = net.createServer().once("error", () => resolve(false)).once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cart/count`);
      if (res.ok) return;
    } catch {
      // not yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("the stub-auth server did not come up");
}

// ---- run ------------------------------------------------------------------------------
if (!args.has("--no-build") || !fs.existsSync(path.join(work, ".next"))) build();
if (!(await portFree())) {
  console.error(`REFUSING TO START: port ${port} is in use (ss -ltnp | grep :${port}). Set E2E_ADMIN_PORT.`);
  process.exit(1);
}

const server = spawn(process.execPath, [path.join(work, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: work,
  env: { ...env, PORT: String(port) },
  stdio: ["ignore", "inherit", "inherit"],
});
const stop = () => server.kill("SIGTERM");
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stop(); process.exit(130); });
await waitUp();
console.log(`stub-auth admin server → http://127.0.0.1:${port}/admin   (database: ${dbName}; NO ADMIN GATE — loopback only)`);

if (args.has("--keep")) {
  await new Promise(() => {});
} else {
  const test = spawnSync("npx", ["playwright", "test", "e2e/admin.pw.ts", ...playwrightArgs], {
    cwd: repo,
    env: { ...process.env, RESEND_API_KEY: DUMMY_RESEND_KEY, E2E_PORT: String(port), E2E_BASE_URL: `http://127.0.0.1:${port}`, E2E_ADMIN_STUB: "1" },
    stdio: "inherit",
  });
  stop();
  process.exit(test.status ?? 1);
}
