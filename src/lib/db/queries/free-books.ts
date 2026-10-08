/**
 * Free-ebook campaign — the queue's reads and writes.
 *
 * The public API of this module is deliberately narrow. Two things happen to a
 * free-book request: it gets created by an anonymous visitor, and it gets
 * looked at and fulfilled by an operator. Nothing else. There is no function
 * here that reads a request back out to the person who made it, because there
 * is no page that shows one: a request id in a URL is an enumeration hole
 * (brief §27 — "never expose another user's request"), and the confirmation a
 * visitor needs is the one they already have on screen.
 *
 * `resolveBookForRequest` is the reason the API route never trusts the client.
 * The form posts a slug; this looks up the real book and returns its real id,
 * title and price. A visitor who edits the payload gets a 404, not a book we
 * never meant to give away — and the price crossed out in the modal is the
 * price the database holds, not one the browser sent back to us.
 */

import { randomBytes } from "node:crypto";

import { and, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { bookFormats, books, freeBookRequests } from "@/lib/db/schema";

export type FreeBookRequestStatus =
  | "pending"
  /** A send is in flight — see `claimRequestForSending`. */
  | "sending"
  | "fulfilled"
  | "failed"
  | "duplicate"
  | "flagged";

/**
 * The book as the campaign needs it: enough to render the modal honestly and
 * enough to deliver the file afterwards.
 *
 * `masterFileKey` never leaves the server. It is on this shape because
 * fulfilment needs it, and every caller that renders is expected to project
 * it away — `toPublicBook` below does that in one place so no route has to
 * remember.
 */
export interface RequestableBook {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  pageCount: number | null;
  masterFileKey: string | null;
  epubFileKey: string | null;
}

/**
 * Strip the private R2 keys before anything is sent to a browser.
 *
 * An allow-list rather than a `delete` or a rest-spread exclusion: when a new
 * private column is added to `RequestableBook` later, a subtractive helper
 * silently starts leaking it and a constructive one does not compile until
 * somebody decides.
 */
export function toPublicBook(b: RequestableBook) {
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    subtitle: b.subtitle,
    description: b.description,
    priceCents: b.priceCents,
    currency: b.currency,
    pageCount: b.pageCount,
  };
}

/**
 * Look up a published book by slug.
 *
 * Only `status = 'published'` rows are returned. A draft book is not on the
 * shelf, so it cannot be the subject of a gift box, so a request naming one
 * is either a stale page or a hand-edited payload — both get the same 404.
 */
export async function resolveBookForRequest(
  slug: string,
): Promise<RequestableBook | null> {
  const rows = await db
    .select({
      id: books.id,
      slug: books.slug,
      title: books.title,
      subtitle: books.subtitle,
      description: books.description,
      priceCents: books.priceCents,
      currency: books.currency,
      pageCount: books.pageCount,
      masterFileKey: books.masterFileKey,
      epubFileKey: books.epubFileKey,
    })
    .from(books)
    .where(and(eq(books.slug, slug), eq(books.status, "published")))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * How many requests this email has made, and whether it already asked for
 * this exact book.
 *
 * Both numbers in one round trip because the API needs both on every
 * submission and a second query per request is a second chance to be slow
 * under the load a promotion is designed to create.
 *
 * `sinceMs` scopes the count to the campaign window rather than all time: a
 * reader who took two books in a promotion last year is not a suspicious
 * volume today.
 */
export async function getRequestHistory(
  email: string,
  bookSlug: string,
  sinceMs: number,
): Promise<{ total: number; sameBook: number }> {
  const since = new Date(sinceMs);
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      sameBook: sql<number>`count(*) filter (where ${freeBookRequests.bookSlug} = ${bookSlug})::int`,
    })
    .from(freeBookRequests)
    .where(
      and(eq(freeBookRequests.email, email), gte(freeBookRequests.createdAt, since)),
    );
  return { total: rows[0]?.total ?? 0, sameBook: rows[0]?.sameBook ?? 0 };
}

/** Requests from one IP hash inside a window — the automated-volume signal. */
export async function countRecentByIp(
  ipHash: string,
  sinceMs: number,
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(freeBookRequests)
    .where(
      and(
        eq(freeBookRequests.ipHash, ipHash),
        gte(freeBookRequests.createdAt, new Date(sinceMs)),
      ),
    );
  return rows[0]?.n ?? 0;
}

export interface CreateRequestInput {
  email: string;
  book: RequestableBook;
  message: string | null;
  marketingConsent: boolean;
  ipHash: string | null;
  status: FreeBookRequestStatus;
  notes?: string | null;
}

export async function createFreeBookRequest(input: CreateRequestInput) {
  const rows = await db
    .insert(freeBookRequests)
    .values({
      email: input.email,
      bookId: input.book.id,
      bookSlug: input.book.slug,
      bookTitle: input.book.title,
      format: "PDF",
      message: input.message,
      marketingConsent: input.marketingConsent,
      ipHash: input.ipHash,
      status: input.status,
      notes: input.notes ?? null,
    })
    .returning({ id: freeBookRequests.id, status: freeBookRequests.status });
  return rows[0];
}

// ---------------------------------------------------------------------------
// Operator surface
// ---------------------------------------------------------------------------

export interface AdminFreeBookRequest {
  id: string;
  email: string;
  bookSlug: string;
  bookTitle: string;
  format: string;
  message: string | null;
  status: FreeBookRequestStatus;
  marketingConsent: boolean;
  notes: string | null;
  createdAt: Date;
  fulfilledAt: Date | null;
  /** Whether a master file exists to send. Null when the book row is gone. */
  hasMaster: boolean | null;
}

export async function listFreeBookRequests(opts: {
  status?: FreeBookRequestStatus;
  limit?: number;
}): Promise<AdminFreeBookRequest[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const where = opts.status ? eq(freeBookRequests.status, opts.status) : undefined;
  return db
    .select({
      id: freeBookRequests.id,
      email: freeBookRequests.email,
      bookSlug: freeBookRequests.bookSlug,
      bookTitle: freeBookRequests.bookTitle,
      format: freeBookRequests.format,
      message: freeBookRequests.message,
      status: freeBookRequests.status,
      marketingConsent: freeBookRequests.marketingConsent,
      notes: freeBookRequests.notes,
      createdAt: freeBookRequests.createdAt,
      fulfilledAt: freeBookRequests.fulfilledAt,
      hasMaster: sql<boolean | null>`(${books.masterFileKey} is not null)`,
    })
    .from(freeBookRequests)
    .leftJoin(books, eq(freeBookRequests.bookId, books.id))
    .where(where)
    .orderBy(desc(freeBookRequests.createdAt))
    .limit(limit);
}

/**
 * The operator's queue: one status (or all), an optional search over the
 * address, the book's title and its slug, newest first, a page at a time.
 * `%` and `_` in the search are characters, not wildcards.
 */
export async function listFreeBookRequestsPage(opts: {
  status?: FreeBookRequestStatus;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminFreeBookRequest[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const needle = opts.q?.trim() ? `%${opts.q.trim().replace(/[\\%_]/g, "\\$&")}%` : null;

  const conditions = [
    opts.status ? eq(freeBookRequests.status, opts.status) : undefined,
    needle
      ? or(ilike(freeBookRequests.email, needle), ilike(freeBookRequests.bookTitle, needle), ilike(freeBookRequests.bookSlug, needle))
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: freeBookRequests.id,
        email: freeBookRequests.email,
        bookSlug: freeBookRequests.bookSlug,
        bookTitle: freeBookRequests.bookTitle,
        format: freeBookRequests.format,
        message: freeBookRequests.message,
        status: freeBookRequests.status,
        marketingConsent: freeBookRequests.marketingConsent,
        notes: freeBookRequests.notes,
        createdAt: freeBookRequests.createdAt,
        fulfilledAt: freeBookRequests.fulfilledAt,
        hasMaster: sql<boolean | null>`(${books.masterFileKey} is not null)`,
      })
      .from(freeBookRequests)
      .leftJoin(books, eq(freeBookRequests.bookId, books.id))
      .where(where)
      .orderBy(desc(freeBookRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(freeBookRequests).where(where),
  ]);
  return { rows, total: totals[0]?.n ?? 0 };
}

/** Counts by status, for the operator's summary strip. */
export async function getFreeBookRequestCounts(): Promise<
  Record<FreeBookRequestStatus | "total", number>
> {
  const rows = await db
    .select({
      status: freeBookRequests.status,
      n: sql<number>`count(*)::int`,
    })
    .from(freeBookRequests)
    .groupBy(freeBookRequests.status);
  const out = {
    pending: 0,
    sending: 0,
    fulfilled: 0,
    failed: 0,
    duplicate: 0,
    flagged: 0,
    total: 0,
  };
  for (const r of rows) {
    out[r.status as FreeBookRequestStatus] = r.n;
    out.total += r.n;
  }
  return out;
}

/**
 * The Amazon editions of one book that a reader can actually buy today.
 *
 * WHY THIS IS A QUERY AND NOT A URL TEMPLATE.
 * `https://www.amazon.com/dp/<asin>` is trivially constructible, which is
 * exactly the trap: an ASIN that is null, a listing still in KDP review, or an
 * edition that only exists in the roadmap all produce a plausible URL that
 * lands on a dead page. A dead link inside a gift is worse than no link.
 *
 * So a format is offered only when the catalog says all three things:
 *   - `availability = 'available'` — not `coming_soon`, not `unavailable`
 *   - `amazon_url IS NOT NULL`     — a URL somebody actually recorded
 *   - the ASIN is present          — the listing has an identity
 *
 * In production today that predicate is self-enforcing: every `available`
 * print format has a URL and every `coming_soon` one has none. It is written
 * out anyway, because the day those diverge is the day this matters.
 */
export interface AmazonEdition {
  format: string;
  label: string;
  url: string;
  asin: string;
}

const FORMAT_LABELS: Record<string, string> = {
  ebook: "Kindle",
  paperback: "Paperback",
  hardcover: "Hardcover",
  large_print: "Large Print",
};

/** The order a reader expects to see them in, not the order the rows come back. */
const FORMAT_ORDER = ["paperback", "hardcover", "large_print", "ebook"];

/** The rule itself, separated from the query so a test can hold it to account. */
export function selectAmazonEditions(
  rows: ReadonlyArray<{
    format: string;
    availability: string;
    asin: string | null;
    url: string | null;
  }>,
): AmazonEdition[] {
  return rows
    .filter((r) => r.availability === "available" && !!r.url && !!r.asin)
    .map((r) => ({
      format: r.format,
      label: FORMAT_LABELS[r.format] ?? r.format,
      url: r.url!,
      asin: r.asin!,
    }))
    .sort((a, b) => FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format));
}

export async function getAmazonEditions(bookId: string | null): Promise<AmazonEdition[]> {
  if (!bookId) return [];
  const rows = await db
    .select({
      format: bookFormats.format,
      availability: bookFormats.availability,
      asin: bookFormats.amazonAsin,
      url: bookFormats.amazonUrl,
    })
    .from(bookFormats)
    .where(eq(bookFormats.bookId, bookId));
  return selectAmazonEditions(rows);
}

/**
 * The queue, shaped for a diagnostic response.
 *
 * Deliberately narrower than the admin list: no `message`, because a
 * visitor's note to the publisher is not diagnostic data and has no business
 * in an ops payload. Email addresses stay, because an operator chasing a
 * delivery has to see who it went to.
 */
export async function listRequestsForDiagnostics(limit = 12) {
  return db
    .select({
      id: freeBookRequests.id,
      email: freeBookRequests.email,
      bookSlug: freeBookRequests.bookSlug,
      status: freeBookRequests.status,
      notes: freeBookRequests.notes,
      fulfilledAt: freeBookRequests.fulfilledAt,
      createdAt: freeBookRequests.createdAt,
    })
    .from(freeBookRequests)
    .orderBy(desc(freeBookRequests.createdAt))
    .limit(limit);
}

/**
 * How long a first-party download link lives.
 *
 * The old signed R2 link lasted fifteen minutes — right for a checkout
 * download clicked seconds after paying, wrong for a gift that may be opened
 * after a weekend. Three days covers "I saw it on Friday evening and got to
 * it on Monday", which is the realistic worst case for an unprompted email,
 * while still being short enough that a link forwarded or leaked from an
 * archive is dead long before anyone finds it.
 */
export const DOWNLOAD_TTL_HOURS = 72;

/**
 * How many times one link may be *opened* before it stops working.
 *
 * A download link is for one reader, not for a forum post. Expiry alone does
 * not say that: for 72 hours an uncapped link is a public mirror of a private
 * master, and the reader who pasted it into a group chat never finds out.
 *
 * It is not a one-shot, though, and deliberately so. This endpoint answers
 * Range requests so a 104 MB download can resume, a download manager may open
 * eight connections at once, and a mail client may fetch the link to preview
 * it. A link that died on first contact would fail the honest reader far more
 * often than the dishonest one. So the cap counts only *fresh starts* — a
 * request with no Range, or one asking from byte 0 — and sets the ceiling high
 * enough that no real reader meets it and low enough that a published link
 * stops being useful within the first few takers.
 */
export const DOWNLOAD_MAX_OPENS = 25;

/**
 * Does this request begin a new download, or continue one already in flight?
 *
 * Only the first kind is charged against `DOWNLOAD_MAX_OPENS`. A `Range` that
 * starts anywhere but byte 0 is a resume or one leg of a parallel fetch — the
 * same reader, the same book, already counted. Anything malformed is treated
 * as a fresh start, because the safe mistake here is to charge an open, not to
 * hand out an uncounted one.
 */
export function isFreshDownloadStart(range: string | null | undefined): boolean {
  if (!range) return true;
  const m = /^bytes\s*=\s*(\d+)\s*-/.exec(range.trim());
  // Not a byte range we recognise — a suffix range, a typo, another unit.
  // Count it. Erring towards charging an open costs a reader nothing (the
  // ceiling is far above real use) and erring the other way hands out an
  // uncounted download to anyone who sends a header we did not parse.
  if (!m) return true;
  return Number(m[1]) === 0;
}

/** Mint a fresh download token for one request. Replaces any previous one. */
export async function issueDownloadToken(id: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  // 32 bytes of CSPRNG, base64url. Unguessable, and meaningless on its own —
  // it names a row, not a file.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_HOURS * 3_600_000);
  await db
    .update(freeBookRequests)
    .set({ downloadToken: token, downloadExpiresAt: expiresAt, downloadCount: 0 })
    .where(eq(freeBookRequests.id, id));
  return { token, expiresAt };
}

/**
 * Resolve a download token to the one thing it is allowed to hand over.
 *
 * Returns the book's master key only when the token exists AND has not
 * expired. The caller cannot influence which file comes back: there is no
 * slug, id or path in the URL, so there is nothing to tamper with.
 */
/**
 * Is this string even shaped like one of our tokens?
 *
 * Cheap, pure, and it runs before the database does: a URL carrying dot-dot,
 * an empty segment, or a hand-typed guess is rejected without a query. It is
 * not the security boundary — 256 bits of entropy and a row lookup are — but
 * it is the reason a URL can never be read as a path, and a test can hold it.
 */
export function isWellFormedDownloadToken(token: string): boolean {
  return (
    typeof token === "string" &&
    token.length >= 32 &&
    token.length <= 64 &&
    // base64url only: no slash, no dot, no percent.
    /^[A-Za-z0-9_-]+$/.test(token)
  );
}

export async function resolveDownloadToken(token: string) {
  if (!isWellFormedDownloadToken(token)) return null;
  const rows = await db
    .select({
      id: freeBookRequests.id,
      bookSlug: freeBookRequests.bookSlug,
      bookTitle: freeBookRequests.bookTitle,
      expiresAt: freeBookRequests.downloadExpiresAt,
      downloadCount: freeBookRequests.downloadCount,
      masterFileKey: books.masterFileKey,
    })
    .from(freeBookRequests)
    .leftJoin(books, eq(freeBookRequests.bookId, books.id))
    .where(eq(freeBookRequests.downloadToken, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!row.expiresAt || row.expiresAt.getTime() < Date.now()) {
    return { ...row, expired: true as const };
  }
  return { ...row, expired: false as const };
}

/** Record a successful hand-over. Best-effort; never blocks the download. */
export async function recordDownload(id: string) {
  const now = new Date();
  await db
    .update(freeBookRequests)
    .set({
      downloadCount: sql`${freeBookRequests.downloadCount} + 1`,
      lastDownloadedAt: now,
      firstDownloadedAt: sql`coalesce(${freeBookRequests.firstDownloadedAt}, ${now})`,
    })
    .where(eq(freeBookRequests.id, id));
}

export async function markRequestStatus(
  id: string,
  status: FreeBookRequestStatus,
  notes?: string,
) {
  await db
    .update(freeBookRequests)
    .set({
      status,
      notes: notes ?? null,
      /**
       * WHEN THIS BOOK REACHED THIS PERSON — and it is not erased by a later
       * failure.
       *
       * "Send again" on a fulfilled row is a normal operator action (a reader
       * lost the mail, an attachment bounced). If that second attempt fails,
       * clearing the timestamp would delete the record that the first one
       * succeeded, and the queue would then claim the book had never been
       * delivered. So only an explicit re-queue — the operator saying "treat
       * this as undelivered" — clears it. Everything else leaves the history
       * alone.
       */
      fulfilledAt:
        status === "fulfilled" ? new Date() : status === "pending" ? null : undefined,
    })
    .where(eq(freeBookRequests.id, id));
}

/**
 * Claim a request for sending, atomically.
 *
 * THE DOUBLE-SEND GUARD, AND WHY IT IS ONE STATEMENT.
 *
 * The obvious version — read the row, check it is not already sending, then
 * write — has a window between the read and the write. Two operator tabs, a
 * retry after a slow response, or a refresh mid-send all land in that window
 * and the reader gets the book twice. The UI's `useTransition` disables the
 * button, which stops a double *click* and nothing else.
 *
 * So the check and the write are the same statement. Postgres takes a row lock
 * for the UPDATE, the `status <> 'sending'` predicate is evaluated under it,
 * and exactly one caller gets a row back. The loser is told plainly that a send
 * is already in flight rather than quietly doing nothing.
 *
 * A deliberate re-send ("Send again" on a fulfilled row) is still allowed:
 * `fulfilled` is not `sending`, so it claims cleanly. The guard is against
 * accidents, not against the operator.
 *
 * Returns null when the row does not exist or a send is already running.
 */
export async function claimRequestForSending(id: string) {
  const rows = await db
    .update(freeBookRequests)
    .set({ status: "sending", notes: null })
    .where(and(eq(freeBookRequests.id, id), ne(freeBookRequests.status, "sending")))
    .returning({ id: freeBookRequests.id, previousStatus: freeBookRequests.status });
  return rows[0] ?? null;
}

/** One request plus the private key needed to deliver it. Operator-only. */
export async function getRequestForFulfilment(id: string) {
  const rows = await db
    .select({
      id: freeBookRequests.id,
      email: freeBookRequests.email,
      bookSlug: freeBookRequests.bookSlug,
      bookTitle: freeBookRequests.bookTitle,
      message: freeBookRequests.message,
      status: freeBookRequests.status,
      bookId: freeBookRequests.bookId,
      masterFileKey: books.masterFileKey,
      bookSubtitle: books.subtitle,
      bookDescription: books.description,
    })
    .from(freeBookRequests)
    .leftJoin(books, eq(freeBookRequests.bookId, books.id))
    .where(eq(freeBookRequests.id, id))
    .limit(1);
  return rows[0] ?? null;
}
