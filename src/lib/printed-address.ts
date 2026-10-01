/**
 * Addresses that are printed inside physical books, and the forgiveness they
 * need.
 *
 * ── THE PROBLEM ───────────────────────────────────────────────────────────
 * A URL printed in a paperback is permanent. It cannot be edited, and it is
 * typed by hand — from a page held at an angle, by someone who may capitalise
 * the first letter out of habit, or who read it off a page set in small caps.
 * Two of our books are set in Cinzel, whose lowercase glyphs ARE small caps:
 * a reader copying what they see there types
 * `VALICEPRESS.COM/COMPANION/CODEX-BESTIARIUM`.
 *
 * Hostnames are case-insensitive by specification. Paths are not, and Next.js
 * serves `/companion/hangul` while returning 404 for `/Companion/Hangul`. So
 * a reader who does the obvious thing meets a 404 and concludes the publisher
 * is unreliable — which is a far more expensive outcome than the redirect
 * below.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * Only paths that are actually printed in books get this treatment, and they
 * get a 308 to their canonical lowercase form. Everything else keeps Next.js's
 * ordinary case sensitivity: a blanket lowercase redirect would break any
 * future route with a case-sensitive segment, and would quietly mask real
 * broken links.
 *
 * Printed addresses live in `scripts/factory/companion-page-spec.mjs` and are
 * asserted against this list by `printed-address.test.ts`.
 */

/** Path prefixes and exact paths that appear in print. Lowercase, no host. */
const PRINTED_PREFIXES = ["/companion/"] as const;
const PRINTED_EXACT = [
  "/companion",
  "/codex-enigmatica/verify",
  // Weather Permitting (Bristlecone Emergency, Book 1): the back-matter QR code
  // and printed link for THE SECOND CHAIR, in the paperback and the Kindle book.
  "/weather-permitting-bonus",
] as const;

export function isPrintedAddress(lowerPathname: string): boolean {
  if (PRINTED_EXACT.includes(lowerPathname as (typeof PRINTED_EXACT)[number])) return true;
  return PRINTED_PREFIXES.some((p) => lowerPathname.startsWith(p));
}

/**
 * The canonical form of a printed address typed with the wrong case, or null
 * when nothing needs to change.
 *
 * Only the pathname is lowered; the query string and hash are untouched,
 * because a printed address never carries either and anything that does is
 * not ours to rewrite.
 */
export function printedAddressRedirect(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const lower = parsed.pathname.toLowerCase();
  if (lower === parsed.pathname) return null;
  if (!isPrintedAddress(lower)) return null;
  const target = new URL(parsed.toString());
  target.pathname = lower;
  return target.toString();
}
