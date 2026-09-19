/**
 * Valice Press — Drizzle schema (Roadmap §10).
 *
 * Conventions
 *  - Physical table names are plural snake_case (avoids the reserved-word
 *    pitfalls of `user` and `order` while staying SQL-idiomatic). Drizzle
 *    exports stay singular (`users`, `books`, …) for ergonomic imports.
 *  - All primary keys are UUIDs (`gen_random_uuid()`, pgcrypto — Neon-enabled).
 *  - All timestamps are `timestamptz` with `defaultNow()`; row-update times
 *    use Drizzle's ORM-level `$onUpdate` (no DB triggers).
 *  - Money is stored as integer cents; ISO-4217 currency codes are varchar(3).
 *  - Foreign-key `onDelete` policies are deliberate: cascade for personal
 *    derived data (reading progress, reviews, watermark jobs, download logs,
 *    join rows), restrict for anything that participates in order/entitlement
 *    history (so deleting a user doesn't erase their commercial paper trail).
 *  - Indexes follow §10 exactly (book.slug uk, status+published_at, entitlement
 *    (user, book) uk, order.mor_order_ref uk, plus a GIN FTS index on books).
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  jsonb,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// -----------------------------------------------------------------------------
// Custom column type — Postgres `tsvector` for full-text search.
// -----------------------------------------------------------------------------
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------
export const bookStatusEnum = pgEnum("book_status", [
  "draft",
  "published",
  "archived",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const entitlementStatusEnum = pgEnum("entitlement_status", [
  "pending",
  "ready",
  "revoked",
]);

// Reading status — independent of the fulfillment lifecycle in
// `entitlement_status`. Defaults to "not_started"; users flip it from
// the /account/library shelf via the `updateReadStatus` server action.
// "wishlist" is reserved for a future feature (separate wishlist table);
// the current library tabs only consume not_started/reading/finished.
export const readStatusEnum = pgEnum("read_status", [
  "not_started",
  "reading",
  "finished",
]);

export const watermarkJobStatusEnum = pgEnum("watermark_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

// Commerce lifecycle audit-event types (Phase F — order/entitlement state
// transitions driven by Paddle MoR webhooks; `revoked` is also reachable via
// support action). Append-only; see `commerce_events`.
// Who took the money. A column, not a constant, because this storefront has
// now changed merchant of record twice and the old rows must keep saying which
// provider they belong to — a Paddle transaction id looked up against the
// Lemon Squeezy API is not "missing", it is a category error. `paddle` is the
// default so that every row written before 2026-09-13 backfills correctly.
export const paymentProviderEnum = pgEnum("payment_provider", [
  "paddle",
  "lemonsqueezy",
]);

export const commerceEventTypeEnum = pgEnum("commerce_event_type", [
  "paid",
  "payment_failed",
  "transaction_canceled",
  "refunded",
  "chargeback",
  "revoked",
]);

// The editions a title can exist in. One book, many formats — a reader
// choosing between the paperback and the ebook is choosing a format of the
// same work, not a different product.
export const bookFormatEnum = pgEnum("book_format", [
  "ebook",
  "paperback",
  "hardcover",
  "large_print",
]);

// Who actually fulfils an order for a given format.
//
// This distinction is the whole reason `book_formats` exists. Amazon's KDP
// print pipeline only fulfils orders placed on Amazon — it cannot ship a
// book ordered on this site. So a print format is a *link out*, never an
// add-to-cart, and the data model has to say which is which rather than
// leaving it to whoever writes the button label.
export const fulfillmentChannelEnum = pgEnum("fulfillment_channel", [
  // Sold here: Paddle checkout → entitlement → watermarked download.
  "direct",
  // Sold on Amazon: we link to the product page and Amazon does the rest.
  "amazon",
]);

export const formatAvailabilityEnum = pgEnum("format_availability", [
  // Buyable now (direct) or linkable now (amazon).
  "available",
  // Edition exists and is intended, but is not purchasable yet. Renders as
  // a stated future edition, never as a buy button.
  "coming_soon",
  // Deliberately not offered in this format.
  "unavailable",
]);

/**
 * Where a free-ebook request has got to.
 *
 * `duplicate` is a real outcome, not an error: the same person asking twice
 * for the same book is the commonest honest case (a lost email, a second
 * device) and it must be visible to whoever fulfils rather than silently
 * merged. `flagged` is for volume that looks automated — it never blocks a
 * person by itself, it only sorts them to the top of the operator's list.
 */
export const freeBookRequestStatusEnum = pgEnum("free_book_request_status", [
  "pending",
  /**
   * A send is in flight, claimed by exactly one operator click.
   *
   * This is the double-send guard, and it is a *state* rather than a flag
   * because the guard has to be atomic: the fulfilment action moves the row
   * `pending → sending` with a conditional UPDATE, and a second click loses
   * that race and is told so. A boolean set after a read would not survive
   * two tabs, a retry, or a refresh mid-send. The row is left here only if
   * the process dies between claiming and reporting, which is exactly the
   * case an operator needs to see rather than have hidden.
   */
  "sending",
  "fulfilled",
  "failed",
  "duplicate",
  "flagged",
]);

/**
 * What the reader's access layer decided, and why.
 *
 * This is a SECURITY trail, not an analytics one. It exists to answer four
 * questions that nothing else in the schema can: did this person get in, did
 * someone try a book they do not own, is one account walking the catalogue,
 * and when did a legitimate owner last open their copy. Every value below is
 * written by `src/lib/db/queries/reader-audit.ts` and by nothing else.
 *
 * `reader_opened` is deliberately the ONLY success value. The asset route is
 * hit once per pdf.js range request — dozens of times for one reading session
 * — and logging those would bury the denials this table exists to surface.
 */
export const readerAccessOutcomeEnum = pgEnum("reader_access_outcome", [
  /** An entitled owner opened the reader. One row per reader page load. */
  "reader_opened",
  /** No session at all. The proxy gate answered before any database read. */
  "denied_unauthenticated",
  /** Signed in, but holds no entitlement for the requested book. */
  "denied_not_owned",
  /** Owns it, but the entitlement is `pending` or `revoked`. */
  "denied_not_ready",
  /** The requested book id was not a uuid — tampering, not a typo. */
  "denied_malformed",
  /** The artifact could not be streamed (missing key, storage error). */
  "asset_unavailable",
]);

/**
 * Whether this press may send this person marketing email.
 *
 * FOUR VALUES, AND THE DEFAULT IS NOT "YES". This project already holds a
 * thousand-odd addresses gathered by outreach — podcast hosts, reviewers,
 * teachers written to about a specific book. Having someone's address is not
 * permission to add them to a mailing list, and the cheapest way to keep that
 * line is to make the schema unable to lose it: an imported contact arrives as
 * `unknown` or `not_marketing_contact`, and only a person's own act — a
 * ticked box, a submitted form — writes `opted_in` with the evidence beside
 * it in `consent_source`.
 *
 * `not_marketing_contact` is distinct from `opted_out` on purpose. Opted out
 * means they were asked and said no; not-a-marketing-contact means they were
 * never a candidate — a press enquiry, a rights holder, a supplier. Collapsing
 * the two would make a future "re-ask the people who said no" campaign mail
 * people who were never asked at all.
 */
export const marketingConsentEnum = pgEnum("marketing_consent", [
  "opted_in",
  "opted_out",
  "unknown",
  "not_marketing_contact",
]);

/** What a visitor did with the newsletter popup. Recorded once, never reset. */
export const popupOutcomeEnum = pgEnum("popup_outcome", [
  /** Rendered. Nothing else happened — they scrolled on, or left. */
  "shown",
  /** They pressed the close control, or Escape, or the backdrop. */
  "dismissed",
  /** They gave an address and it was accepted. */
  "submitted",
]);

// -----------------------------------------------------------------------------
// users
// -----------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  authProvider: text("auth_provider"),
  locale: varchar("locale", { length: 8 }).notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// -----------------------------------------------------------------------------
// books
//   - `search_tsv` is a STORED generated column (title weighted A,
//     description weighted B). It is queried with `@@ to_tsquery(...)` and
//     served by `books_search_gin_idx` (GIN).
// -----------------------------------------------------------------------------
export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    language: varchar("language", { length: 8 }).notNull().default("en"),
    priceCents: integer("price_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    coverKey: text("cover_key"),
    sampleKey: text("sample_key"),
    masterFileKey: text("master_file_key"),
    /**
     * Private R2 key of the EPUB master, when the edition has one.
     *
     * A second delivered artifact, not a second product: one purchase entitles
     * the buyer to every file this column and `master_file_key` name. NULL
     * means the edition has no EPUB, and the storefront must then say nothing
     * about EPUB — the Dudeney Paddle description once promised one the
     * fulfillment worker had no way to deliver, which is the defect this
     * column exists to make impossible.
     */
    epubFileKey: text("epub_file_key"),
    pageCount: integer("page_count"),
    isbn: varchar("isbn", { length: 32 }),
    /**
     * Paddle catalog `priceId` (e.g. `pri_01abc…`). Populated by the admin
     * after registering the book as a non-catalog item in Paddle's
     * dashboard or via the Paddle API. Nullable so a book can exist in
     * draft before its Paddle price is set up; checkout fails fast if
     * any cart item lacks this value.
     */
    paddlePriceId: text("paddle_price_id"),
    /**
     * The ACTIVE payment provider's id for the thing being sold — a Lemon
     * Squeezy **variant** id today, whatever the next provider calls it after
     * that. Deliberately named for its role rather than for the provider, so
     * the next migration does not add a third column beside the first two.
     *
     * `paddle_price_id` above is now history: it is read by nothing that takes
     * money, kept because orders placed through Paddle reference it and an
     * accounting question about one of them has to be answerable.
     */
    providerPriceId: text("provider_price_id"),
    status: bookStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')`,
    ),
  },
  (t) => [
    uniqueIndex("books_slug_uk").on(t.slug),
    index("books_status_published_at_idx").on(t.status, t.publishedAt),
    index("books_search_gin_idx").using("gin", t.searchTsv),
  ],
);

// -----------------------------------------------------------------------------
// book_formats — the editions a title is sold in, and by whom
//
// A book row carries the *work*: title, description, cover, canonical
// direct-sale price. A format row carries one *edition* of it: what it
// costs in that edition, whether it can be bought at all, and — critically
// — whether buying it happens here or on Amazon.
//
// `amazonAsin` / `amazonUrl` are nullable and must stay that way. A print
// edition that has been typeset but not yet uploaded to KDP has no ASIN,
// and inventing one produces a dead "Buy on Amazon" button. Availability
// is what decides whether a CTA renders; the identifiers only decide where
// it points.
// -----------------------------------------------------------------------------
export const bookFormats = pgTable(
  "book_formats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    format: bookFormatEnum("format").notNull(),
    availability: formatAvailabilityEnum("availability")
      .notNull()
      .default("coming_soon"),
    fulfillment: fulfillmentChannelEnum("fulfillment").notNull(),
    /**
     * Price in minor units. NULL means "not established yet" and renders as
     * no price at all — distinct from a zero price. Most print prices are
     * modelled from KDP's cost tables rather than confirmed on a live
     * listing, so a null here is honest and a guess is not.
     */
    priceCents: integer("price_cents"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    /** Amazon identifiers — only ever set once the edition is actually live. */
    amazonAsin: varchar("amazon_asin", { length: 16 }),
    amazonUrl: text("amazon_url"),
    /** Per-edition physical facts; page counts differ between editions. */
    pageCount: integer("page_count"),
    isbn: varchar("isbn", { length: 32 }),
    /**
     * Private R2 key of the master file for a `direct` ebook. The
     * fulfillment worker watermarks this per order. NULL for every
     * Amazon-fulfilled format — we hold no file for those.
     */
    masterFileKey: text("master_file_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // One row per format per book. Re-running the catalog loader must
    // update an edition, never duplicate it.
    uniqueIndex("book_formats_book_format_uk").on(t.bookId, t.format),
    index("book_formats_book_idx").on(t.bookId),
  ],
);

// -----------------------------------------------------------------------------
// authors
// -----------------------------------------------------------------------------
export const authors = pgTable("authors", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// -----------------------------------------------------------------------------
// categories
// -----------------------------------------------------------------------------
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  name: text("name").notNull(),
  // Editorial hub copy for /categories/[slug] (taxonomy enrichment). Nullable
  // + additive; the column is already live in prod (0003 applied directly —
  // see docs/seo/08). The page renders it only when present.
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// -----------------------------------------------------------------------------
// book_authors (M:N)  ·  `position` preserves co-author ordering.
// -----------------------------------------------------------------------------
export const bookAuthors = pgTable(
  "book_authors",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.authorId] })],
);

// -----------------------------------------------------------------------------
// book_categories (M:N)
// -----------------------------------------------------------------------------
export const bookCategories = pgTable(
  "book_categories",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.categoryId] })],
);

// -----------------------------------------------------------------------------
// orders  ·  `mor_order_ref` is the idempotency key from the MoR webhook.
// -----------------------------------------------------------------------------
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /**
     * The provider's order/transaction reference. UNIQUE — this is the
     * idempotency primitive the whole fulfilment path rests on. Values are
     * Paddle `txn_…` strings before 2026-09-13 and Lemon Squeezy numeric order
     * ids after it; `payment_provider` says which, so the two namespaces can
     * never be confused for one another.
     */
    morOrderRef: text("mor_order_ref").notNull(),
    paymentProvider: paymentProviderEnum("payment_provider")
      .notNull()
      .default("paddle"),
    totalCents: integer("total_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    taxCents: integer("tax_cents").notNull().default(0),
    status: orderStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_mor_order_ref_uk").on(t.morOrderRef),
    index("orders_user_created_at_idx").on(t.userId, t.createdAt),
  ],
);

// -----------------------------------------------------------------------------
// order_items
// -----------------------------------------------------------------------------
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    priceCentsAtPurchase: integer("price_cents_at_purchase").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// -----------------------------------------------------------------------------
// entitlements  ·  unique (user_id, book_id) — one perpetual grant per book.
// -----------------------------------------------------------------------------
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    status: entitlementStatusEnum("status").notNull().default("pending"),
    watermarkedKey: text("watermarked_key"),
    /**
     * Per-order watermarked EPUB, when the book has an EPUB master.
     *
     * Deliberately separate from `status`: the entitlement becomes `ready` on
     * the PDF alone. An EPUB that failed to build must not hold a paid book
     * hostage — the buyer gets the PDF and the EPUB button simply does not
     * appear, which is a smaller failure than a library that says "still
     * preparing" forever.
     */
    epubKey: text("epub_key"),
    // Phase 2.B — independent reading lifecycle. Defaults to
    // "not_started" so existing entitlements are non-destructively
    // backfilled by the migration.
    readStatus: readStatusEnum("read_status").notNull().default("not_started"),
    // Phase 2.B — set by the `downloadBook` action on every successful
    // signed-URL mint. Powers the "Downloaded" library tab without a
    // JOIN against download_logs.
    lastDownloadedAt: timestamp("last_downloaded_at", { withTimezone: true }),
    /**
     * When this owner last OPENED the reader, as distinct from last
     * downloading the file.
     *
     * Support needs one field that answers "has this person ever actually got
     * in", and neither of the two nearby columns does: `last_downloaded_at`
     * stays null for a customer who only ever reads online, and
     * `reading_progress.updated_at` only moves once a page is turned, so a
     * reader who opens the book and closes it leaves no trace at all. Written
     * on every reader page load, best-effort — a failed write here must never
     * cost the customer their book.
     */
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("entitlements_user_book_uk").on(t.userId, t.bookId),
    index("entitlements_user_status_idx").on(t.userId, t.status),
    index("entitlements_user_read_status_idx").on(t.userId, t.readStatus),
    index("entitlements_order_idx").on(t.orderId),
  ],
);

// -----------------------------------------------------------------------------
// watermark_jobs  ·  drives the async fulfillment pipeline (ADR-3).
// -----------------------------------------------------------------------------
export const watermarkJobs = pgTable(
  "watermark_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    status: watermarkJobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    artifactKey: text("artifact_key"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("watermark_jobs_entitlement_idx").on(t.entitlementId),
    index("watermark_jobs_status_updated_idx").on(t.status, t.updatedAt),
  ],
);

// -----------------------------------------------------------------------------
// reading_progress  ·  one row per (user, book).
// -----------------------------------------------------------------------------
export const readingProgress = pgTable(
  "reading_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    page: integer("page").notNull().default(0),
    percent: real("percent").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("reading_progress_user_book_uk").on(t.userId, t.bookId)],
);

// -----------------------------------------------------------------------------
// bookmarks  ·  one row per (user, book, page).
//
// Server-side by design. The reference reader this one is modelled on keeps
// bookmarks in `localStorage`, which is the right call for a single-file web
// book and the wrong one for a purchased edition: a bookmark that lives in one
// browser is lost when the customer reads on their phone, and a customer who
// paid for a book reasonably expects the place they marked in it to survive a
// cleared cache. UNIQUE (user_id, book_id, page) makes "mark this page" an
// idempotent toggle rather than a source of duplicates.
//
// Isolation is structural, exactly as in `reading_progress`: every write
// carries the caller's own authenticated `user_id`, so one reader can neither
// see nor overwrite another's marks.
// -----------------------------------------------------------------------------
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    /** 1-indexed page of the edition, matching `reading_progress.page`. */
    page: integer("page").notNull(),
    /**
     * A short label the reader may set. Nullable, and it is nullable rather
     * than defaulted because "the page itself is the label" is the common
     * case; an empty string would print as an empty row in the drawer.
     */
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bookmarks_user_book_page_uk").on(t.userId, t.bookId, t.page),
    index("bookmarks_user_book_idx").on(t.userId, t.bookId),
  ],
);

// -----------------------------------------------------------------------------
// reader_access_events  ·  append-only security trail for the private reader.
//
// Separate from `commerce_events` on purpose. That table records what the
// merchant of record told us; this one records what our own authorization
// layer decided. Mixing them would mean a refund and a failed book-id probe
// sat in the same stream, and the two are read by different people for
// different reasons.
//
// PRIVACY (§61, data minimisation): this table holds no IP address, no user
// agent, no URL and no email. A denial is identified by the local user id when
// there is a session and by nothing at all when there is not — which is
// sufficient for the two questions it must answer (is one ACCOUNT probing the
// catalogue, and did this customer's access actually fail) and insufficient
// for building a reading history of a named person.
// -----------------------------------------------------------------------------
export const readerAccessEvents = pgTable(
  "reader_access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outcome: readerAccessOutcomeEnum("outcome").notNull(),
    /** Null for an unauthenticated request — there is no one to name. */
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /**
     * Deliberately NOT a foreign key. A tampered or enumerated book id is
     * precisely the value worth keeping, and an FK would reject the row and
     * throw away the evidence. Stored as text for the same reason: a probe
     * may not be a uuid at all.
     */
    bookRef: text("book_ref"),
    /** Short machine-readable reason. Never a stack trace, never a key. */
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // "What has been denied lately" — the operator's first question.
    index("reader_access_events_outcome_created_idx").on(
      t.outcome,
      t.createdAt,
    ),
    // "Is this one account walking the catalogue" — the enumeration check.
    index("reader_access_events_user_created_idx").on(t.userId, t.createdAt),
  ],
);

// -----------------------------------------------------------------------------
// reviews
// -----------------------------------------------------------------------------
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    body: text("body"),
    status: reviewStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_user_book_uk").on(t.userId, t.bookId),
    index("reviews_book_status_idx").on(t.bookId, t.status),
  ],
);

// -----------------------------------------------------------------------------
// download_logs  ·  abuse-detection trail (§11 — velocity checks).
// -----------------------------------------------------------------------------
export const downloadLogs = pgTable(
  "download_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("download_logs_entitlement_idx").on(t.entitlementId),
    index("download_logs_entitlement_created_idx").on(
      t.entitlementId,
      t.createdAt,
    ),
  ],
);

// -----------------------------------------------------------------------------
// commerce_events  ·  append-only audit trail of MoR lifecycle transitions
// (Phase F — commerce safety & operability). Every paid / payment_failed /
// refunded / chargeback / revoked transition is recorded here so that a
// purchased book's history is VISIBLE, AUDITABLE and RECOVERABLE. Rows are
// never mutated. `provider_event_id` (Paddle `evt_…`) is UNIQUE so a
// re-delivered webhook produces exactly one audit row (idempotency). FK
// columns are nullable + `set null` on delete so the audit trail survives
// even if a referenced row is ever removed (orders/entitlements are
// `restrict` elsewhere, so in practice they are not).
// -----------------------------------------------------------------------------
export const commerceEvents = pgTable(
  "commerce_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: commerceEventTypeEnum("type").notNull(),
    // Which merchant of record the event came from. Without it a
    // `provider_event_id` is only unique by luck: two providers are free to
    // mint the same order number, and the UNIQUE index below would then
    // silently swallow the second one's event as a duplicate of the first.
    provider: paymentProviderEnum("provider").notNull().default("paddle"),
    // Paddle event id (`evt_…`) — UNIQUE → idempotent webhook re-delivery.
    providerEventId: text("provider_event_id"),
    // Paddle transaction id (`txn_…`) the event concerns; mirrors
    // `orders.mor_order_ref` (present even when no order row exists, e.g.
    // a failed payment attempt).
    morOrderRef: text("mor_order_ref"),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    entitlementId: uuid("entitlement_id").references(() => entitlements.id, {
      onDelete: "set null",
    }),
    // Short human-readable reason/summary (Paddle adjustment action, decline
    // reason, support note, …). Never PII beyond what the watermark allows.
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("commerce_events_provider_event_uk").on(t.providerEventId),
    index("commerce_events_order_idx").on(t.orderId),
    index("commerce_events_ref_idx").on(t.morOrderRef),
    index("commerce_events_type_created_idx").on(t.type, t.createdAt),
  ],
);

// -----------------------------------------------------------------------------
// analytics_events — first-party, PII-free funnel events.
//
// WHY THIS EXISTS: the project runs on Vercel's Hobby plan, where Web
// Analytics custom events (`track()` in src/lib/analytics.ts) are silently
// dropped. Every `view_item`, `add_to_cart`, `begin_checkout`, `sample_read`
// and `purchase` fired since launch was recorded nowhere. This table is the
// sink: the client beacons to /api/events, the fulfillment worker writes
// `purchase` server-side, and the admin reads counts per event per day.
//
// What it never holds: user ids, emails, IPs, user agents, full URLs with
// query strings, or raw search text. `props` is a small JSON of slugs,
// counts, cents and currency codes, validated at the API boundary.
// -----------------------------------------------------------------------------
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event: text("event").notNull(),
    props: jsonb("props").$type<Record<string, string | number | boolean | null>>(),
    /** Path only, no query string. */
    path: text("path"),
    /** Referrer host only, never the full referrer. */
    referrerHost: text("referrer_host"),
    bookSlug: text("book_slug"),
    /** "client" (beacon) or "server" (fulfillment). */
    source: text("source").notNull().default("client"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("analytics_events_event_created_idx").on(t.event, t.createdAt),
    index("analytics_events_book_idx").on(t.bookSlug),
  ],
);

// -----------------------------------------------------------------------------
// free_book_requests — the temporary "request an ebook free" promotion
//
// This table is a QUEUE, not an entitlement. A row here means "someone asked";
// it grants nothing on its own, and nothing in the delivery path reads it as
// permission. Fulfilment is an operator action that mints a short-lived signed
// R2 URL, so a row can never become a standing right to a file.
//
// WHAT IS DELIBERATELY NOT HERE: any column about Amazon reviews. No
// `reviewUrl`, no `reviewVerified`, no `reviewedAt`. Amazon permits giving a
// book away and permits asking for an honest review; it forbids requiring one
// or conditioning anything on it. The cheapest way to keep that line is to
// have nowhere to write the answer down — a schema with a `reviewVerified`
// column is one product decision away from gating on it.
//
// `email` is stored lowercased and trimmed so "A@b.com" and "a@b.com " are one
// person for duplicate detection. `ipHash` is a salted hash, never an address:
// enough to notice a hundred requests from one source, not enough to be a
// location record for everyone who wanted a book.
// -----------------------------------------------------------------------------
export const freeBookRequests = pgTable(
  "free_book_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lowercased, trimmed. The person to deliver to. */
    email: varchar("email", { length: 254 }).notNull(),
    /**
     * The book, resolved server-side from the slug the form posted.
     *
     * Both the id AND the slug/title are stored. The id is the join; the slug
     * and title are a snapshot, so a request stays readable after a book is
     * renamed or unpublished and the operator can still tell what was asked
     * for. `onDelete: "set null"` rather than cascade for the same reason —
     * deleting a book must not erase the record that someone wanted it.
     */
    bookId: uuid("book_id").references(() => books.id, { onDelete: "set null" }),
    bookSlug: varchar("book_slug", { length: 200 }).notNull(),
    bookTitle: text("book_title").notNull(),
    /** Which edition was asked for. Today always "PDF"; recorded, not assumed. */
    format: varchar("format", { length: 16 }).notNull().default("PDF"),
    /** The visitor's optional note. Plain text; never rendered as HTML. */
    message: text("message"),
    status: freeBookRequestStatusEnum("status").notNull().default("pending"),
    /**
     * Whether they ticked "email me about new books".
     *
     * Default false and separate from the request itself: asking for a book is
     * not consent to a mailing list, and the row records which one they
     * actually agreed to.
     */
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    /**
     * The secure first-party download, for books too large to attach.
     *
     * WHY A STORED TOKEN AND NOT A SIGNED JWT
     * A self-describing token cannot be revoked, cannot be counted, and grows
     * with everything you put in it. A random 256-bit string that means
     * nothing on its own and is looked up here can be expired early, audited,
     * and carries no information at all if it leaks from a mail archive — it
     * is a claim check, not a document.
     *
     * The token NEVER contains the email address, the book, the bucket or the
     * key. All of those are found by looking the row up. That also makes path
     * traversal structurally impossible: the URL cannot name a file, only a
     * request that already exists.
     */
    downloadToken: varchar("download_token", { length: 64 }).unique(),
    downloadExpiresAt: timestamp("download_expires_at", { withTimezone: true }),
    /** How many times the link was used. Abuse signal, and a delivery receipt. */
    downloadCount: integer("download_count").notNull().default(0),
    firstDownloadedAt: timestamp("first_downloaded_at", { withTimezone: true }),
    lastDownloadedAt: timestamp("last_downloaded_at", { withTimezone: true }),
    /** Salted hash of the request IP. Never the address itself. */
    ipHash: varchar("ip_hash", { length: 64 }),
    /** Operator notes and delivery failures — internal only. */
    notes: text("notes"),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The operator's list is "newest first, filtered by status".
    index("free_book_requests_status_created_idx").on(t.status, t.createdAt),
    // Duplicate detection and per-email history both look up by email.
    index("free_book_requests_email_idx").on(t.email),
    index("free_book_requests_email_book_idx").on(t.email, t.bookSlug),
  ],
);

// =============================================================================
// Relations (Drizzle's relational query API)
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  entitlements: many(entitlements),
  readingProgress: many(readingProgress),
  bookmarks: many(bookmarks),
  reviews: many(reviews),
}));

export const booksRelations = relations(books, ({ many }) => ({
  formats: many(bookFormats),
  orderItems: many(orderItems),
  entitlements: many(entitlements),
  readingProgress: many(readingProgress),
  bookmarks: many(bookmarks),
  reviews: many(reviews),
  bookAuthors: many(bookAuthors),
  bookCategories: many(bookCategories),
}));

export const freeBookRequestsRelations = relations(freeBookRequests, ({ one }) => ({
  book: one(books, {
    fields: [freeBookRequests.bookId],
    references: [books.id],
  }),
}));

export const bookFormatsRelations = relations(bookFormats, ({ one }) => ({
  book: one(books, {
    fields: [bookFormats.bookId],
    references: [books.id],
  }),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  bookAuthors: many(bookAuthors),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  bookCategories: many(bookCategories),
}));

export const bookAuthorsRelations = relations(bookAuthors, ({ one }) => ({
  book: one(books, {
    fields: [bookAuthors.bookId],
    references: [books.id],
  }),
  author: one(authors, {
    fields: [bookAuthors.authorId],
    references: [authors.id],
  }),
}));

export const bookCategoriesRelations = relations(bookCategories, ({ one }) => ({
  book: one(books, {
    fields: [bookCategories.bookId],
    references: [books.id],
  }),
  category: one(categories, {
    fields: [bookCategories.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  entitlements: many(entitlements),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  book: one(books, { fields: [orderItems.bookId], references: [books.id] }),
}));

export const entitlementsRelations = relations(
  entitlements,
  ({ one, many }) => ({
    user: one(users, {
      fields: [entitlements.userId],
      references: [users.id],
    }),
    book: one(books, {
      fields: [entitlements.bookId],
      references: [books.id],
    }),
    order: one(orders, {
      fields: [entitlements.orderId],
      references: [orders.id],
    }),
    watermarkJobs: many(watermarkJobs),
    downloadLogs: many(downloadLogs),
  }),
);

export const watermarkJobsRelations = relations(watermarkJobs, ({ one }) => ({
  entitlement: one(entitlements, {
    fields: [watermarkJobs.entitlementId],
    references: [entitlements.id],
  }),
}));

export const readingProgressRelations = relations(readingProgress, ({ one }) => ({
  user: one(users, {
    fields: [readingProgress.userId],
    references: [users.id],
  }),
  book: one(books, {
    fields: [readingProgress.bookId],
    references: [books.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  book: one(books, { fields: [bookmarks.bookId], references: [books.id] }),
}));

export const readerAccessEventsRelations = relations(
  readerAccessEvents,
  ({ one }) => ({
    user: one(users, {
      fields: [readerAccessEvents.userId],
      references: [users.id],
    }),
  }),
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  book: one(books, { fields: [reviews.bookId], references: [books.id] }),
}));

export const downloadLogsRelations = relations(downloadLogs, ({ one }) => ({
  entitlement: one(entitlements, {
    fields: [downloadLogs.entitlementId],
    references: [entitlements.id],
  }),
}));

// -----------------------------------------------------------------------------
// contacts — every email address this press holds, and on what footing
//
// ONE ROW PER PERSON, NOT PER LIST. The press has gathered addresses five
// different ways — the website's newsletter form, the free-PDF queue, ARC
// recipients, creator outreach, and people who bought something — and before
// this table there was no single place that could answer "do we know this
// person, and may we write to them". Resend held the subscribers; a markdown
// file under MARKETING/ held the outreach; the orders table held the buyers;
// none of them knew about the others.
//
// THE CONSENT COLUMN IS THE POINT. `marketingConsent` defaults to `unknown`,
// and an import may only ever write `unknown` or `not_marketing_contact`.
// Nothing in this codebase turns a historical contact into a subscriber: the
// only writer of `opted_in` is a person submitting a form that said what they
// were agreeing to, and `consentSource` records which form and when.
//
// `email` is stored NORMALIZED (trimmed, lowercased) and is the unique key, so
// "A@B.com " and "a@b.com" are one person. `emailRaw` keeps the first spelling
// seen, because an address is also how someone writes their own name.
// -----------------------------------------------------------------------------
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Trimmed, lowercased. The identity of the row. */
    email: varchar("email", { length: 254 }).notNull(),
    /** The address exactly as it was first given to us. */
    emailRaw: varchar("email_raw", { length: 254 }),
    name: text("name"),
    /**
     * Where this address came from, coarse enough to be a filter:
     * "newsletter", "free-book", "arc", "outreach", "customer", "import".
     */
    source: varchar("source", { length: 40 }).notNull(),
    /**
     * The specific origin inside that source — a form id, a campaign, a
     * cycle number, a filename. Kept because provenance is the only thing
     * that makes a consent decision auditable a year later.
     */
    sourceDetail: text("source_detail"),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    /** Has this person ever bought anything. Derived, refreshed by the importer. */
    purchased: boolean("purchased").notNull().default(false),
    purchaseCount: integer("purchase_count").notNull().default(0),
    /** "prospect" | "customer" | "reviewer" | "partner" — free-form, filterable. */
    customerStatus: varchar("customer_status", { length: 32 }).notNull().default("prospect"),
    marketingConsent: marketingConsentEnum("marketing_consent").notNull().default("unknown"),
    /**
     * What produced the consent state. For `opted_in` this is the form and
     * the page ("popup:/companion/world-games"); for an import it names the
     * file and the line. Never blank on an `opted_in` row — the admin view
     * shows it beside the state precisely so an unsupported opt-in is visible.
     */
    consentSource: text("consent_source"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    /**
     * Separate from consent, and deliberately so. Consent is what they chose;
     * this is whether a suppression is in force. An unsubscribe sets BOTH —
     * but a bounce or a complaint sets only this, and must still stop the send.
     */
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    /** Operator notes. Internal; never rendered to the contact. */
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("contacts_email_uk").on(t.email),
    index("contacts_consent_idx").on(t.marketingConsent),
    index("contacts_source_idx").on(t.source),
    index("contacts_customer_idx").on(t.purchased),
  ],
);

// -----------------------------------------------------------------------------
// popup_impressions — the newsletter popup's "once per person, site-wide" memory
//
// THE REQUIREMENT IS GLOBAL, SO THE STATE CANNOT BE PAGE-LOCAL. Someone who
// sees the popup on the homepage and then opens ten companion pages must not
// see it eleven times. A cookie alone gets that right within one browser and
// wrong everywhere else — a second device, a cleared cookie jar, a signed-in
// reader on their phone — so the cookie is the fast path and this table is the
// durable one.
//
// THREE IDENTITIES, IN PRIORITY ORDER, matching how much we actually know:
//   userId    — a signed-in reader. Follows them across devices.
//   contactId — a known subscriber, resolved from a submitted address.
//   visitorId — an opaque first-party id from the `vp_vid` cookie. No IP, no
//               fingerprint, no third party; it identifies a browser and
//               nothing about a person.
//
// WHAT IS NOT HERE: no IP address, no user agent, no referrer, no page beyond
// the path the popup fired on. A lead-capture table is not a surveillance log.
// -----------------------------------------------------------------------------
export const popupImpressions = pgTable(
  "popup_impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which popup. There is one today; there will be an exit-intent one. */
    popup: varchar("popup", { length: 40 }).notNull().default("newsletter"),
    /** Opaque first-party browser id. Present on every row. */
    visitorId: varchar("visitor_id", { length: 64 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    outcome: popupOutcomeEnum("outcome").notNull().default("shown"),
    /** Pathname only — where it fired. No query string, ever. */
    sourcePath: text("source_path"),
    shownAt: timestamp("shown_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    // The question asked on every page load is "has this browser seen it",
    // so that lookup is a unique index rather than a scan — which also makes
    // a double-insert from two tabs impossible.
    uniqueIndex("popup_impressions_visitor_uk").on(t.popup, t.visitorId),
    index("popup_impressions_user_idx").on(t.popup, t.userId),
  ],
);
