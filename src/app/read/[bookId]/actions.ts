"use server";

import { sql } from "drizzle-orm";

import { loadAuthenticatedLocalUser } from "@/lib/account";
import { db } from "@/lib/db";
import {
  MAX_BOOKMARKS_PER_BOOK,
  removeBookmark,
  toggleBookmark,
} from "@/lib/db/queries/bookmarks";
import { readingProgress } from "@/lib/db/schema";
import { isBookId } from "@/lib/reader-access";

export interface SyncReadingProgressArgs {
  bookId: string;
  /** 1-indexed page number the user is currently viewing. */
  page: number;
  /** `(page / totalPages) * 100`, clamped to [0, 100]. */
  percent: number;
}

export interface SyncReadingProgressResult {
  ok: boolean;
}

/**
 * Idempotent reading-progress sync (Roadmap §10) — the action
 * `<ReaderShell />` calls after a 2-second debounce on page changes
 * (fire-and-forget; reading UX is never blocked on a sync).
 *
 * Thin wrapper: validate input → AuthN (`loadAuthenticatedLocalUser`) →
 * delegate to `writeReadingProgress`, which enforces the Phase E ownership
 * gate and performs the UPSERT. Never throws — a sync failure must never
 * break the reader.
 */
export async function syncReadingProgress(
  args: SyncReadingProgressArgs,
): Promise<SyncReadingProgressResult> {
  // Cheap input validation — reject malformed payloads before any IO. The
  // uuid shape check is the same one the reader gate applies: a book id that
  // was not minted by this application never reaches a query from here either.
  if (
    !isBookId(args.bookId) ||
    !Number.isInteger(args.page) ||
    args.page < 1 ||
    !Number.isFinite(args.percent)
  ) {
    return { ok: false };
  }

  const userCtx = await loadAuthenticatedLocalUser();
  if (!userCtx.ok) {
    return { ok: false };
  }

  return writeReadingProgress({
    userId: userCtx.localUserId,
    bookId: args.bookId,
    page: args.page,
    percent: args.percent,
  });
}

/**
 * Core reading-progress write. Exported so the Phase E reader/progress e2e
 * harness can drive it against the real DB without a Clerk session — the
 * `syncReadingProgress` action above is the only production caller and
 * supplies the authenticated `userId`.
 *
 * **Ownership gate (Phase E hardening):** only a user who OWNS the book — has
 * an entitlement for `(userId, bookId)`, any status — may write progress for
 * it. This path used to be AuthN-only; the gate makes progress writes
 * ownership-protected and consistent with the download / reader access rules,
 * so a non-owner can no longer create progress rows for books they don't own.
 *
 * **Isolation** is unchanged and structural: `reading_progress` has
 * UNIQUE (user_id, book_id) and we only ever write the caller's own
 * `user_id`, so one user can never read or overwrite another user's progress.
 *
 * Concurrency: INSERT ... ON CONFLICT UPDATE — the DB is the lock; two
 * simultaneous syncs converge to "last write wins". `percent` is clamped to
 * [0, 100] defensively. Never throws.
 */
export async function writeReadingProgress(args: {
  userId: string;
  bookId: string;
  page: number;
  percent: number;
}): Promise<SyncReadingProgressResult> {
  // Ownership gate — entitlement existence keyed on the UNIQUE
  // (user_id, book_id) index. A missing row means the caller does not own
  // this book, so they may not write progress for it.
  const owned = await db.query.entitlements.findFirst({
    where: (e, { and, eq }) =>
      and(eq(e.userId, args.userId), eq(e.bookId, args.bookId)),
    columns: { id: true },
  });
  if (!owned) {
    return { ok: false };
  }

  // Clamp percent defensively — never let a garbage `percent` reach the DB.
  const percent = Math.max(0, Math.min(100, args.percent));

  try {
    await db
      .insert(readingProgress)
      .values({
        userId: args.userId,
        bookId: args.bookId,
        page: args.page,
        percent,
      })
      .onConflictDoUpdate({
        target: [readingProgress.userId, readingProgress.bookId],
        // Canonical Postgres UPSERT: `EXCLUDED.<col>` references the row
        // that would have been inserted. Matches the §10 spec wording.
        set: {
          page: sql`EXCLUDED.page`,
          percent: sql`EXCLUDED.percent`,
          updatedAt: sql`NOW()`,
        },
      });
    return { ok: true };
  } catch (err) {
    console.error("[reading-progress] write failed:", err);
    return { ok: false };
  }
}

// =============================================================================
// Bookmarks (Directive §20)
// =============================================================================

export interface BookmarkActionArgs {
  bookId: string;
  /** 1-indexed page of the edition. */
  page: number;
  label?: string | null;
}

export interface BookmarkActionResult {
  ok: boolean;
  /** True when the call created a mark, false when it removed one. */
  added?: boolean;
  /** A short, non-technical reason the reader can be shown. */
  message?: string;
}

/**
 * Mark or unmark the current page.
 *
 * The gate is the same one the reader and the asset route use, for the same
 * reason `writeReadingProgress` has one: §79 says every API boundary protects
 * its own data, and a Server Action is an API boundary. Authentication alone
 * would let any signed-in visitor write rows against books they have never
 * bought — a small abuse, but one with no upper bound and no reason to permit.
 *
 * Never throws. A failed bookmark must cost the reader a toast, not their page.
 */
export async function toggleBookmarkAction(
  args: BookmarkActionArgs,
): Promise<BookmarkActionResult> {
  if (!isBookId(args.bookId) || !Number.isInteger(args.page) || args.page < 1) {
    return { ok: false, message: "That page could not be marked." };
  }

  const userCtx = await loadAuthenticatedLocalUser();
  if (!userCtx.ok) return { ok: false, message: "Please sign in again." };

  const result = await toggleBookmark({
    userId: userCtx.localUserId,
    bookId: args.bookId,
    page: args.page,
    label: args.label ?? null,
  });

  if (result.ok) return { ok: true, added: result.added };

  return {
    ok: false,
    message:
      result.reason === "limit"
        ? `You can keep up to ${MAX_BOOKMARKS_PER_BOOK} bookmarks in one book.`
        : result.reason === "not-owned"
          ? "This book isn't in your library."
          : "That page could not be marked.",
  };
}

/** Remove one mark, from the bookmarks drawer. Same gate, same guarantees. */
export async function removeBookmarkAction(
  args: BookmarkActionArgs,
): Promise<BookmarkActionResult> {
  if (!isBookId(args.bookId) || !Number.isInteger(args.page) || args.page < 1) {
    return { ok: false };
  }
  const userCtx = await loadAuthenticatedLocalUser();
  if (!userCtx.ok) return { ok: false, message: "Please sign in again." };

  const ok = await removeBookmark({
    userId: userCtx.localUserId,
    bookId: args.bookId,
    page: args.page,
  });
  return { ok };
}
