/**
 * The durable first-party visitor identifier.
 *
 * WHAT IT IS: 128 bits of randomness in a first-party cookie. It identifies a
 * browser so the site can keep a promise it made — "you will see this popup
 * once" — across pages, tabs and visits.
 *
 * WHAT IT IS NOT: a fingerprint, a tracking id, or anything derived from the
 * person. It is not built from an IP address, a user agent, a screen size or
 * a hash of any of those. It is not shared with anyone; no third party can
 * read it; it is scoped to this site's own origin. Someone who clears their
 * cookies has genuinely reset it, which is the behaviour a first-party id is
 * supposed to have and a fingerprint deliberately does not.
 *
 * WHY NOT httpOnly: the popup's fast path runs entirely in the browser — if
 * the "already seen" cookie is present, no request is made at all. That needs
 * the client to read it. Nothing secret is in it, and nothing is authorised
 * by it: presenting someone else's visitor id gets you a popup decision, not
 * access to anything.
 */

export const VISITOR_COOKIE = "vp_vid";
/** The fast path. Set alongside the impression so repeat pages cost nothing. */
export const POPUP_SEEN_COOKIE = "vp_np";
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 365; // one year

/** 32 lowercase hex characters. Crypto-random; never derived from the request. */
export function mintVisitorId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Shape check, so a tampered cookie can never reach a query as-is. */
export function isValidVisitorId(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

export const VISITOR_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: VISITOR_MAX_AGE,
};
