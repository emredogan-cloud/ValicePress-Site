/**
 * Who an address really is — for finding the same person under two spellings.
 *
 * The `contacts` table is unique on the TRIMMED, LOWER-CASED address, which
 * stops "A@x.com" and "a@x.com " being two rows. It does not stop
 * "jane.doe@gmail.com" and "janedoe+books@gmail.com" being two rows, and at
 * Gmail they are one mailbox: a person who unsubscribes from one and is still
 * mailed at the other has been wronged by a list that thought it knew better.
 *
 * So there are two notions of "same", and they are kept apart:
 *   - the ROW identity (`normalizeEmail`, in `@/lib/db/contacts`): exact, enforced
 *     by the database, never guessed;
 *   - the MAILBOX identity (`canonicalEmail`, here): a best-effort reading of
 *     how providers treat dots and `+tags`, used to WARN and to REPORT, never to
 *     merge or delete anything on its own.
 *
 * Only providers whose behaviour is documented are folded; for every other
 * domain a `+` is left alone, because at a company mail server `a+b@x.org` may
 * be a different person from `a@x.org`.
 */

/** Gmail: dots are ignored and `+tag` is dropped; googlemail.com is the same service. */
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Providers documented to deliver `name+anything@domain` to `name@domain`. */
const PLUS_ADDRESSING_DOMAINS = new Set([
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "fastmail.com",
]);

export function canonicalEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.split("+")[0].replace(/\./g, "");
  } else if (PLUS_ADDRESSING_DOMAINS.has(domain)) {
    local = local.split("+")[0];
  }
  return `${local}@${domain}`;
}

/** Could this address have an alias that `canonicalEmail` would fold? (Lets a lookup stay narrow.) */
export function isFoldableDomain(email: string): boolean {
  const t = email.trim().toLowerCase();
  const domain = t.slice(t.lastIndexOf("@") + 1);
  return GMAIL_DOMAINS.has(domain) || PLUS_ADDRESSING_DOMAINS.has(domain);
}

export interface DuplicateGroup<T> {
  /** The shared mailbox identity. */
  canonical: string;
  /** Every row that reads as that mailbox, in the order given. At least two. */
  members: T[];
}

/**
 * Groups of rows that are probably one mailbox. Pure: a list in, groups out.
 * Biggest groups first, then alphabetical, so the report is stable between loads.
 */
export function findAliasGroups<T extends { email: string }>(rows: readonly T[]): Array<DuplicateGroup<T>> {
  const byCanonical = new Map<string, T[]>();
  for (const row of rows) {
    const key = canonicalEmail(row.email);
    const bucket = byCanonical.get(key);
    if (bucket) bucket.push(row);
    else byCanonical.set(key, [row]);
  }
  return [...byCanonical.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([canonical, members]) => ({ canonical, members }))
    .sort((a, b) => b.members.length - a.members.length || a.canonical.localeCompare(b.canonical));
}
