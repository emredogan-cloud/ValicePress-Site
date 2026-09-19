/**
 * Import every address this press already holds into the `contacts` table.
 *
 * ================================================================
 * THE ONE RULE: AN IMPORT CANNOT MANUFACTURE CONSENT.
 * ================================================================
 * This script may write `unknown`, `not_marketing_contact` or `opted_out`.
 * It may NEVER write `opted_in`. Not for a partner, not for someone who
 * replied warmly, not for a customer. The only thing that produces an
 * `opted_in` row is a person submitting a form that told them what they were
 * agreeing to, and that path lives in `src/lib/db/contacts.ts`
 * (`recordOptIn`), which refuses to be called without the evidence.
 *
 * That is not caution for its own sake. The largest source below is 81
 * published professional addresses — podcast hosts, editors, reviewers —
 * written to once, each about one specific book. Every one of them is marked
 * in its own source file: "PUBLIC_CONTACT: published professional address.
 * NOT a newsletter subscriber." Turning those into a mailing list would be
 * the single fastest way to burn this press's name, and the schema is built
 * so that it cannot happen by accident.
 *
 * ================================================================
 * SOURCES
 * ================================================================
 *   outreach   MARKETING/VALICE-PRESS-AUDIENCE-MASTER.csv
 *              Creator/press outreach. CONSENT_STATUS is PUBLIC_CONTACT or
 *              PARTNER — never a subscription. DO_NOT_CONTACT and any
 *              BOUNCED relationship stage become a suppression.
 *   free-book  free_book_requests   (the promotion's queue)
 *              Carries a real per-person answer: `marketing_consent` is the
 *              box they ticked, or did not. Unticked is `opted_out`, not
 *              `unknown` — they WERE asked, and they declined.
 *   customer   orders + users       (people who bought, and account holders)
 *              A purchase is a transaction, not a subscription. `unknown`.
 *
 * Nothing is read from Resend. Resend holds the people who DID subscribe, and
 * they arrive here through the live newsletter route as they always will —
 * importing them would produce `opted_in` rows whose evidence was invented by
 * this script, which is the exact thing above.
 *
 * ================================================================
 * SAFETY
 * ================================================================
 * Dry run by default, like every other script in this repository. `--commit`
 * writes. The merge rules in `recordContact` never lower an existing consent
 * state and never clear a suppression, so a re-run is safe and idempotent.
 *
 * Usage:
 *   node scripts/crm/import-contacts.mjs                       # dry run
 *   node scripts/crm/import-contacts.mjs --commit
 *   ENVFILE=.env.local node scripts/crm/import-contacts.mjs --commit
 *   node scripts/crm/import-contacts.mjs --commit --backup CRM/backup.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

const argv = process.argv.slice(2);
const commit = argv.includes("--commit");
const backupIdx = argv.indexOf("--backup");
const backupPath = backupIdx >= 0 ? argv[backupIdx + 1] : null;

const MARKETING_ROOT =
  process.env.VALICE_MARKETING_ROOT ??
  "/home/emre/Downloads/MY-DİGİTAL-BOOK/MARKETING";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const envFile = process.env.ENVFILE ?? ".env.local";
const env = {};
try {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
} catch {
  /* fall through to process.env */
}
const DATABASE_URL = env.DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL === "[SENSITIVE]") {
  console.error(
    `No usable DATABASE_URL in ${envFile}.\n` +
      "A redaction is not a value: `vercel env pull` writes the literal string\n" +
      "[SENSITIVE] for Sensitive variables, and this project has already spent a\n" +
      "session treating one of those as a connection string.",
  );
  process.exit(1);
}

let dbName = "(unparseable)";
try {
  dbName = new URL(DATABASE_URL).pathname.slice(1) || "(none)";
} catch {
  /* keep placeholder */
}

const sql = neon(DATABASE_URL);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const normalize = (e) => String(e ?? "").trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A minimal RFC 4180 reader — the outreach CSV has quoted commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// ---------------------------------------------------------------------------
// Source 1 — creator and press outreach
// ---------------------------------------------------------------------------
function readOutreach() {
  const file = path.join(MARKETING_ROOT, "VALICE-PRESS-AUDIENCE-MASTER.csv");
  if (!existsSync(file)) {
    console.log(`  (no outreach file at ${file} — skipped)`);
    return [];
  }
  const out = [];
  for (const r of parseCsv(readFileSync(file, "utf8"))) {
    const email = normalize(r.EMAIL);
    if (!EMAIL_RE.test(email)) continue;

    const stage = (r.RELATIONSHIP_STAGE ?? "").toUpperCase();
    const dnc = (r.DO_NOT_CONTACT ?? "").trim();
    // A suppression, however it arose. A bounce is not a decision the person
    // made, but it stops a send just as firmly, and the two are recorded on
    // the same column for exactly that reason.
    const suppressed = Boolean(dnc) || stage.startsWith("BOUNCED");

    out.push({
      email,
      name: (r.NAME ?? "").trim() || null,
      source: "outreach",
      // Provenance that a person can chase back to a row in the CSV.
      sourceDetail: [r.SOURCE, r.ORGANIZATION, r.ROLE].filter(Boolean).join(" · ").slice(0, 300) || null,
      // PUBLIC_CONTACT and PARTNER are both "we wrote to a professional
      // address about a book". Neither is a subscription.
      consent: "not_marketing_contact",
      suppressed,
      suppressReason: suppressed ? (dnc || stage) : null,
      customerStatus:
        (r.CONSENT_STATUS ?? "").toUpperCase() === "PARTNER" ? "partner" : "prospect",
      notes: (r.NOTES ?? "").trim().slice(0, 500) || null,
      firstSeen: (r.DATE_ADDED ?? "").trim() || null,
      lastSeen: (r.LAST_CONTACT ?? "").trim() || (r.DATE_ADDED ?? "").trim() || null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Source 2 — the free-ebook queue
// ---------------------------------------------------------------------------
async function readFreeBookRequests() {
  try {
    const rows = await sql`
      select email, marketing_consent, book_title, created_at
        from free_book_requests`;
    return rows.map((r) => ({
      email: normalize(r.email),
      name: null,
      source: "free-book",
      sourceDetail: r.book_title ? `Requested: ${r.book_title}` : null,
      // They WERE asked, in a form, with a box. Unticked is a decision.
      consent: r.marketing_consent ? "unknown" : "opted_out",
      // `unknown` rather than `opted_in` even when the box WAS ticked: the
      // consent this script can see is a boolean in a row, not the sentence
      // the person agreed to, and an opt-in without its evidence is exactly
      // what the contacts table refuses to hold. The live form records the
      // real thing going forward.
      consentNote: r.marketing_consent
        ? "Ticked 'email me about new books' on the free-ebook form; the wording " +
          "they agreed to was not stored with the row, so this is held as UNKNOWN " +
          "rather than as an opt-in."
        : null,
      suppressed: false,
      customerStatus: "prospect",
      notes: null,
      firstSeen: r.created_at ? new Date(r.created_at).toISOString() : null,
      lastSeen: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  } catch (err) {
    console.log(`  (free_book_requests unavailable: ${String(err.message).slice(0, 70)})`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Source 3 — customers and account holders
// ---------------------------------------------------------------------------
async function readCustomers() {
  const out = [];
  try {
    const rows = await sql`
      select u.email, u.name, count(o.id)::int as orders, min(u.created_at) as created_at
        from users u
        left join orders o on o.user_id = u.id and o.status = 'paid'
       group by u.email, u.name`;
    for (const r of rows) {
      const email = normalize(r.email);
      if (!EMAIL_RE.test(email)) continue;
      out.push({
        email,
        name: r.name ?? null,
        source: r.orders > 0 ? "customer" : "account",
        sourceDetail: r.orders > 0 ? `${r.orders} paid order(s)` : "Account holder, no orders",
        // A purchase is a transaction. Nobody agreed to anything beyond it.
        consent: "unknown",
        suppressed: false,
        customerStatus: r.orders > 0 ? "customer" : "prospect",
        purchased: r.orders > 0,
        purchaseCount: r.orders,
        notes: null,
        firstSeen: r.created_at ? new Date(r.created_at).toISOString() : null,
        lastSeen: r.created_at ? new Date(r.created_at).toISOString() : null,
      });
    }
  } catch (err) {
    console.log(`  (users/orders unavailable: ${String(err.message).slice(0, 70)})`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`env file : ${envFile}`);
console.log(`database : ${dbName}`);
console.log(`mode     : ${commit ? "COMMIT" : "DRY RUN"}`);
console.log(`marketing: ${MARKETING_ROOT}\n`);

console.log("reading sources…");
const outreach = readOutreach();
console.log(`  outreach       : ${outreach.length}`);
const freeBooks = await readFreeBookRequests();
console.log(`  free-book queue: ${freeBooks.length}`);
const customers = await readCustomers();
console.log(`  customers      : ${customers.length}`);

// Deduplicate case-insensitively, first source wins for provenance. The order
// below is deliberate: the outreach file is the only source that carries a
// human-written relationship note, so it should own `source_detail` when the
// same address also appears as a customer.
const merged = new Map();
for (const row of [...outreach, ...freeBooks, ...customers]) {
  const existing = merged.get(row.email);
  if (!existing) {
    merged.set(row.email, { ...row });
    continue;
  }
  // Merge: a later source can only ADD facts, never weaken them.
  existing.name = existing.name ?? row.name;
  existing.notes = existing.notes ?? row.notes;
  existing.purchased = existing.purchased || row.purchased || false;
  existing.purchaseCount = Math.max(existing.purchaseCount ?? 0, row.purchaseCount ?? 0);
  existing.suppressed = existing.suppressed || row.suppressed;
  if (row.customerStatus === "customer") existing.customerStatus = "customer";
  existing.sourceDetail = existing.sourceDetail
    ? `${existing.sourceDetail} | ${row.source}: ${row.sourceDetail ?? "—"}`
    : row.sourceDetail;
}

const rows = [...merged.values()];
console.log(`\nunique contacts after case-insensitive dedupe: ${rows.length}`);

const byConsent = rows.reduce((a, r) => {
  a[r.consent] = (a[r.consent] ?? 0) + 1;
  return a;
}, {});
console.log("consent states to be written:", JSON.stringify(byConsent));
console.log(`suppressions to be set: ${rows.filter((r) => r.suppressed).length}`);

if (byConsent.opted_in) {
  console.error(
    "\nREFUSING TO RUN: this import produced an `opted_in` row. An import may " +
      "never manufacture consent — see the header of this file.",
  );
  process.exit(1);
}

if (backupPath) {
  // A LOCAL, PRIVATE backup. Never committed: CRM/ is gitignored, the file is
  // chmod 600, and nothing in the build reads it.
  mkdirSync(path.dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  chmodSync(backupPath, 0o600);
  console.log(`\nbackup written (0600, gitignored): ${backupPath}`);
}

if (!commit) {
  console.log("\nDRY RUN — nothing written. Re-run with --commit.");
  console.log("First five rows:");
  for (const r of rows.slice(0, 5)) {
    console.log(`  ${r.email.padEnd(38)} ${r.source.padEnd(10)} ${r.consent}${r.suppressed ? " [suppressed]" : ""}`);
  }
  process.exit(0);
}

let written = 0;
for (const r of rows) {
  const first = r.firstSeen ? new Date(r.firstSeen) : new Date();
  const last = r.lastSeen ? new Date(r.lastSeen) : first;
  const consentSource = r.consentNote ?? null;
  await sql`
    insert into contacts
      (email, email_raw, name, source, source_detail, first_seen, last_seen,
       purchased, purchase_count, customer_status, marketing_consent,
       consent_source, unsubscribed, unsubscribed_at, notes)
    values
      (${r.email}, ${r.email}, ${r.name}, ${r.source}, ${r.sourceDetail},
       ${isNaN(first) ? new Date() : first}, ${isNaN(last) ? new Date() : last},
       ${r.purchased ?? false}, ${r.purchaseCount ?? 0}, ${r.customerStatus},
       ${r.consent}, ${consentSource}, ${r.suppressed},
       ${r.suppressed ? new Date() : null}, ${r.notes})
    on conflict (email) do update set
      last_seen = greatest(contacts.last_seen, excluded.last_seen),
      name = coalesce(contacts.name, excluded.name),
      source_detail = coalesce(contacts.source_detail, excluded.source_detail),
      purchased = contacts.purchased or excluded.purchased,
      purchase_count = greatest(contacts.purchase_count, excluded.purchase_count),
      -- Consent is only ever RAISED out of 'unknown'. An existing opted_in or
      -- opted_out is the person's own decision and an import never touches it.
      marketing_consent = case
        when contacts.marketing_consent = 'unknown' then excluded.marketing_consent
        else contacts.marketing_consent end,
      -- A suppression can be set by an import but never cleared by one.
      unsubscribed = contacts.unsubscribed or excluded.unsubscribed,
      notes = coalesce(contacts.notes, excluded.notes)`;
  written += 1;
}

const check = await sql`
  select marketing_consent, count(*)::int as n
    from contacts group by marketing_consent order by marketing_consent`;
console.log(`\n${written} rows upserted.`);
console.log("contacts table now holds:", JSON.stringify(check));
const mailable = await sql`
  select count(*)::int as n from contacts
   where marketing_consent = 'opted_in' and not unsubscribed`;
console.log(`MAILABLE (opted in, not suppressed): ${mailable[0].n}`);
