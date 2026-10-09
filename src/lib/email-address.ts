/**
 * What counts as an email address here, in one pure module.
 *
 * Lifted out of `@/lib/db/contacts` so that code which only needs to RULE on an
 * address (the admin forms, their tests) does not have to import the database
 * layer to do it. `@/lib/db/contacts` re-exports everything below, so no caller
 * had to change.
 */

/** Trimmed and lowercased. The identity of a contact row. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Addresses that exist to be thrown away. Kept deliberately short: this is a
 * spam-and-accident filter, not a gate, and a false positive costs a real
 * subscriber. Anything not on the list is accepted.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mintemail.com",
  "tempr.email",
]);

/** Pragmatic, not RFC-perfect — the same check the newsletter route uses. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailVerdict =
  | { ok: true; email: string }
  | { ok: false; reason: "empty" | "too-long" | "malformed" | "disposable" };

/**
 * Is this plausibly an address — nothing more? Used where REFUSING an address
 * would do harm: a person unsubscribing from a throw-away mailbox must still be
 * recorded as someone not to write to.
 */
export function checkAddressShape(raw: string): EmailVerdict {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, reason: "empty" };
  if (email.length > 254) return { ok: false, reason: "too-long" };
  if (!EMAIL_RE.test(email)) return { ok: false, reason: "malformed" };
  return { ok: true, email };
}

/** Shape, plus the disposable-domain filter: for ADDING someone to the book. */
export function checkEmail(raw: string): EmailVerdict {
  const shape = checkAddressShape(raw);
  if (!shape.ok) return shape;
  const domain = shape.email.slice(shape.email.lastIndexOf("@") + 1);
  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: "disposable" };
  return shape;
}
