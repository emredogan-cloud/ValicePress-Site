/**
 * What the admin dashboard may say it knows.
 *
 * Every function here begins with `await requireAdmin()` and then READS —
 * nothing in this file writes. And every function THROWS when the database
 * fails: there is no `safeQuery` here, deliberately. The dashboard this replaces
 * had one, and a database outage came back as `{ revenue: [], booksSold: 0,
 * totalUsers: 0 }` — three zeros that look exactly like a quiet day. The pages
 * wrap each call in `readStat` (`@/lib/admin/stat`), which turns a failure into
 * an "error" card and a missing table into an "unavailable" one, and leaves a
 * zero meaning zero.
 *
 * What is NOT here, because no source for it exists: page views (Vercel
 * Analytics is not connected to this database), Amazon / KDP sales, and any
 * way to tell a test-mode order from a live one (`orders` does not store it).
 * The Overview says so in words instead of inventing a figure.
 */

import { and, count, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  analyticsEvents,
  bookFormats,
  books,
  contacts,
  downloadLogs,
  orderItems,
  orders,
  popupImpressions,
  users,
} from "@/lib/db/schema";
import { PINNED_BOOK_SLUGS } from "@/lib/pinned-books";

export type BookStatus = "draft" | "published" | "archived";
export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface CatalogueOverview {
  published: number;
  drafts: number;
  archived: number;
  /** Published titles that can be bought on this site right now (priced AND wired to a checkout). */
  directSale: number;
  /** Published titles that have an AVAILABLE edition in each format. A title with two editions in one format counts once. */
  editions: { ebook: number; paperback: number; hardcover: number; large_print: number };
}

export async function getCatalogueOverview(): Promise<CatalogueOverview> {
  await requireAdmin();

  const [totals, formats] = await Promise.all([
    db
      .select({
        published: sql<number>`count(*) filter (where ${books.status} = 'published')::int`,
        drafts: sql<number>`count(*) filter (where ${books.status} = 'draft')::int`,
        archived: sql<number>`count(*) filter (where ${books.status} = 'archived')::int`,
        directSale: sql<number>`count(*) filter (where ${books.status} = 'published' and ${books.priceCents} > 0 and ${books.providerPriceId} is not null)::int`,
      })
      .from(books),
    db
      .select({ format: bookFormats.format, titles: sql<number>`count(distinct ${bookFormats.bookId})::int` })
      .from(bookFormats)
      .innerJoin(books, eq(books.id, bookFormats.bookId))
      .where(and(eq(books.status, "published"), eq(bookFormats.availability, "available")))
      .groupBy(bookFormats.format),
  ]);

  const editions = { ebook: 0, paperback: 0, hardcover: 0, large_print: 0 };
  for (const f of formats) editions[f.format] = f.titles;

  return {
    published: totals[0]?.published ?? 0,
    drafts: totals[0]?.drafts ?? 0,
    archived: totals[0]?.archived ?? 0,
    directSale: totals[0]?.directSale ?? 0,
    editions,
  };
}

export interface FeaturedBook {
  slug: string;
  /** The title, or null when the slug is pinned but no such book is in this database. */
  title: string | null;
  status: BookStatus | null;
}

/**
 * The books every shelf opens with, in order — `PINNED_BOOK_SLUGS`, looked up.
 * A pin whose book is a draft is shown as a draft (it does not appear on any
 * shelf); a pin with no row at all is shown as missing.
 */
export async function getFeaturedBooks(): Promise<FeaturedBook[]> {
  await requireAdmin();
  const rows = await db
    .select({ slug: books.slug, title: books.title, status: books.status })
    .from(books)
    .where(inArray(books.slug, [...PINNED_BOOK_SLUGS]));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return PINNED_BOOK_SLUGS.map((slug) => ({
    slug,
    title: bySlug.get(slug)?.title ?? null,
    status: bySlug.get(slug)?.status ?? null,
  }));
}

export interface AdminBookRow {
  id: string;
  slug: string;
  title: string;
  status: BookStatus;
  priceCents: number;
  currency: string;
  /** Wired to a live checkout on this site. */
  buyableHere: boolean;
  pinRank: number | null;
  publishedAt: Date | null;
  /** The AVAILABLE editions, by format. */
  editions: string[];
}

/** Every book, drafts included — read-only. The catalogue file is where books are edited. */
export async function listBooksReadOnly(): Promise<AdminBookRow[]> {
  await requireAdmin();
  const [rows, formats] = await Promise.all([
    db
      .select({
        id: books.id,
        slug: books.slug,
        title: books.title,
        status: books.status,
        priceCents: books.priceCents,
        currency: books.currency,
        providerPriceId: books.providerPriceId,
        publishedAt: books.publishedAt,
      })
      .from(books)
      .orderBy(desc(books.publishedAt), books.slug),
    db
      .select({ bookId: bookFormats.bookId, format: bookFormats.format })
      .from(bookFormats)
      .where(eq(bookFormats.availability, "available")),
  ]);
  const editionsByBook = new Map<string, string[]>();
  for (const f of formats) editionsByBook.set(f.bookId, [...(editionsByBook.get(f.bookId) ?? []), f.format]);
  const pinRank = new Map(PINNED_BOOK_SLUGS.map((slug, i) => [slug, i]));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    priceCents: r.priceCents,
    currency: r.currency,
    buyableHere: Boolean(r.providerPriceId),
    pinRank: pinRank.get(r.slug) ?? null,
    publishedAt: r.publishedAt,
    editions: (editionsByBook.get(r.id) ?? []).sort(),
  }));
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export interface LatestSignup {
  id: string;
  email: string;
  name: string | null;
  source: string;
  at: Date;
}

/** The newest people who opted in — with the evidence they did, because a signup nobody can substantiate is not one. */
export async function getLatestSignups(limit = 5): Promise<LatestSignup[]> {
  await requireAdmin();
  const rows = await db
    .select({ id: contacts.id, email: contacts.email, name: contacts.name, source: contacts.source, at: contacts.consentAt })
    .from(contacts)
    .where(and(eq(contacts.marketingConsent, "opted_in"), eq(contacts.unsubscribed, false), isNotNull(contacts.consentAt)))
    .orderBy(desc(contacts.consentAt))
    .limit(limit);
  return rows.flatMap((r) => (r.at ? [{ ...r, at: r.at }] : []));
}

// ---------------------------------------------------------------------------
// Sales — what this site's own payment webhook has recorded, and nothing else
// ---------------------------------------------------------------------------

export interface RevenueByCurrency {
  currency: string;
  netCents: number;
  grossCents: number;
  taxCents: number;
  orderCount: number;
}

export interface SalesOverview {
  /** Every order row, whatever its state. */
  totalOrders: number;
  paidOrders: number;
  revenueByCurrency: RevenueByCurrency[];
  booksSold: number;
}

export async function getSalesOverview(): Promise<SalesOverview> {
  await requireAdmin();
  const [all, revenue, sold] = await Promise.all([
    db.select({ n: count() }).from(orders),
    db
      .select({
        currency: orders.currency,
        netCents: sql<number>`COALESCE(SUM(${orders.totalCents} - ${orders.taxCents}), 0)::int`,
        grossCents: sql<number>`COALESCE(SUM(${orders.totalCents}), 0)::int`,
        taxCents: sql<number>`COALESCE(SUM(${orders.taxCents}), 0)::int`,
        orderCount: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(eq(orders.status, "paid"))
      .groupBy(orders.currency)
      .orderBy(desc(sql`COALESCE(SUM(${orders.totalCents} - ${orders.taxCents}), 0)`)),
    db
      .select({ n: sql<number>`COUNT(${orderItems.id})::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.status, "paid")),
  ]);
  return {
    totalOrders: all[0]?.n ?? 0,
    paidOrders: revenue.reduce((n, r) => n + r.orderCount, 0),
    revenueByCurrency: revenue,
    booksSold: sold[0]?.n ?? 0,
  };
}

export interface RecentOrder {
  id: string;
  morOrderRef: string;
  totalCents: number;
  taxCents: number;
  currency: string;
  status: OrderStatus;
  createdAt: Date;
  customerEmail: string;
  customerName: string | null;
  items: Array<{ bookTitle: string; bookSlug: string; priceCentsAtPurchase: number }>;
}

export async function getRecentOrders(limit = 10): Promise<RecentOrder[]> {
  await requireAdmin();
  const rows = await db.query.orders.findMany({
    orderBy: (o, { desc: d }) => d(o.createdAt),
    limit: Math.min(Math.max(limit, 1), 100),
    columns: { id: true, morOrderRef: true, totalCents: true, taxCents: true, currency: true, status: true, createdAt: true },
    with: {
      user: { columns: { email: true, name: true } },
      items: { columns: { priceCentsAtPurchase: true }, with: { book: { columns: { title: true, slug: true } } } },
    },
  });
  return rows.map((o) => ({
    id: o.id,
    morOrderRef: o.morOrderRef,
    totalCents: o.totalCents,
    taxCents: o.taxCents,
    currency: o.currency,
    status: o.status,
    createdAt: o.createdAt,
    customerEmail: o.user.email,
    customerName: o.user.name,
    items: o.items.map((i) => ({ bookTitle: i.book.title, bookSlug: i.book.slug, priceCentsAtPurchase: i.priceCentsAtPurchase })),
  }));
}

/** Signed-in accounts (Clerk-synced `users` rows). */
export async function getAccountCount(): Promise<number> {
  await requireAdmin();
  const rows = await db.select({ n: count() }).from(users);
  return rows[0]?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Site activity — only what the site itself records
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export interface EventOverview {
  days: number;
  total: number;
  byEvent: Array<{ event: string; n: number }>;
}

/** First-party funnel events (`analytics_events`): counts by name over the last N days. */
export async function getEventOverview(days = 7): Promise<EventOverview> {
  await requireAdmin();
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await db
    .select({ event: analyticsEvents.event, n: count() })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.event)
    .orderBy(desc(count()));
  return { days, total: rows.reduce((n, r) => n + r.n, 0), byEvent: rows };
}

/** Paid-download opens (`download_logs`) over the last N days. */
export async function getDownloadCount(days = 30): Promise<{ days: number; downloads: number }> {
  await requireAdmin();
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await db.select({ n: count() }).from(downloadLogs).where(gte(downloadLogs.createdAt, since));
  return { days, downloads: rows[0]?.n ?? 0 };
}

export interface PopupOverview {
  shown: number;
  dismissed: number;
  submitted: number;
}

/** The newsletter popup's outcomes, from `popup_impressions` (one row per visitor, ever). */
export async function getPopupOverview(): Promise<PopupOverview> {
  await requireAdmin();
  const rows = await db
    .select({ outcome: popupImpressions.outcome, n: count() })
    .from(popupImpressions)
    .groupBy(popupImpressions.outcome);
  const by = new Map(rows.map((r) => [r.outcome, r.n]));
  return {
    shown: rows.reduce((n, r) => n + r.n, 0),
    dismissed: by.get("dismissed") ?? 0,
    submitted: by.get("submitted") ?? 0,
  };
}
