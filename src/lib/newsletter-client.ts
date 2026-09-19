/**
 * Newsletter subscribe client helper.
 *
 * Phase 2.A — single shared `fetch()` for all three cinematic newsletter
 * forms (home, article, category sidebar). Wraps the `/api/newsletter`
 * endpoint that Phase 0.C shipped: POST { email } → 200 / 400 / 503 / 500.
 *
 * Returns a tagged result that the calling form can map straight into a
 * 4-state UI (idle / loading / ok / error). Never throws — even network
 * failures resolve to `{ ok: false, code: "network" }` so the form
 * shows a real error instead of a hung pending state.
 */

/**
 * Where a subscription came from.
 *
 * ONE master list, many sources — not one list per form. A second list is
 * a second unsubscribe surface, and a reader who opts out of "the
 * newsletter" but keeps receiving "the Codex list" has been ignored, not
 * segmented.
 *
 * The value is stored as a Resend custom property so the audience can be
 * segmented later without re-asking anyone for consent. Keep this union
 * closed: an open string would let a caller invent a tag that no segment
 * ever matches, and the record would be silently useless.
 */
export type NewsletterSource =
  // The site-wide newsletter popup (2026-09-19). Tagged separately from
  // "home" because a signup that a reader went looking for and one that a
  // dialog asked for are different signals about the same list.
  | "popup"
  | "home"
  | "article"
  | "category"
  | "codex-verify"
  // A reader who scanned the QR code inside the printed Hangul workbook.
  // The most commercially interesting tag we have: it identifies someone who
  // already bought a physical book on Amazon, which is the one thing Amazon
  // never tells us. Keep it distinct from every other source for exactly
  // that reason.
  | "hangul-companion"
  // Same idea, one tag per printed book: the QR/URL inside The Great Book
  // of World Games and inside the Dudeney edition. Never merged, because
  // the segment is the whole point.
  | "world-games-companion"
  | "dudeney-companion"
  // Phase 4 finalization: one tag per printed book, same rule.
  | "world-myths-companion"
  | "codex-bestiarium-companion"
  | "codex-mythologica-companion"
  | "myth-hunters-companion"
  // Phase 1 of the public-domain factory (2026-09-04).
  | "epictetus-companion"
  | "seneca-companion"
  // Valice Script 2 (2026-09-04).
  | "greek-companion"
  | "china-gods-companion"
  | "vedic-gods-companion"
  | "the-dragon-companion"
  // Phase 2 of the public-domain factory (2026-09-05).
  | "games-ancient-and-oriental-companion"
  // Roadmap book 4 (2026-09-05): the Codex puzzle companion.
  | "codex-puzzles-companion"
  | "korean-games-companion"
  | "chess-and-playing-cards-companion"
  | "mancala-companion"
  | "traditional-games-companion"
  // Phase 3 of the public-domain factory (2026-09-06): the Bestiarium expansion.
  // Play Anywhere 1 — the first Agent A original (2026-09-10).
  | "play-anywhere-companion"
  | "kwaidan-companion"
  | "sea-monsters-unmasked-companion"
  | "book-of-were-wolves-companion"
  | "british-goblins-companion"
  | "fairy-mythology-vol-1-companion"
  | "fairy-mythology-vol-2-companion"
  // Agent A original book 4 (2026-09-11): Etymon vol. 1.
  | "etymon-companion"
  // Agent A original, Under Every Sky 1 (2026-09-11). The QR printed on the
  // last page of How the World Began. One tag per printed book, same rule.
  | "under-every-sky-companion"
  // Under Every Sky 2 (2026-09-11). The QR printed in The Trickster's Table.
  | "tricksters-table-companion"
  // The temporary free-ebook promotion (2026-09-10). Its own tag because a
  // list built during a giveaway behaves nothing like one built from a
  // printed book, and merging the two would hide that.
  | "free-ebook-campaign";

/** The subset of sources a printed-book companion page may carry. */
export type CompanionNewsletterSource = Extract<
  NewsletterSource,
  `${string}-companion`
>;

export type NewsletterErrorCode =
  | "invalid-email"
  | "provider-unavailable"
  | "rate-limited"
  | "internal-error"
  | "network";

export type NewsletterResult =
  | { ok: true }
  | { ok: false; code: NewsletterErrorCode };

/**
 * Map an error code into a calm, user-facing sentence. Same vocabulary
 * across all three forms so the brand voice stays consistent.
 */
export function newsletterErrorMessage(code: NewsletterErrorCode): string {
  switch (code) {
    case "invalid-email":
      return "That email doesn't look right. Mind double-checking?";
    case "provider-unavailable":
      return "Subscriptions are temporarily unavailable. Please try again later.";
    case "rate-limited":
      return "Too many tries — give it a minute and try again.";
    case "internal-error":
      return "Something went wrong on our side. Please try again in a moment.";
    case "network":
      return "Couldn't reach the server. Check your connection and try again.";
  }
}

/**
 * Submit an email to `/api/newsletter`. The route's response taxonomy is:
 *   200 { ok: true, status }
 *   400 { ok: false, error: "invalid-email" | "invalid-json" }
 *   429 (middleware-emitted; no body required)
 *   503 { ok: false, error: "provider-unavailable" }
 *   500 { ok: false, error: "internal-error" }
 */
export async function subscribeToNewsletter(
  email: string,
  source?: NewsletterSource,
): Promise<NewsletterResult> {
  let res: Response;
  try {
    res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source ? { email, source } : { email }),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  if (res.ok) return { ok: true };

  // Status-first taxonomy — middleware can return 429 with no body.
  if (res.status === 429) return { ok: false, code: "rate-limited" };
  if (res.status === 503) return { ok: false, code: "provider-unavailable" };

  // For 400 / 500 we parse the JSON body to discriminate.
  let body: { error?: string } = {};
  try {
    body = (await res.json()) as { error?: string };
  } catch {
    // ignored — body wasn't JSON
  }

  if (res.status === 400) {
    return {
      ok: false,
      code: body.error === "invalid-email" ? "invalid-email" : "internal-error",
    };
  }

  // 500 + anything else
  return { ok: false, code: "internal-error" };
}
