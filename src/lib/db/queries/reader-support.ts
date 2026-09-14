/**
 * The support view (Directive §33, §63, §70).
 *
 * THE QUESTION THIS EXISTS TO ANSWER is one sentence long and arrives by email:
 * "I bought the book but I can't open it." Before this module the only way to
 * answer it was to open a database console and join four tables by hand, which
 * is how a support request turns into an editing session against production
 * rows — the exact thing §63 says must not be necessary.
 *
 * So: one lookup, by email, returning the whole chain in the order it can fail.
 *   • Is there an account at all?           → no row  → they bought as a guest,
 *                                                       or typed a different
 *                                                       address.
 *   • Is there an order?                    → no      → the payment never
 *                                                       reached us; check the
 *                                                       provider dashboard.
 *   • Is there an entitlement?              → no      → the webhook arrived but
 *                                                       the book did not map.
 *   • Is it `ready`?                        → no      → the watermark job; its
 *                                                       state and error are
 *                                                       right there.
 *   • Has the reader ever opened?           → dates   → distinguishes "cannot"
 *                                                       from "has not".
 *   • Were they refused, and why?           → the audit trail, last ten.
 *
 * WHAT IT REFUSES TO RETURN (§33, §37). No storage keys, no signed URLs, no
 * credentials, no session tokens, no other customer's rows, and no book
 * content. A support view that can read the book is a support view that can
 * leak the book. What it returns is state, not access — there is deliberately
 * no "open this customer's book" affordance anywhere in it, because the
 * operator does not need one to answer the question and building one would
 * create an impersonation path that nothing else in this system has.
 *
 * Every caller must pass the admin gate first; this module does not check it,
 * exactly as the other `admin.ts` queries do not, and for the same reason —
 * the gate belongs at the page, where the failure can be rendered.
 */

import { and, count, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  entitlements,
  orders,
  readerAccessEvents,
  users,
  watermarkJobs,
} from "@/lib/db/schema";
import type { ReaderAccessOutcome } from "@/lib/db/queries/reader-audit";

export interface SupportEntitlementRow {
  bookId: string;
  bookTitle: string;
  bookSlug: string;
  status: "pending" | "ready" | "revoked";
  /** Whether an artifact key is stored — NOT the key itself. */
  hasPdf: boolean;
  hasEpub: boolean;
  orderRef: string;
  orderStatus: string;
  orderedAt: Date;
  lastReadAt: Date | null;
  lastDownloadedAt: Date | null;
  progressPage: number | null;
  /** The most recent watermark attempt, when there is one. */
  job: {
    status: "queued" | "running" | "succeeded" | "failed";
    attempts: number;
    error: string | null;
    updatedAt: Date;
  } | null;
  /** The one-line reading of the whole chain, for the operator. */
  diagnosis: string;
}

export interface SupportAccessEvent {
  outcome: ReaderAccessOutcome;
  bookRef: string | null;
  detail: string | null;
  createdAt: Date;
}

export type SupportLookup =
  | { found: false; email: string }
  | {
      found: true;
      email: string;
      userId: string;
      name: string | null;
      joinedAt: Date;
      orderCount: number;
      entitlements: SupportEntitlementRow[];
      recentAccess: SupportAccessEvent[];
    };

/**
 * Turn the chain's state into the sentence the operator would have written.
 *
 * This is the whole value of the view. Anyone can read six columns; the useful
 * thing is being told which one is the problem, in the order the system fails.
 */
function diagnose(row: {
  status: string;
  hasPdf: boolean;
  orderStatus: string;
  job: SupportEntitlementRow["job"];
  lastReadAt: Date | null;
}): string {
  if (row.orderStatus === "refunded") {
    return "Refunded. Access is closed by policy — this is working as intended.";
  }
  if (row.status === "revoked") {
    return "Revoked. The reader is closed; check the commerce events for why.";
  }
  if (row.status === "pending" || !row.hasPdf) {
    if (row.job?.status === "failed") {
      return `The watermark failed after ${row.job.attempts} attempt(s). This is the problem — see the error, then re-run fulfilment.`;
    }
    if (row.job?.status === "running") {
      return "The watermark is running now. Ask them to reload their library in a minute.";
    }
    if (row.job?.status === "queued") {
      return "Queued but not started. If this is more than a few minutes old, the worker is not picking it up — check Inngest.";
    }
    return "No artifact and no watermark job. Fulfilment never ran for this book.";
  }
  if (!row.lastReadAt) {
    return "Ready and never opened. Nothing is wrong on our side — send them the library link.";
  }
  return "Ready, and they have opened it. If they still cannot read it, the problem is in their browser or session, not in the entitlement.";
}

export async function lookupReaderSupport(
  emailInput: string,
): Promise<SupportLookup> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return { found: false, email: emailInput };

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) return { found: false, email };

  const [rows, orderCount, events, positions] = await Promise.all([
    db
      .select({
        bookId: entitlements.bookId,
        status: entitlements.status,
        watermarkedKey: entitlements.watermarkedKey,
        epubKey: entitlements.epubKey,
        lastReadAt: entitlements.lastReadAt,
        lastDownloadedAt: entitlements.lastDownloadedAt,
        entitlementId: entitlements.id,
        orderRef: orders.morOrderRef,
        orderStatus: orders.status,
        orderedAt: orders.createdAt,
      })
      .from(entitlements)
      .innerJoin(orders, eq(orders.id, entitlements.orderId))
      .where(eq(entitlements.userId, user.id)),
    db.$count(orders, eq(orders.userId, user.id)),
    db.query.readerAccessEvents.findMany({
      where: eq(readerAccessEvents.userId, user.id),
      orderBy: desc(readerAccessEvents.createdAt),
      limit: 10,
      columns: { outcome: true, bookRef: true, detail: true, createdAt: true },
    }),
    db.query.readingProgress.findMany({
      where: (rp, { eq: _eq }) => _eq(rp.userId, user.id),
      columns: { bookId: true, page: true },
    }),
  ]);

  const bookIds = rows.map((r) => r.bookId);
  const books = bookIds.length
    ? await db.query.books.findMany({
        where: (b, { inArray }) => inArray(b.id, bookIds),
        columns: { id: true, title: true, slug: true },
      })
    : [];
  const bookById = new Map(books.map((b) => [b.id, b]));
  const pageByBook = new Map(positions.map((p) => [p.bookId, p.page]));

  // The latest watermark attempt per entitlement. One query per entitlement is
  // acceptable here in a way it would not be on the customer's library: this
  // page is opened by one operator, a handful of times a day, about one person.
  const jobs = await Promise.all(
    rows.map(async (r) => {
      const job = await db.query.watermarkJobs.findFirst({
        where: and(eq(watermarkJobs.entitlementId, r.entitlementId)),
        orderBy: desc(watermarkJobs.createdAt),
        columns: {
          status: true,
          attempts: true,
          error: true,
          updatedAt: true,
        },
      });
      return job ?? null;
    }),
  );

  const entitlementRows: SupportEntitlementRow[] = rows.map((r, i) => {
    const book = bookById.get(r.bookId);
    const job = jobs[i];
    const base = {
      status: r.status,
      hasPdf: Boolean(r.watermarkedKey),
      orderStatus: r.orderStatus,
      job,
      lastReadAt: r.lastReadAt,
    };
    return {
      bookId: r.bookId,
      bookTitle: book?.title ?? "(book row missing)",
      bookSlug: book?.slug ?? "",
      status: r.status,
      hasPdf: Boolean(r.watermarkedKey),
      hasEpub: Boolean(r.epubKey),
      orderRef: r.orderRef,
      orderStatus: r.orderStatus,
      orderedAt: r.orderedAt,
      lastReadAt: r.lastReadAt,
      lastDownloadedAt: r.lastDownloadedAt,
      progressPage: pageByBook.get(r.bookId) ?? null,
      job,
      diagnosis: diagnose(base),
    };
  });

  entitlementRows.sort((a, b) => b.orderedAt.getTime() - a.orderedAt.getTime());

  return {
    found: true,
    email: user.email,
    userId: user.id,
    name: user.name,
    joinedAt: user.createdAt,
    orderCount,
    entitlements: entitlementRows,
    recentAccess: events,
  };
}

// ---------------------------------------------------------------------------
// The operator's other question: is anything being probed?
// ---------------------------------------------------------------------------

export interface DenialSummaryRow {
  outcome: ReaderAccessOutcome;
  count: number;
}

/**
 * Refusals in the last 24 hours, by kind.
 *
 * A handful of `denied_not_ready` is a normal day — customers reload while a
 * watermark runs. A run of `denied_not_owned` is not normal and is the shape
 * enumeration takes here.
 */
export async function summariseRecentDenials(): Promise<DenialSummaryRow[]> {
  // 24 hours is the window an operator is actually looking at when they ask.
  // Longer and normal traffic drowns the signal; shorter and a slow probe
  // disappears between two refreshes of this page.
  const grouped = await db
    .select({
      outcome: readerAccessEvents.outcome,
      count: count(readerAccessEvents.id),
    })
    .from(readerAccessEvents)
    .where(gt(readerAccessEvents.createdAt, sql`NOW() - INTERVAL '24 hours'`))
    .groupBy(readerAccessEvents.outcome)
    .orderBy(desc(count(readerAccessEvents.id)));

  return grouped as DenialSummaryRow[];
}
