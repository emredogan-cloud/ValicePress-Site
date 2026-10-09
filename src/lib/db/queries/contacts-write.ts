import { and, eq, inArray, like, or } from "drizzle-orm";

import {
  isUuid,
  planConsentChange,
  planDelete,
  type ConsentChange,
  type ValidDetails,
  type ValidNewContact,
} from "@/lib/admin/contact-rules";
import { canonicalEmail, isFoldableDomain } from "@/lib/admin/email-identity";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";

/**
 * The administrator's WRITES to the contact book.
 *
 * Until now the admin could only look: the book had one writer (`/api/newsletter`,
 * for a person signing themselves up) and one importer. Every function here is a
 * new way into the one table that is a list of real people's addresses, so each
 * one:
 *
 *   1. calls `requireAdmin()` before it reads a single argument — a helper that
 *      trusts its caller to have checked is a helper that will one day be called
 *      from somewhere that did not;
 *   2. asks the pure policy in `@/lib/admin/contact-rules` what is allowed
 *      (an add is `unknown` unless the evidence for an opt-in comes with it; a
 *      suppression is never lifted from here) and obeys the answer;
 *   3. returns a result a form can show, never a thrown database error;
 *   4. never touches a row it was not asked about (ids are checked to be UUIDs
 *      before they reach SQL).
 *
 * Nothing here talks to a mail provider. This is the press's own record of who it
 * holds and on what footing; whether a provider's list agrees is a separate
 * question that this module does not pretend to answer.
 */

export type WriteFailure = {
  ok: false;
  error: string;
  field?: "email" | "evidence" | "name" | "notes" | "sourceDetail";
  code?: "duplicate" | "alias" | "not_found" | "refused" | "needs_erase" | "changed";
  /** The row the problem concerns (for "already in the list — open it"). */
  existingId?: string;
};
export type WriteResult<T = null> = { ok: true; value: T } | WriteFailure;

const NOT_FOUND: WriteFailure = { ok: false, code: "not_found", error: "That contact no longer exists. Reload the list." };

/** Postgres unique_violation, from the driver however it wraps it. */
function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === "23505");
}

/** Where aliases of an address could live: its own domain, plus googlemail.com for Gmail. */
function domainsToCheck(email: string): string[] {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return domain === "gmail.com" || domain === "googlemail.com" ? ["gmail.com", "googlemail.com"] : [domain];
}

export async function adminAddContact(
  value: ValidNewContact,
  opts: { allowAlias?: boolean } = {},
): Promise<WriteResult<{ id: string; email: string }>> {
  await requireAdmin();

  const existing = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, value.email)).limit(1);
  if (existing[0]) {
    return { ok: false, code: "duplicate", field: "email", existingId: existing[0].id, error: `${value.email} is already in the contact book.` };
  }

  if (!opts.allowAlias && isFoldableDomain(value.email)) {
    const wanted = canonicalEmail(value.email);
    const candidates = await db
      .select({ id: contacts.id, email: contacts.email })
      .from(contacts)
      .where(or(...domainsToCheck(value.email).map((d) => like(contacts.email, `%@${d}`))));
    const alias = candidates.find((c) => canonicalEmail(c.email) === wanted);
    if (alias) {
      return {
        ok: false,
        code: "alias",
        field: "email",
        existingId: alias.id,
        error: `That looks like another address for ${alias.email}, which is already in the contact book. If it really is a different person, add it anyway.`,
      };
    }
  }

  const now = new Date();
  try {
    const rows = await db
      .insert(contacts)
      .values({
        email: value.email,
        emailRaw: value.emailRaw,
        name: value.name,
        notes: value.notes,
        source: "admin",
        sourceDetail: value.sourceDetail,
        marketingConsent: value.consent,
        consentSource: value.consentSource,
        consentAt: value.consent === "opted_in" ? now : null,
        firstSeen: now,
        lastSeen: now,
      })
      .returning({ id: contacts.id, email: contacts.email });
    return { ok: true, value: rows[0] };
  } catch (err) {
    // Two admins adding the same address at once: the unique index decides.
    if (isUniqueViolation(err)) {
      return { ok: false, code: "duplicate", field: "email", error: `${value.email} is already in the contact book.` };
    }
    throw err;
  }
}

/** Name, notes and where we first met them. Never the address, never consent. */
export async function adminUpdateContactDetails(id: string, details: ValidDetails): Promise<WriteResult> {
  await requireAdmin();
  if (!isUuid(id)) return NOT_FOUND;
  const rows = await db
    .update(contacts)
    .set({ name: details.name, notes: details.notes, sourceDetail: details.sourceDetail })
    .where(eq(contacts.id, id.toLowerCase()))
    .returning({ id: contacts.id });
  return rows.length === 0 ? NOT_FOUND : { ok: true, value: null };
}

/**
 * Suppress, record an opt-in (with evidence), or mark as not a marketing
 * contact — as the pure policy allows.
 *
 * The write is conditional on the row STILL being unsuppressed, so an
 * unsubscribe that lands between the read and the write (a person clicking the
 * link while an admin has the page open) is not overwritten by a stale decision.
 */
export async function adminChangeConsent(id: string, change: ConsentChange): Promise<WriteResult<{ marketingConsent: string }>> {
  await requireAdmin();
  if (!isUuid(id)) return NOT_FOUND;
  const key = id.toLowerCase();

  const rows = await db
    .select({ marketingConsent: contacts.marketingConsent, unsubscribed: contacts.unsubscribed })
    .from(contacts)
    .where(eq(contacts.id, key))
    .limit(1);
  const current = rows[0];
  if (!current) return NOT_FOUND;

  const plan = planConsentChange(current, change, new Date());
  if (!plan.ok) return { ok: false, code: "refused", error: plan.error, ...(plan.field ? { field: plan.field } : {}) };

  const patch = plan.patch;
  const written = await db
    .update(contacts)
    .set(patch)
    // A suppression is the one state a stale decision must never overwrite.
    .where(patch.marketingConsent === "opted_out" ? eq(contacts.id, key) : and(eq(contacts.id, key), eq(contacts.unsubscribed, false)))
    .returning({ marketingConsent: contacts.marketingConsent });
  if (written.length === 0) {
    return { ok: false, code: "changed", error: "This contact changed while you were looking at it — most likely they unsubscribed. Reload and check." };
  }
  return { ok: true, value: { marketingConsent: written[0].marketingConsent } };
}

export async function adminDeleteContact(id: string, opts: { erase: boolean }): Promise<WriteResult<{ email: string }>> {
  await requireAdmin();
  if (!isUuid(id)) return NOT_FOUND;
  const key = id.toLowerCase();

  const rows = await db.select({ email: contacts.email, unsubscribed: contacts.unsubscribed }).from(contacts).where(eq(contacts.id, key)).limit(1);
  const current = rows[0];
  if (!current) return NOT_FOUND;

  const plan = planDelete(current, opts);
  if (!plan.ok) return { ok: false, code: "needs_erase", error: plan.error };

  // popup_impressions.contact_id is `on delete set null`, so history survives the row.
  const gone = await db.delete(contacts).where(inArray(contacts.id, [key])).returning({ email: contacts.email });
  return gone.length === 0 ? NOT_FOUND : { ok: true, value: { email: gone[0].email } };
}
