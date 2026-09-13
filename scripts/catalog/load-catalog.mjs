/**
 * Load the Valice Press catalog into the database.
 *
 * Idempotent: every write is an upsert keyed on a natural key (book slug,
 * author slug, category slug, or the (book, format) pair). Re-running
 * updates rows in place and never duplicates. Safe to run after editing
 * `valice-catalog.mjs`.
 *
 * Deliberately conservative in three ways:
 *
 *  1. Publication is DATA, not a side effect. A book reaches `published`
 *     only because `websiteStatus: "published"` is written next to its
 *     blockers in `valice-catalog.mjs`, where the decision is reviewable in
 *     a diff. The loader does not decide; it applies a decision that was
 *     already made in the open. A book whose `websiteStatus` is `draft`
 *     is actively demoted on re-run, so removing a title from sale is one
 *     edit rather than a manual database visit.
 *
 *  2. `providerPriceId` is only ever a real id produced by
 *     `provision-lemonsqueezy.mjs` against the live account. Writing a
 *     plausible-looking fake is precisely how a production row once ended up
 *     with `pri_test_meditations_999` and a checkout that failed at the till —
 *     so a value that does not look like a Lemon Squeezy variant id is
 *     rejected here rather than discovered by a customer.
 *
 *  3. It refuses to touch a database it wasn't pointed at deliberately.
 *     Production (`neondb`) and sandbox (`bookstore`) live on the same host;
 *     the target is printed and, for production, must be confirmed with
 *     --i-know-this-is-production.
 *
 * Usage:
 *   node scripts/catalog/load-catalog.mjs                 # dry run
 *   node scripts/catalog/load-catalog.mjs --commit
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { AUTHORS, BOOKS, CATEGORIES } from "./valice-catalog.mjs";

const commit = process.argv.includes("--commit");
const prodOk = process.argv.includes("--i-know-this-is-production");

function readEnvUrl() {
  const flag = process.argv.indexOf("--env");
  const envFile = flag !== -1 ? process.argv[flag + 1] : ".env.local";
  const raw = readFileSync(envFile, "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error(`DATABASE_URL not found in ${envFile}`);
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const sql = neon(readEnvUrl());
const [{ db }] = await sql`select current_database() as db`;

console.log(`target database : ${db}`);
console.log(`mode            : ${commit ? "COMMIT" : "DRY RUN"}`);
console.log(`books           : ${BOOKS.length}`);
console.log(
  `formats         : ${BOOKS.reduce((n, b) => n + b.formats.length, 0)}\n`,
);

if (db === "neondb" && commit && !prodOk) {
  console.error(
    "REFUSING: that is the production database.\n" +
      "Re-run with --i-know-this-is-production if this is genuinely intended.",
  );
  process.exit(1);
}

// ---- integrity gate -------------------------------------------------------
// Run before any write, on every run including dry runs. Each of these has
// been a real production defect at some point in this project's history.
// A Lemon Squeezy variant id is a positive integer, sent as a string. The
// old Paddle shape (`pri_…`) is rejected by this on purpose: a leftover Paddle
// id in the catalogue is a migration bug, not a price.
const VARIANT_ID_RE = /^[1-9][0-9]{0,14}$/;
const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));
const problems = [];
/** Sellable but not yet wired to a provider variant — reported, not fatal. */
const unwired = [];

for (const b of BOOKS) {
  // A category slug that matches nothing resolves to a null category_id and
  // fails mid-load on the book_categories NOT NULL constraint — after the
  // preceding books have already been written. "mythology-and-folklore" for
  // "myth-and-folklore" got that far once. Catch it before the first write.
  for (const c of b.categories ?? []) {
    if (!CATEGORY_SLUGS.has(c)) {
      problems.push(
        `${b.slug}: category "${c}" is not in CATEGORIES. ` +
          `Known: ${[...CATEGORY_SLUGS].join(", ")}.`,
      );
    }
  }

  const ebook = b.formats.find((f) => f.format === "ebook");

  /**
   * TWO DIFFERENT QUESTIONS, AND THEY STOPPED HAVING THE SAME ANSWER.
   *
   * `deliverableHere` — do we hold this file and can we hand it over? That is
   * what the free-ebook campaign needs, and what `books.master_file_key` is for.
   *
   * `sellsDirect` — may we CHARGE for it on this site? Since the Paddle
   * compliance gate (see `valice-catalog.mjs`), eighteen public-domain titles
   * answer yes to the first and no to the second: still ours to give away
   * during the campaign, no longer Paddle transactions.
   *
   * Conflating the two is not academic. `master_file_key` used to be written
   * only when `sellsDirect`, so switching the gate on would have nulled the key
   * for all eighteen and broken free delivery for two thirds of the catalogue —
   * the fulfilment path fails with "no master file on the book row" and the
   * reader gets nothing.
   */
  const deliverableHere =
    ebook?.fulfillment === "direct" && ebook.availability === "available";
  const sellsDirect = deliverableHere && b.directSale !== false;

  if (b.providerPriceId && !VARIANT_ID_RE.test(String(b.providerPriceId))) {
    problems.push(
      `${b.slug}: providerPriceId "${b.providerPriceId}" is not a Lemon Squeezy ` +
        `variant id (a positive integer). A leftover pri_… is a Paddle id and must not load.`,
    );
  }
  // "May we sell it" and "is it wired up" are different questions, and the
  // storefront already answers them separately: the buy control renders only
  // when `provider_price_id` is set, so a book that is allowed but unwired
  // shows no button rather than a broken one. Between retiring Paddle and
  // provisioning Lemon Squeezy, every sellable title is in exactly that
  // state, so this is counted and printed loudly — not treated as corruption.
  if (sellsDirect && !b.providerPriceId) {
    unwired.push(b.slug);
  }
  // The inverse IS corruption: a title we are not allowed to sell must never
  // carry a live provider price, or a later edit could quietly put it back on
  // sale without anybody deciding to. Codex Mythologica under KDP Select is
  // the case this protects.
  if (!sellsDirect && b.providerPriceId) {
    problems.push(
      `${b.slug}: not sold directly (directSale=${b.directSale}) yet still carries ` +
        `providerPriceId ${b.providerPriceId}. Held-out titles must have no provider price.`,
    );
  }
  if (deliverableHere && !ebook.masterFileKey) {
    problems.push(
      `${b.slug}: deliverable here but has no master file in R2 — fulfillment would have nothing to watermark.`,
    );
  }
  // Exclusivity is about DISTRIBUTION, not about money: giving a Select-
  // enrolled ebook away from this site breaches it exactly as selling it
  // would. This check was on `sellsDirect`, which stopped being the right
  // question the moment a book could be deliverable without being sold.
  if (deliverableHere && b.kdpSelect) {
    problems.push(
      `${b.slug}: distributed from this site while enrolled in KDP Select. That is an exclusivity breach.`,
    );
  }
  for (const f of b.formats) {
    // An Amazon call to action without a verified destination is the exact
    // defect this catalog was rebuilt to prevent.
    if (f.amazonUrl && !f.amazonAsin) {
      problems.push(`${b.slug}/${f.format}: amazonUrl without an ASIN.`);
    }
    // Amazon issues an ASIN when it ACCEPTS a title, not when the listing becomes
    // purchasable, so "publishing" legitimately carries one. This said "an ASIN only
    // exists once a title is live", which is not true and refused a verified ASIN:
    // B0HJ2TPX4T was issued for the Puzzle Book paperback on 2026-09-07 and its product
    // page resolves — right title, KDP's own ISBN, the built page count — while the
    // listing still shows no price. What the rule is actually for is an ASIN on a title
    // that was never created or is still in review, and it still catches those.
    if (f.amazonAsin && f.kdp !== "live" && f.kdp !== "publishing") {
      problems.push(
        `${b.slug}/${f.format}: has an ASIN but kdp="${f.kdp}". An ASIN exists only once Amazon has accepted the title (live or publishing).`,
      );
    }
    if (f.fulfillment === "amazon" && f.availability === "available" && !f.amazonUrl) {
      problems.push(
        `${b.slug}/${f.format}: Amazon-fulfilled and available, but no URL to send the buyer to.`,
      );
    }
  }
  if (b.websiteStatus !== "published" && b.websiteStatus !== "draft") {
    problems.push(`${b.slug}: websiteStatus must be "published" or "draft".`);
  }
}

if (problems.length) {
  console.error("CATALOG INTEGRITY FAILURES — refusing to load:\n");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("catalog integrity : OK");
if (unwired.length) {
  console.log(
    `\nNOT YET WIRED TO A CHECKOUT (${unwired.length}): these titles are cleared\n` +
      "for direct sale but have no provider variant id, so they load as published\n" +
      "books with NO buy button. Run scripts/catalog/provision-lemonsqueezy.mjs,\n" +
      "paste the ids back into valice-catalog.mjs, and re-run this loader.\n",
  );
  for (const slug of unwired) console.log(`  - ${slug}`);
  console.log("");
} else {
  console.log("");
}

if (!commit) {
  for (const b of BOOKS) {
    // "buyable" means we are CLEARED to take money for it, which is narrower
    // than "we hold the file": Codex Mythologica is deliverable and, until its
    // KDP Select term lapses on 2026-11-03, not buyable. Narrower again is
    // "wired" — cleared AND carrying a provider variant id; see `unwired`.
    const buyable =
      b.directSale !== false &&
      b.formats.some((f) => f.format === "ebook" && f.fulfillment === "direct" && f.availability === "available")
        ? 1
        : 0;
    const amazonLinks = b.formats.filter((f) => f.amazonUrl).length;
    console.log(
      `WOULD UPSERT  ${b.slug.padEnd(36)} ${b.websiteStatus.padEnd(9)} ` +
        `${String(b.formats.length).padStart(2)} formats  ` +
        `${buyable} buyable  ${amazonLinks} amazon  ${b.blockers.length} blocker(s)`,
    );
  }
  console.log("\ndry run complete — re-run with --commit to write.");
  process.exit(0);
}

// ---- categories -----------------------------------------------------------
const categoryIds = new Map();
for (const c of CATEGORIES) {
  const [row] = await sql`
    insert into categories (slug, name, description)
    values (${c.slug}, ${c.name}, ${c.description})
    on conflict (slug) do update set name = excluded.name,
                                     description = excluded.description
    returning id`;
  categoryIds.set(c.slug, row.id);
  console.log(`category  ${c.slug}`);
}

// ---- authors --------------------------------------------------------------
const authorIds = new Map();
for (const a of AUTHORS) {
  const [row] = await sql`
    insert into authors (slug, name, bio)
    values (${a.slug}, ${a.name}, ${a.bio})
    on conflict (slug) do update set name = excluded.name, bio = excluded.bio
    returning id`;
  authorIds.set(a.slug, row.id);
  console.log(`author    ${a.slug}`);
}

// ---- books ----------------------------------------------------------------
for (const b of BOOKS) {
  // `books.priceCents` is NOT NULL and represents the canonical direct-sale
  // price. Use the ebook format's price where there is one; where there
  // isn't (print-only titles, or a price the founder hasn't set), store 0
  // and leave the book in draft — a zero here is only ever seen by the
  // admin, because nothing at zero is publishable.
  // The canonical price is what this store charges, so it is the DIRECT
  // ebook price and nothing else. A book we only link to Amazon for has no
  // price of ours; storing Amazon's list price here would mean the cart
  // could quote a number we never charge.
  const ebook = b.formats.find((f) => f.format === "ebook");
  // See the validation block above for why these are two questions now.
  const deliverableHere =
    ebook?.fulfillment === "direct" && ebook.availability === "available";
  const sellsDirect = deliverableHere && b.directSale !== false;
  const canonicalPrice = sellsDirect ? ebook.priceCents : 0;

  // The fulfillment worker reads `books.master_file_key`, NOT the per-format
  // one — it is handed a bookId and has no format in scope. Writing only the
  // format row leaves the book unfulfillable: the purchase completes, the
  // entitlement is created, and the watermark step then fails with "book has
  // no masterFileKey" while the buyer's entitlement sits at `pending`
  // forever. Both are written from the one source of truth.
  const masterFileKey = deliverableHere ? ebook.masterFileKey : null;
  // The second delivered artifact, same rule. Null unless the edition is
  // actually sold here AND actually has an EPUB — the worker branches on this
  // column, and the storefront must never advertise a format it names as null.
  const epubFileKey = deliverableHere ? (ebook.epubFileKey ?? null) : null;

  const [book] = await sql`
    insert into books (slug, title, subtitle, description, language,
                       price_cents, currency, page_count, status,
                       provider_price_id, master_file_key, epub_file_key)
    values (${b.slug}, ${b.title}, ${b.subtitle}, ${b.description}, ${b.language},
            ${canonicalPrice}, 'USD', ${b.pageCount}, ${b.websiteStatus},
            ${b.providerPriceId ?? null}, ${masterFileKey}, ${epubFileKey})
    on conflict (slug) do update set
      title           = excluded.title,
      subtitle        = excluded.subtitle,
      description     = excluded.description,
      language        = excluded.language,
      page_count      = excluded.page_count,
      price_cents     = excluded.price_cents,
      -- Status and price ARE overwritten now, because both are declared in
      -- the catalog file and reviewed in a diff. The previous revision left
      -- them alone to protect a hand-made production edit; that protection
      -- has become the thing that lets production drift away from source.
      status          = excluded.status,
      provider_price_id = excluded.provider_price_id,
      master_file_key = excluded.master_file_key,
      epub_file_key   = excluded.epub_file_key,
      updated_at      = now()
    returning id, status`;

  console.log(`book      ${b.slug.padEnd(36)} ${book.status}`);

  // Reconcile, don't just add. Inserting with `on conflict do nothing` and
  // never deleting is how Meditations ended up filed under BOTH `pd-spine`
  // and `deep-thinking` — two categories from an abandoned strategy — long
  // after the catalog said it belonged in neither. Membership is now exactly
  // what the catalog file says it is.
  const wantedCategoryIds = b.categories.map((slug) => categoryIds.get(slug));
  for (const id of wantedCategoryIds) {
    await sql`
      insert into book_categories (book_id, category_id)
      values (${book.id}, ${id})
      on conflict do nothing`;
  }
  const removed = await sql`
    delete from book_categories
    where book_id = ${book.id}
      and category_id <> all(${wantedCategoryIds}::uuid[])
    returning category_id`;
  if (removed.length) {
    console.log(`  categories  removed ${removed.length} stale assignment(s)`);
  }
  for (const slug of b.authors) {
    await sql`
      insert into book_authors (book_id, author_id)
      values (${book.id}, ${authorIds.get(slug)})
      on conflict do nothing`;
  }

  for (const f of b.formats) {
    // `unavailable` does not mean "not ready" — it means this edition does
    // not exist and is not going to. The Myth Hunter's Field Book has no
    // ebook because it is written in by hand; World Myths has no large
    // print by decision K6/A6. Loading those would put a row on the product
    // page reading "Not yet available", which promises a forthcoming
    // edition that nobody intends to make. The reason stays in the catalog
    // file, where it belongs; the storefront simply does not list it.
    //
    // Deleted rather than skipped so that marking an edition unavailable
    // actually removes it on the next run instead of leaving a stale row.
    if (f.availability === "unavailable") {
      await sql`delete from book_formats
                where book_id = ${book.id} and format = ${f.format}`;
      console.log(`  format  ${f.format.padEnd(12)} (not an edition — omitted)`);
      continue;
    }

    await sql`
      insert into book_formats (book_id, format, availability, fulfillment,
                                price_cents, currency, amazon_asin, amazon_url,
                                page_count, isbn, master_file_key)
      values (${book.id}, ${f.format}, ${f.availability}, ${f.fulfillment},
              ${f.priceCents}, 'USD', ${f.amazonAsin}, ${f.amazonUrl ?? null},
              ${f.pageCount}, ${f.isbn ?? null}, ${f.masterFileKey})
      on conflict (book_id, format) do update set
        availability    = excluded.availability,
        fulfillment     = excluded.fulfillment,
        price_cents     = excluded.price_cents,
        amazon_asin     = excluded.amazon_asin,
        amazon_url      = excluded.amazon_url,
        page_count      = excluded.page_count,
        isbn            = excluded.isbn,
        master_file_key = excluded.master_file_key,
        updated_at      = now()`;
    console.log(
      `  format  ${f.format.padEnd(12)} ${f.availability.padEnd(12)} ${f.fulfillment}`,
    );
  }
}

// ---- remove categories nothing is filed under ----------------------------
// A category page with no books on it is a promise the catalog cannot keep.
// Two of these ("Builder Core", "Speculative Shelf") were live in production
// with zero books. Only empty ones are removed — a category that still holds
// a book is never deleted out from under it, whatever the catalog says.
const orphans = await sql`
  delete from categories c
  where not exists (select 1 from book_categories bc where bc.category_id = c.id)
  returning slug`;
for (const o of orphans) console.log(`category  removed (empty)  ${o.slug}`);

const published = BOOKS.filter((b) => b.websiteStatus === "published").length;
// Deliverable and buyable are different questions since the Paddle compliance
// gate; reporting the first under the second's name is how a summary line
// quietly says eighteen public-domain titles are still on sale.
const deliverable = BOOKS.filter((b) =>
  b.formats.some(
    (f) => f.format === "ebook" && f.fulfillment === "direct" && f.availability === "available",
  ),
).length;
// "cleared" and "wired" are different, and the difference is a buy button.
// Reporting only the first is how a run can announce "27 buyable" over a
// storefront on which nothing at all can be bought.
const clearedToSell = BOOKS.filter(
  (b) =>
    b.directSale !== false &&
    b.formats.some(
      (f) => f.format === "ebook" && f.fulfillment === "direct" && f.availability === "available",
    ),
);
const buyable = clearedToSell.filter((b) => b.providerPriceId).length;
const amazonFormats = BOOKS.reduce(
  (n, b) => n + b.formats.filter((f) => f.amazonUrl).length,
  0,
);

console.log(`\nloaded ${BOOKS.length} books into ${db}.`);
console.log(`  published on the site      : ${published}`);
console.log(`  deliverable here (we hold the file): ${deliverable}`);
console.log(`  cleared to sell here       : ${clearedToSell.length}`);
console.log(`  BUYABLE (cleared + wired to a checkout): ${buyable}`);
console.log(`  formats linking to Amazon  : ${amazonFormats} (all ASIN-verified)`);
