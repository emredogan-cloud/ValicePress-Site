/**
 * The one gate every private-reader surface goes through (Directive §16, §79).
 *
 * There are three doors into a purchased book — the reader page, the page-asset
 * proxy, and the progress/bookmark actions — and the directive's §79 is blunt
 * about what that means: each API boundary protects its own data, and none of
 * them may assume an earlier one checked. So all three call THIS, and none of
 * them re-implements the rule.
 *
 * THE RULE, IN ORDER
 * ------------------
 *   1. The book reference must be a uuid. Anything else is refused before a
 *      single database round trip, which is what makes `../`, a slug, a SQL
 *      fragment and a megabyte of junk all cost the attacker the same nothing.
 *   2. There must be a session. Resolved read-only, so probing this endpoint
 *      cannot create `users` rows.
 *   3. There must be an entitlement for (this user, this book), and it must be
 *      `ready` with a stored artifact. Delegated to `resolveEntitlementAccess`,
 *      the chokepoint the download action already uses, so the reader and the
 *      downloader cannot disagree about who owns what.
 *
 * WHAT THE CALLER IS TOLD, AND WHAT THE VISITOR IS TOLD
 * ----------------------------------------------------
 * The caller gets a discriminated reason so it can log precisely and, in the
 * reader page's case, show a customer whose book is still watermarking
 * something better than a 404. The VISITOR is told far less: §37 forbids
 * leaking whether a book exists or who owns it, so at the asset boundary every
 * refusal renders as the same bare 404. "You do not own this" and "there is no
 * such book" must be indistinguishable from outside.
 */

import { getCurrentLocalUserIdReadOnly } from "@/lib/account";
import type { EntitlementAccess } from "@/lib/db/queries/ownership";
import { resolveEntitlementAccess } from "@/lib/db/queries/ownership";
import type { ReaderAccessOutcome } from "@/lib/db/queries/reader-audit";

/**
 * Canonical v4-shaped uuid test.
 *
 * Deliberately stricter than "does Postgres accept it": every book id this
 * application mints comes from `gen_random_uuid()`, so a value that is not
 * that shape was not produced by us and there is no reason to ask the database
 * about it. Rejecting here is what keeps a hostile `bookId` from ever reaching
 * a query, a storage key, or a log line of any length.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBookId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type ReaderGate =
  | { ok: true; userId: string; bookId: string; access: Extract<EntitlementAccess, { state: "ready" }> }
  | {
      ok: false;
      /** Maps 1:1 onto the audit enum so the caller never invents a value. */
      outcome: Exclude<ReaderAccessOutcome, "reader_opened">;
      /** Present once we know who asked; null for an anonymous request. */
      userId: string | null;
      /** Set only when the refusal is "still being prepared", so the reader
       *  page can say so instead of pretending the book does not exist. */
      pending?: boolean;
    };

/**
 * Resolve access for one (session, book) pair.
 *
 * Performs no logging and writes nothing — the caller owns the response and
 * therefore owns the audit line, because only the caller knows which surface
 * was being asked for.
 */
export async function openReaderGate(bookRef: string): Promise<ReaderGate> {
  if (!isBookId(bookRef)) {
    return { ok: false, outcome: "denied_malformed", userId: null };
  }

  const userId = await getCurrentLocalUserIdReadOnly();
  if (!userId) {
    return { ok: false, outcome: "denied_unauthenticated", userId: null };
  }

  const access = await resolveEntitlementAccess(userId, bookRef);

  if (access.state === "not-owned") {
    return { ok: false, outcome: "denied_not_owned", userId };
  }

  if (access.state === "not-ready") {
    // `pending` and `revoked` land together here on purpose — the gate closes
    // for both — but only `pending` is a state the customer can wait out, and
    // the reader page needs to know the difference to write an honest page.
    return {
      ok: false,
      outcome: "denied_not_ready",
      userId,
      pending: access.entitlement.status === "pending",
    };
  }

  return { ok: true, userId, bookId: bookRef, access };
}
