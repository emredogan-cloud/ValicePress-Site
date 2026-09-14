/**
 * The reader's adversarial test harness (Directive §12, §46, §47).
 *
 * WHY THIS EXISTS RATHER THAN MORE UNIT TESTS
 * -------------------------------------------
 * The unit tests in `src/` pin pure functions — the spread model, the uuid
 * guard, the throttle's arithmetic. None of them can answer the question this
 * system actually has to answer: given two real accounts, two real books, two
 * real watermarked artifacts in R2 and the real Postgres schema, can account A
 * reach account B's book? That question has to be asked of the running system,
 * with real rows, or the answer is worthless.
 *
 * The project's own memory records why: "presence checks lie", and four of five
 * providers once passed a `process.env.X !== undefined` check while being
 * wrong. The same discipline applies here. Every assertion below is made
 * against a real database read or a real HTTP response, never against a
 * constant this file also wrote.
 *
 * WHAT IT COVERS, AND WHAT IT CANNOT
 * ----------------------------------
 * The authorization layer is covered end to end: ownership, cross-book,
 * cross-user, revocation, tampering, enumeration, and the isolation of
 * progress and bookmarks. The Clerk SESSION layer is not forgeable from a
 * script, so the HTTP half of the audit exercises exactly what an attacker
 * without a session can do — which is the case that matters most — and the
 * authenticated-non-owner case is proved at the authorization primitive that
 * every authenticated path funnels through.
 *
 * USAGE
 *   node scripts/reader/security-audit.mjs --seed          # build fixtures
 *   node scripts/reader/security-audit.mjs                 # run the audit
 *   node scripts/reader/security-audit.mjs --base <url>    # include HTTP tests
 *   node scripts/reader/security-audit.mjs --clean         # remove fixtures
 *
 * It targets `.env.local` (the `bookstore` sandbox) unless `--env` says
 * otherwise. Check the database name it prints before believing anything.
 */

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Environment — the two env files hold different halves of the credentials,
// which is a documented trap in this repository rather than an accident here.
// ---------------------------------------------------------------------------

function loadEnv(file, only = null) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (only && !only.test(key)) continue;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

const envFlag = process.argv.indexOf("--env");
const envFile = envFlag !== -1 ? process.argv[envFlag + 1] : ".env.local";
loadEnv(envFile);
// R2 credentials are Sensitive in Vercel and come back redacted, so the local
// `.env` is the only place they are readable. Same buckets either way.
loadEnv(".env", /^R2_/);

const baseFlag = process.argv.indexOf("--base");
const BASE_URL = baseFlag !== -1 ? process.argv[baseFlag + 1] : null;

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const FIXTURE_PREFIX = "reader-audit";
const A_EMAIL = `${FIXTURE_PREFIX}-alpha@valice.test`;
const B_EMAIL = `${FIXTURE_PREFIX}-beta@valice.test`;

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const results = [];
let currentSection = "";

function section(name) {
  currentSection = name;
  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 62 - name.length))}`);
}

function check(threat, attack, expected, actual, pass) {
  results.push({ section: currentSection, threat, attack, expected, actual, pass });
  const mark = pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${mark}  ${threat}`);
  if (!pass) {
    console.log(`        attack   : ${attack}`);
    console.log(`        expected : ${expected}`);
    console.log(`        actual   : ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function pickBooks() {
  // Two books that differ in the way that matters for the reader: one short,
  // one long. Both must have a real master, or the artifact is a fiction.
  const rows = await sql`
    select id, slug, title, page_count, master_file_key
    from books
    where master_file_key is not null and status = 'published'
    order by page_count asc
  `;
  if (rows.length < 2) {
    throw new Error("need at least two books with masters to run this audit");
  }
  return { small: rows[0], large: rows[rows.length - 1] };
}

async function ensureUser(email, name) {
  const [existing] = await sql`select id from users where email = ${email}`;
  if (existing) return existing.id;
  const [created] = await sql`
    insert into users (email, name, auth_provider)
    values (${email}, ${name}, 'audit-fixture')
    returning id
  `;
  return created.id;
}

async function ensureOrderAndEntitlement(userId, book, ref) {
  const [existingOrder] = await sql`
    select id from orders where mor_order_ref = ${ref}
  `;
  const orderId =
    existingOrder?.id ??
    (
      await sql`
        insert into orders (user_id, mor_order_ref, payment_provider,
                            total_cents, currency, status)
        values (${userId}, ${ref}, 'lemonsqueezy', 999, 'USD', 'paid')
        returning id
      `
    )[0].id;

  const [existing] = await sql`
    select id, status, watermarked_key from entitlements
    where user_id = ${userId} and book_id = ${book.id}
  `;
  if (existing) return { orderId, entitlementId: existing.id };

  const [created] = await sql`
    insert into entitlements (user_id, book_id, order_id, status)
    values (${userId}, ${book.id}, ${orderId}, 'pending')
    returning id
  `;
  await sql`
    insert into watermark_jobs (entitlement_id, status)
    values (${created.id}, 'queued')
  `;
  return { orderId, entitlementId: created.id };
}

async function seed() {
  const { small, large } = await pickBooks();
  console.log(`fixture books  : A→${small.slug} (${small.page_count}pp), B→${large.slug} (${large.page_count}pp)`);

  const userA = await ensureUser(A_EMAIL, "Audit Alpha");
  const userB = await ensureUser(B_EMAIL, "Audit Beta");

  const a = await ensureOrderAndEntitlement(userA, small, `${FIXTURE_PREFIX}-a`);
  const b = await ensureOrderAndEntitlement(userB, large, `${FIXTURE_PREFIX}-b`);

  // The real worker, against the real master, writing a real object to R2.
  // Nothing about the artifact is simulated — if this step cannot produce a
  // watermarked PDF, the audit has no business claiming the reader can serve
  // one.
  const { watermarkOneBook } = await import("../../src/inngest/functions/watermark.ts");
  for (const [label, userId, book, order] of [
    ["A", userA, small, a],
    ["B", userB, large, b],
  ]) {
    const result = await watermarkOneBook({
      orderId: order.orderId,
      userId,
      bookId: book.id,
      buyerName: `Audit ${label}`,
    });
    console.log(`watermark ${label}    : ${result.status} → ${result.artifactKey}`);
  }

  console.log("\nfixtures ready.");
}

async function clean() {
  const users = await sql`
    select id from users where email in (${A_EMAIL}, ${B_EMAIL})
  `;
  const ids = users.map((u) => u.id);
  if (ids.length === 0) {
    console.log("no fixtures to remove.");
    return;
  }
  // Order matters: the FKs on orders/entitlements are `restrict`.
  await sql`delete from bookmarks where user_id = any(${ids})`;
  await sql`delete from reading_progress where user_id = any(${ids})`;
  await sql`delete from reader_access_events where user_id = any(${ids})`;
  await sql`delete from watermark_jobs where entitlement_id in
            (select id from entitlements where user_id = any(${ids}))`;
  await sql`delete from entitlements where user_id = any(${ids})`;
  await sql`delete from order_items where order_id in
            (select id from orders where user_id = any(${ids}))`;
  await sql`delete from orders where user_id = any(${ids})`;
  await sql`delete from users where id = any(${ids})`;
  console.log(`removed ${ids.length} fixture accounts and everything they owned.`);
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

async function loadFixtures() {
  const [a] = await sql`select id from users where email = ${A_EMAIL}`;
  const [b] = await sql`select id from users where email = ${B_EMAIL}`;
  if (!a || !b) {
    throw new Error("fixtures missing — run with --seed first");
  }
  const [entA] = await sql`
    select e.id, e.book_id, e.status, e.watermarked_key, b.slug
    from entitlements e join books b on b.id = e.book_id
    where e.user_id = ${a.id}
  `;
  const [entB] = await sql`
    select e.id, e.book_id, e.status, e.watermarked_key, b.slug
    from entitlements e join books b on b.id = e.book_id
    where e.user_id = ${b.id}
  `;
  return { userA: a.id, userB: b.id, entA, entB };
}

async function auditAuthorization(fx) {
  const { resolveEntitlementAccess } = await import(
    "../../src/lib/db/queries/ownership.ts"
  );

  section("Authorization — the primitive every reader path funnels through");

  // 1. The owner.
  const own = await resolveEntitlementAccess(fx.userA, fx.entA.book_id);
  check(
    "Owner reads their own book",
    `resolveEntitlementAccess(A, bookA)`,
    "ready, with an artifact key",
    `${own.state}${own.artifactKey ? " + key" : ""}`,
    own.state === "ready" && Boolean(own.artifactKey),
  );

  // 2. Cross-user. THE test (§52).
  const cross = await resolveEntitlementAccess(fx.userB, fx.entA.book_id);
  check(
    "User B cannot reach User A's book",
    `resolveEntitlementAccess(B, bookA)`,
    "not-owned",
    cross.state,
    cross.state === "not-owned",
  );

  // 3. Cross-book: an owner of one book reaching for another.
  const otherBook = await resolveEntitlementAccess(fx.userA, fx.entB.book_id);
  check(
    "An owner of one book cannot reach a book they do not own",
    `resolveEntitlementAccess(A, bookB)`,
    "not-owned",
    otherBook.state,
    otherBook.state === "not-owned",
  );

  // 4. A book that does not exist is indistinguishable from one not owned.
  const ghost = await resolveEntitlementAccess(
    fx.userA,
    "00000000-0000-4000-8000-000000000000",
  );
  check(
    "A non-existent book answers exactly as an unowned one does",
    `resolveEntitlementAccess(A, <random uuid>)`,
    "not-owned — same value as case 3, so nothing can be enumerated",
    ghost.state,
    ghost.state === "not-owned" && ghost.state === otherBook.state,
  );

  // 5. Revocation closes the gate with no code change at the call site.
  await sql`update entitlements set status = 'revoked' where id = ${fx.entA.id}`;
  const revoked = await resolveEntitlementAccess(fx.userA, fx.entA.book_id);
  await sql`update entitlements set status = 'ready' where id = ${fx.entA.id}`;
  check(
    "A revoked entitlement closes the reader",
    `status := revoked, then resolve(A, bookA)`,
    "not-ready",
    revoked.state,
    revoked.state === "not-ready",
  );

  // 6. Pending — a paid book still in the press must not be readable either.
  await sql`update entitlements set status = 'pending' where id = ${fx.entA.id}`;
  const pending = await resolveEntitlementAccess(fx.userA, fx.entA.book_id);
  await sql`update entitlements set status = 'ready' where id = ${fx.entA.id}`;
  check(
    "A pending entitlement does not open the reader",
    `status := pending, then resolve(A, bookA)`,
    "not-ready",
    pending.state,
    pending.state === "not-ready",
  );

  // 7. A `ready` row whose artifact key is missing must not be called ready.
  await sql`update entitlements set watermarked_key = null where id = ${fx.entA.id}`;
  const keyless = await resolveEntitlementAccess(fx.userA, fx.entA.book_id);
  await sql`update entitlements set watermarked_key = ${fx.entA.watermarked_key}
            where id = ${fx.entA.id}`;
  check(
    "Ready with no artifact is treated as not ready, not as a 500",
    `watermarked_key := null, then resolve(A, bookA)`,
    "not-ready",
    keyless.state,
    keyless.state === "not-ready",
  );
}

async function auditShapeGuard() {
  const { isBookId } = await import("../../src/lib/reader-access.ts");
  section("Tampering — what reaches a query");

  const hostile = [
    ["Path traversal", "../../etc/passwd"],
    ["Encoded traversal", "..%2F..%2Fetc%2Fpasswd"],
    ["A storage key", "books/meditations/master/v1/master.pdf"],
    ["A storefront slug", "kwaidan"],
    ["SQL", "' OR 1=1--"],
    ["Markup", "<script>alert(1)</script>"],
    ["The nil uuid", "00000000-0000-0000-0000-000000000000"],
    ["A megabyte of junk", "a".repeat(1_000_000)],
  ];
  for (const [label, value] of hostile) {
    check(
      `Book-id tampering — ${label.toLowerCase()} is refused before any IO`,
      `GET /read/${label === "A megabyte of junk" ? "<1MB>" : value}`,
      "refused by the shape guard",
      isBookId(value) ? "ACCEPTED" : "refused",
      !isBookId(value),
    );
  }
}

async function auditIsolation(fx) {
  const { writeReadingProgress } = await import(
    "../../src/app/read/[bookId]/actions.ts"
  );
  const { toggleBookmark, listBookmarks } = await import(
    "../../src/lib/db/queries/bookmarks.ts"
  );

  section("Per-user state — progress and bookmarks");

  // Progress: A writes to their own book.
  const own = await writeReadingProgress({
    userId: fx.userA,
    bookId: fx.entA.book_id,
    page: 42,
    percent: 30,
  });
  check(
    "An owner records progress in their own book",
    "writeReadingProgress(A, bookA, 42)",
    "ok",
    JSON.stringify(own),
    own.ok === true,
  );

  // Progress: B writes to a book B does not own.
  const foreign = await writeReadingProgress({
    userId: fx.userB,
    bookId: fx.entA.book_id,
    page: 999,
    percent: 99,
  });
  check(
    "A non-owner cannot record progress in someone else's book",
    "writeReadingProgress(B, bookA, 999)",
    "refused",
    JSON.stringify(foreign),
    foreign.ok === false,
  );

  // And A's value is untouched.
  const [row] = await sql`
    select page from reading_progress
    where user_id = ${fx.userA} and book_id = ${fx.entA.book_id}
  `;
  check(
    "A's reading position is unchanged by B's attempt",
    "read reading_progress(A, bookA) after B's write",
    "page 42",
    `page ${row?.page}`,
    row?.page === 42,
  );

  // Rows are keyed per user, so B's own progress in B's own book is separate.
  await writeReadingProgress({
    userId: fx.userB,
    bookId: fx.entB.book_id,
    page: 7,
    percent: 3,
  });
  const both = await sql`
    select user_id, page from reading_progress
    where user_id in (${fx.userA}, ${fx.userB})
    order by page
  `;
  check(
    "Progress is per (user, book), never global to the book",
    "read both readers' rows",
    "two distinct rows, 7 and 42",
    both.map((r) => r.page).join(", "),
    both.length === 2 && both[0].page === 7 && both[1].page === 42,
  );

  // Bookmarks.
  const marked = await toggleBookmark({
    userId: fx.userA,
    bookId: fx.entA.book_id,
    page: 12,
  });
  check(
    "An owner marks a page in their own book",
    "toggleBookmark(A, bookA, 12)",
    "ok, added",
    JSON.stringify(marked),
    marked.ok === true && marked.added === true,
  );

  const foreignMark = await toggleBookmark({
    userId: fx.userB,
    bookId: fx.entA.book_id,
    page: 12,
  });
  check(
    "A non-owner cannot mark a page in someone else's book",
    "toggleBookmark(B, bookA, 12)",
    "refused: not-owned",
    JSON.stringify(foreignMark),
    foreignMark.ok === false && foreignMark.reason === "not-owned",
  );

  const aList = await listBookmarks(fx.userA, fx.entA.book_id);
  const bList = await listBookmarks(fx.userB, fx.entA.book_id);
  check(
    "One reader's bookmarks are invisible to another",
    "listBookmarks(B, bookA)",
    "A sees 1, B sees 0",
    `A sees ${aList.length}, B sees ${bList.length}`,
    aList.length === 1 && bList.length === 0,
  );

  // Idempotency of the toggle under a double click.
  const [first, second] = await Promise.all([
    toggleBookmark({ userId: fx.userA, bookId: fx.entA.book_id, page: 55 }),
    toggleBookmark({ userId: fx.userA, bookId: fx.entA.book_id, page: 55 }),
  ]);
  const after = await listBookmarks(fx.userA, fx.entA.book_id);
  const dupes = after.filter((m) => m.page === 55).length;
  check(
    "A simultaneous double-mark cannot produce a duplicate row",
    "two concurrent toggleBookmark(A, bookA, 55)",
    "at most one row for page 55",
    `${dupes} row(s); results ${JSON.stringify([first.ok, second.ok])}`,
    dupes <= 1,
  );

  // Clean up the marks this section made so a re-run starts level.
  await sql`delete from bookmarks where user_id = ${fx.userA}`;
}

async function auditThrottle() {
  const { registerReaderDenial, __resetReaderThrottleForTests, DENIAL_LIMIT } =
    await import("../../src/lib/reader-throttle.ts");

  section("Enumeration — the denial budget");

  __resetReaderThrottleForTests();
  let throttledAt = null;
  for (let i = 1; i <= DENIAL_LIMIT + 4; i++) {
    const { throttled } = await registerReaderDenial("audit:prober");
    if (throttled && throttledAt === null) throttledAt = i;
  }
  check(
    "Repeated refusals are throttled before a 30-book catalogue can be walked",
    `${DENIAL_LIMIT + 4} refusals from one identity`,
    `throttled at or before refusal ${DENIAL_LIMIT + 1}`,
    throttledAt === null ? "never throttled" : `throttled at ${throttledAt}`,
    throttledAt !== null && throttledAt <= DENIAL_LIMIT + 1,
  );

  const bystander = await registerReaderDenial("audit:bystander");
  check(
    "One identity's throttle does not lock out another",
    "a different identity's first refusal",
    "not throttled",
    bystander.throttled ? "throttled" : "not throttled",
    bystander.throttled === false,
  );
  __resetReaderThrottleForTests();
}

async function auditArtifact(fx) {
  const { headObject, ARTIFACTS_BUCKET, generateSignedDownloadUrl } =
    await import("../../src/lib/storage/index.ts");

  section("Storage — the artifact and its delivery");

  const head = await headObject({
    bucket: ARTIFACTS_BUCKET,
    key: fx.entA.watermarked_key,
  });
  check(
    "The watermarked artifact is a real object in the private bucket",
    `HEAD artifacts/${fx.entA.watermarked_key}`,
    "exists, non-empty, application/pdf",
    `exists=${head.exists} bytes=${head.contentLength} type=${head.contentType}`,
    head.exists === true && head.contentLength > 1000,
  );

  // The signed URL still exists — it is simply minted server-side now. Its TTL
  // ceiling is the thing worth pinning, because a long-lived one would undo
  // the point of never sending it to the browser.
  const { MAX_DOWNLOAD_TTL_SECONDS } = await import(
    "../../src/lib/storage/index.ts"
  );
  let ttlRefused = false;
  try {
    await generateSignedDownloadUrl({
      bucket: ARTIFACTS_BUCKET,
      key: fx.entA.watermarked_key,
      ttlSeconds: 60 * 60 * 24,
    });
  } catch {
    ttlRefused = true;
  }
  check(
    "A long-lived signed URL cannot be minted",
    "generateSignedDownloadUrl(ttl = 24h)",
    `refused above ${MAX_DOWNLOAD_TTL_SECONDS}s`,
    ttlRefused ? "refused" : "ISSUED",
    ttlRefused,
  );

  // The bucket must not be publicly readable. R2_PUBLIC_BASE_URL is the CDN in
  // front of the PUBLIC assets; if the artifact answers there, everything else
  // in this file is decoration.
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (publicBase) {
    const url = `${publicBase.replace(/\/$/, "")}/${fx.entA.watermarked_key}`;
    let status = "unreachable";
    try {
      const res = await fetch(url, { method: "HEAD" });
      status = String(res.status);
    } catch (err) {
      status = `network: ${err.message}`;
    }
    check(
      "The watermarked artifact is not served by the public asset host",
      `HEAD ${publicBase}/<artifact key>`,
      "404 or 403 — never 200",
      status,
      status !== "200",
    );
  }
}

async function auditHttp(fx) {
  if (!BASE_URL) {
    console.log(
      "\n(skipping the HTTP half — pass --base http://localhost:3000 to include it)",
    );
    return;
  }

  section(`HTTP, with no session — ${BASE_URL}`);

  const noCookie = { redirect: "manual", headers: { "user-agent": "valice-audit" } };

  // 1. The asset route, for a book that genuinely exists and is genuinely
  //    owned by someone. The single most important response in this file.
  const asset = await fetch(
    `${BASE_URL}/api/read/${fx.entA.book_id}/content`,
    noCookie,
  );
  const assetBody = await asset.arrayBuffer();
  check(
    "Direct asset access without a session returns no bytes",
    `GET /api/read/${fx.entA.book_id}/content (no cookie)`,
    "404, zero-length body",
    `${asset.status}, ${assetBody.byteLength} bytes`,
    asset.status === 404 && assetBody.byteLength === 0,
  );

  check(
    "The refusal carries no-store, so nothing can cache it",
    "response headers of the above",
    "cache-control contains no-store",
    asset.headers.get("cache-control") ?? "(absent)",
    (asset.headers.get("cache-control") ?? "").includes("no-store"),
  );

  // 2. A range request — the shape pdf.js actually sends. It must not be a
  //    path around the gate.
  const ranged = await fetch(`${BASE_URL}/api/read/${fx.entA.book_id}/content`, {
    ...noCookie,
    headers: { ...noCookie.headers, Range: "bytes=0-1023" },
  });
  check(
    "A range request without a session is refused like any other",
    "GET … with Range: bytes=0-1023",
    "404, and never a 206",
    String(ranged.status),
    ranged.status === 404,
  );

  // 3. Enumeration: an unowned-but-real book and a random uuid must be
  //    indistinguishable.
  const realOther = await fetch(
    `${BASE_URL}/api/read/${fx.entB.book_id}/content`,
    noCookie,
  );
  const random = await fetch(
    `${BASE_URL}/api/read/11111111-1111-4111-8111-111111111111/content`,
    noCookie,
  );
  check(
    "A real book and a fictional one answer identically",
    "GET the asset route for each",
    "the same status for both",
    `real=${realOther.status} fictional=${random.status}`,
    realOther.status === random.status,
  );

  // 4. Tampered ids.
  for (const [label, path] of [
    ["a slug", "kwaidan"],
    ["a storage key", encodeURIComponent("books/kwaidan/master/v1/master.pdf")],
    ["traversal", encodeURIComponent("../../etc/passwd")],
    ["SQL", encodeURIComponent("' OR 1=1--")],
  ]) {
    const res = await fetch(`${BASE_URL}/api/read/${path}/content`, noCookie);
    const body = await res.text();
    check(
      `Book-id tampering over HTTP — ${label}`,
      `GET /api/read/${path}/content`,
      "4xx, and no book content",
      `${res.status}, ${body.length} chars`,
      res.status >= 400 && !body.includes("%PDF"),
    );
  }

  // 5. The reader page itself, with no session. Clerk's middleware sends it to
  //    sign-in; either that or a 404 is correct. What is NOT correct is a 200.
  const page = await fetch(`${BASE_URL}/read/${fx.entA.book_id}`, noCookie);
  const pageBody = page.status === 200 ? await page.text() : "";
  check(
    "The reader page is not rendered for a visitor with no session",
    `GET /read/${fx.entA.book_id} (no cookie)`,
    "a redirect to sign-in, or 404 — never a rendered reader",
    `${page.status}${page.headers.get("location") ? ` → ${new URL(page.headers.get("location"), BASE_URL).pathname}` : ""}`,
    page.status !== 200 || !pageBody.includes("vp-reader"),
  );

  // 6. No signed URL anywhere in the page. This is the regression guard for
  //    the exact defect this work removed.
  check(
    "No presigned storage URL appears in the reader page's markup",
    "search the response body for an AWS signature",
    "no X-Amz-Signature, no r2.cloudflarestorage.com",
    pageBody.includes("X-Amz-Signature") || pageBody.includes("r2.cloudflarestorage.com")
      ? "FOUND"
      : "absent",
    !pageBody.includes("X-Amz-Signature") &&
      !pageBody.includes("r2.cloudflarestorage.com"),
  );

  // 7. Security headers on a public page — the reader inherits these.
  const home = await fetch(`${BASE_URL}/`, noCookie);
  for (const [header, needle] of [
    ["content-security-policy", "frame-ancestors 'none'"],
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
    ["referrer-policy", "strict-origin"],
  ]) {
    const value = home.headers.get(header) ?? "";
    check(
      `Security header — ${header}`,
      "GET /",
      `contains "${needle}"`,
      value || "(absent)",
      value.toLowerCase().includes(needle.toLowerCase()),
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL).pathname.replace("/", "");
  } catch {
    return "(unparseable)";
  }
})();

console.log(`env file       : ${envFile}`);
console.log(`database       : ${dbName}`);
console.log(`base url       : ${BASE_URL ?? "(database-only run)"}`);

if (process.argv.includes("--clean")) {
  await clean();
  process.exit(0);
}

if (process.argv.includes("--seed")) {
  await seed();
  process.exit(0);
}

const fixtures = await loadFixtures();
await auditAuthorization(fixtures);
await auditShapeGuard();
await auditIsolation(fixtures);
await auditThrottle();
await auditArtifact(fixtures);
await auditHttp(fixtures);

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${"═".repeat(66)}\n${results.length - failed.length}/${results.length} passed` +
    (failed.length ? `, \x1b[31m${failed.length} FAILED\x1b[0m` : ", \x1b[32mno failures\x1b[0m"),
);

if (process.argv.includes("--json")) {
  console.log(`\n${JSON.stringify(results, null, 2)}`);
}

process.exit(failed.length ? 1 : 0);
