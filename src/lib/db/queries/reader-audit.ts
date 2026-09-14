/**
 * The reader's security trail (Directive §34).
 *
 * One writer, one table, one rule: **a failure to log must never become a
 * failure to serve**. Every function here swallows its own errors, because the
 * alternative is a customer who paid for a book being shown an error page
 * because an audit INSERT timed out. The trail is for the operator; the book
 * is for the reader, and the reader wins.
 *
 * WHAT IS AND IS NOT RECORDED
 * ---------------------------
 * Recorded: the decision, the local user id when there was a session, the book
 * reference as the caller supplied it, and a short machine-readable reason.
 *
 * Not recorded, deliberately (Directive §34, §61): IP addresses, user agents,
 * signed URLs, storage keys, session cookies, emails, or the bytes of the
 * request. An entry here can tell an operator that one account was refused
 * eleven books in a minute. It cannot be used to reconstruct what a named
 * person reads, and that asymmetry is the design.
 *
 * SUCCESS IS LOGGED ONCE PER OPENING, NOT PER BYTE. `reader_opened` is written
 * by the reader page. The asset proxy is hit once per pdf.js range request —
 * a hundred times for one long book — and logging those would bury the
 * denials this table exists to surface. A served range is invisible here by
 * design; what proves an owner read their book is `entitlements.last_read_at`
 * and `reading_progress`, both of which this module also touches.
 */

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { entitlements, readerAccessEvents } from "@/lib/db/schema";

export type ReaderAccessOutcome =
  | "reader_opened"
  | "denied_unauthenticated"
  | "denied_not_owned"
  | "denied_not_ready"
  | "denied_malformed"
  | "asset_unavailable";

export interface RecordReaderAccessArgs {
  outcome: ReaderAccessOutcome;
  /** Local `users.id`, or null when the request carried no session. */
  userId?: string | null;
  /**
   * The book reference EXACTLY as the caller supplied it — not a normalised or
   * validated form. A probe's value is the evidence; sanitising it before
   * storage would throw away the only interesting part of the row. Truncated
   * so a megabyte of junk in the path cannot become a megabyte in the table.
   */
  bookRef?: string | null;
  detail?: string | null;
}

/** Hard cap on attacker-controlled text before it reaches the database. */
const MAX_REF_LENGTH = 200;
const MAX_DETAIL_LENGTH = 200;

function clamp(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Append one decision to the trail. Never throws, never blocks a response on
 * its own success — callers should NOT await this on the happy path where the
 * latency matters, and the deny paths are cheap enough to await.
 */
export async function recordReaderAccess(
  args: RecordReaderAccessArgs,
): Promise<void> {
  try {
    await db.insert(readerAccessEvents).values({
      outcome: args.outcome,
      userId: args.userId ?? null,
      bookRef: clamp(args.bookRef, MAX_REF_LENGTH),
      detail: clamp(args.detail, MAX_DETAIL_LENGTH),
    });
  } catch {
    // Deliberately silent. See the module header: the trail is never allowed
    // to become the reason a paid book will not open.
  }
}

/**
 * Stamp `entitlements.last_read_at` for one owner's copy.
 *
 * Ownership is in the WHERE clause rather than checked beforehand, so this is
 * a no-op UPDATE for any caller that does not own the row — it cannot be used
 * to touch someone else's entitlement even if it were called with a hostile
 * pair. Best-effort and unawaited on the reader's hot path.
 */
export async function touchLastReadAt(
  userId: string,
  bookId: string,
): Promise<void> {
  try {
    await db
      .update(entitlements)
      .set({ lastReadAt: sql`NOW()` })
      .where(
        and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId)),
      );
  } catch {
    // Same rule as above.
  }
}
