import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { BookReader } from "@/components/reader/book-reader";
import { UnprovisionedNotice } from "@/components/unprovisioned-notice";
import { bookCoverSrc } from "@/lib/asset-map";
import { loadAuthenticatedLocalUser } from "@/lib/account";
import { db } from "@/lib/db";
import { listBookmarks } from "@/lib/db/queries/bookmarks";
import {
  recordReaderAccess,
  touchLastReadAt,
} from "@/lib/db/queries/reader-audit";
import { openReaderGate } from "@/lib/reader-access";
import { denialIdentifier, registerReaderDenial } from "@/lib/reader-throttle";

/**
 * The private reader (Directive §9, §41, §73, §74).
 *
 * WHY THIS ROUTE IS ALLOWED TO BE GUESSABLE. `/read/<bookId>` is a stable,
 * bookmarkable URL, and it is meant to be. What makes a book private is not
 * that nobody can name its address — the id is in the customer's own library
 * markup — it is that naming the address gets you nothing. Sign out and this
 * page is a 404. Sign in as someone who does not own the book and it is the
 * same 404. Send the link to a friend and they get the same 404. The identity
 * that grants access is the session, never the URL (§13).
 *
 * WHAT NO LONGER LEAVES THIS FUNCTION. A presigned R2 URL. The reader is now
 * given `/api/read/<bookId>/content`, which re-checks the session and the
 * entitlement on every range request; see that route's header for the full
 * account of why a signed URL in the page was the weak point worth removing.
 *
 * The render is `force-dynamic` because every part of it is per-user: the
 * entitlement, the resume point, the bookmarks. There is nothing here a cache
 * could correctly hold for a second visitor (§36).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reader",
  // Belt and braces on top of the gate. `robots` is not what keeps this page
  // private — authorization is (§40) — but a crawler that somehow reaches a
  // signed-in session should still be told not to index it.
  robots: { index: false, follow: false, nocache: true },
};

type Params = Promise<{ bookId: string }>;

export default async function ReadBookPage({ params }: { params: Params }) {
  const { bookId } = await params;

  // The env pre-flight comes first so an unprovisioned deployment shows the
  // structured notice rather than a 500 from inside the gate.
  const userCtx = await loadAuthenticatedLocalUser();
  if (!userCtx.ok) {
    return (
      <UnprovisionedNotice
        title={userCtx.title}
        body={userCtx.body}
        missing={userCtx.missing}
      />
    );
  }

  // The SAME gate the asset route and the progress action use. §79 in one line.
  const gate = await openReaderGate(bookId);

  if (!gate.ok) {
    // The same bucket the asset route charges, so a probe cannot double its
    // budget simply by alternating between the page and the content route.
    const { throttled } = await registerReaderDenial(
      denialIdentifier(gate.userId, await headers()),
    );
    await recordReaderAccess({
      outcome: gate.outcome,
      userId: gate.userId,
      bookRef: bookId,
      detail: throttled ? "reader; throttled" : "reader",
    });

    // A customer whose watermark is still running owns this book and is told
    // so. Every other refusal — not owned, revoked, malformed, no such book —
    // is one indistinguishable 404 (§37, §72).
    if (gate.outcome === "denied_not_ready" && gate.pending) {
      return (
        <ReaderFallback
          eyebrow="Almost there"
          title="Your copy is still being prepared"
          body={
            <>
              Each copy is watermarked to your order before it is delivered, and
              this one is still in the press.{" "}
              <Link
                href="/account/library"
                className="text-emerald-bright underline-offset-4 hover:underline"
              >
                Your library
              </Link>{" "}
              refreshes on its own the moment it is ready.
            </>
          }
        />
      );
    }

    notFound();
  }

  // Two per-user reads the reader opens with. Both are scoped to this session's
  // own user id, so neither can surface another reader's state.
  const [progress, bookmarks] = await Promise.all([
    db.query.readingProgress.findFirst({
      where: (rp, { and, eq }) =>
        and(eq(rp.userId, gate.userId), eq(rp.bookId, gate.bookId)),
      columns: { page: true },
    }),
    listBookmarks(gate.userId, gate.bookId),
  ]);

  // Deliberately not awaited. The audit line and the access stamp are for the
  // operator; making the customer wait on either would be the tail wagging the
  // dog, and both swallow their own failures by design.
  void recordReaderAccess({
    outcome: "reader_opened",
    userId: gate.userId,
    bookRef: gate.bookId,
  });
  void touchLastReadAt(gate.userId, gate.bookId);

  const book = gate.access.entitlement.book;

  return (
    <BookReader
      bookId={gate.bookId}
      bookTitle={book.title}
      coverSrc={bookCoverSrc(book.slug)}
      initialPage={progress?.page && progress.page >= 1 ? progress.page : 1}
      initialBookmarks={bookmarks}
    />
  );
}

/**
 * The one non-404 refusal: a book that is owned but not yet built.
 *
 * It keeps the storefront's chrome rather than the reader's, because the
 * reader is a focused overlay and dropping someone into it with nothing to
 * read is disorienting. This is a page about a book, not the book.
 */
function ReaderFallback({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
}) {
  return (
    <div className="cinematic-root">
      <CinematicHeader />

      <main
        id="main-content"
        className="relative z-10 mx-auto max-w-2xl px-4 py-14 sm:py-24 sm:px-6"
      >
        <div className="flex flex-col items-center text-center">
          <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
            {eyebrow}
          </p>

          <div className="relative mt-4 flex h-6 w-6 items-center justify-center">
            <div
              aria-hidden
              className="absolute h-6 w-6 rounded-full opacity-60"
              style={{
                background:
                  "radial-gradient(circle, rgba(51,240,170,0.7) 0%, transparent 70%)",
              }}
            />
            <span
              aria-hidden
              className="catalog-diamond block h-2 w-2 rounded-[1px] bg-[#33f0aa]"
              style={{ transform: "rotate(45deg)" }}
            />
          </div>

          <h1 className="mt-6 font-serif text-[32px] font-medium leading-tight text-fg-hi sm:text-[40px]">
            {title}
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-fg-mid sm:text-base">
            {body}
          </p>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
