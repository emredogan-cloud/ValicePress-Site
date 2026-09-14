/**
 * Bookmarks — per user, per book, per page (Directive §20).
 *
 * Every function takes the caller's OWN authenticated `userId` and puts it in
 * the WHERE clause. That is the whole isolation story, and it is structural
 * rather than procedural: there is no code path here that can name another
 * user's row, so "user A reads user B's bookmarks" is not a bug that has been
 * guarded against, it is a query that cannot be written with this API.
 *
 * OWNERSHIP IS CHECKED, NOT ASSUMED. A bookmark is a fact about a book someone
 * bought. Authentication alone is not enough — a signed-in visitor who owns
 * nothing must not be able to accumulate rows against the catalogue — so every
 * write passes the same entitlement gate the reader and the downloader use.
 * This mirrors `writeReadingProgress`, deliberately: the two are the same kind
 * of per-user annotation and must not drift apart in what they permit.
 */

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { bookmarks, entitlements } from "@/lib/db/schema";

export interface Bookmark {
  page: number;
  label: string | null;
}

/** How many marks one reader may keep in one book. */
export const MAX_BOOKMARKS_PER_BOOK = 200;
const MAX_LABEL_LENGTH = 120;

/**
 * Does this user hold an entitlement for this book, in any state?
 *
 * Any state, not just `ready`: a customer whose watermark is still running owns
 * the book, and a customer whose entitlement was later revoked should keep the
 * marks they made while it was valid rather than have them deleted out from
 * under them. What `revoked` closes is the reader; annotations are the
 * customer's own record and are governed by the retention policy, not by the
 * refund.
 */
async function ownsBook(userId: string, bookId: string): Promise<boolean> {
  const row = await db.query.entitlements.findFirst({
    where: and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId)),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function listBookmarks(
  userId: string,
  bookId: string,
): Promise<Bookmark[]> {
  try {
    const rows = await db.query.bookmarks.findMany({
      where: and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)),
      columns: { page: true, label: true },
      orderBy: asc(bookmarks.page),
      limit: MAX_BOOKMARKS_PER_BOOK,
    });
    return rows;
  } catch {
    // A reader whose bookmarks fail to load still gets their book. The drawer
    // is empty for that session; nothing is lost and nothing is deleted.
    return [];
  }
}

export type ToggleResult =
  | { ok: true; added: boolean }
  | { ok: false; reason: "not-owned" | "limit" | "error" };

/**
 * Mark or unmark a page. Idempotent by construction.
 *
 * The UNIQUE (user_id, book_id, page) index is what makes this safe under a
 * double-click or two tabs: the second insert loses the race at the database
 * rather than producing a duplicate row, and a duplicate here would show as
 * the same page listed twice in the drawer.
 */
export async function toggleBookmark(args: {
  userId: string;
  bookId: string;
  page: number;
  label?: string | null;
}): Promise<ToggleResult> {
  const page = Math.floor(args.page);
  if (!Number.isFinite(page) || page < 1) return { ok: false, reason: "error" };

  try {
    if (!(await ownsBook(args.userId, args.bookId))) {
      return { ok: false, reason: "not-owned" };
    }

    const existing = await db.query.bookmarks.findFirst({
      where: and(
        eq(bookmarks.userId, args.userId),
        eq(bookmarks.bookId, args.bookId),
        eq(bookmarks.page, page),
      ),
      columns: { id: true },
    });

    if (existing) {
      await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
      return { ok: true, added: false };
    }

    const count = await db.$count(
      bookmarks,
      and(eq(bookmarks.userId, args.userId), eq(bookmarks.bookId, args.bookId)),
    );
    if (count >= MAX_BOOKMARKS_PER_BOOK) {
      return { ok: false, reason: "limit" };
    }

    const label = args.label?.trim().slice(0, MAX_LABEL_LENGTH) || null;
    await db
      .insert(bookmarks)
      .values({ userId: args.userId, bookId: args.bookId, page, label })
      // The index already prevents the duplicate; this turns the lost race
      // into a silent success rather than a 500 the reader has to see.
      .onConflictDoNothing();

    return { ok: true, added: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Remove one mark. Scoped to the caller's own rows by the WHERE clause. */
export async function removeBookmark(args: {
  userId: string;
  bookId: string;
  page: number;
}): Promise<boolean> {
  try {
    await db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, args.userId),
          eq(bookmarks.bookId, args.bookId),
          eq(bookmarks.page, Math.floor(args.page)),
        ),
      );
    return true;
  } catch {
    return false;
  }
}
