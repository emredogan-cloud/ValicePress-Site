import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { contacts, popupImpressions } from "@/lib/db/schema";
import { checkAddressShape, checkEmail } from "@/lib/email-address";

/**
 * The contact book: every address the press holds, and on what footing.
 *
 * TWO RULES THIS MODULE EXISTS TO ENFORCE, and neither is advisory:
 *
 *  1. **Normalize before you compare.** An address is matched on its
 *     trimmed, lowercased form and nothing else, so the same person cannot
 *     arrive twice under two spellings and then unsubscribe from only one of
 *     them. The first spelling we saw is kept in `emailRaw`, because that is
 *     also how somebody writes their own name.
 *
 *  2. **An import can never manufacture consent.** `recordContact` takes the
 *     consent state as an explicit argument and `importContact` refuses to
 *     pass `opted_in` at all. The only path to `opted_in` is
 *     `recordOptIn`, which requires the evidence — which form, on which
 *     page, at what time — in the same call.
 */

export type MarketingConsent =
  | "opted_in"
  | "opted_out"
  | "unknown"
  | "not_marketing_contact";

// The address rules are pure and live in `@/lib/email-address`; they are
// re-exported here because this module is where callers have always found them.
export { checkAddressShape, checkEmail, normalizeEmail, type EmailVerdict } from "@/lib/email-address";

export interface RecordContactInput {
  email: string;
  name?: string | null;
  source: string;
  sourceDetail?: string | null;
  consent: MarketingConsent;
  /** Required whenever `consent` is `opted_in`. What they agreed to, and where. */
  consentSource?: string | null;
  customerStatus?: string;
  purchased?: boolean;
}

/**
 * Insert or merge one contact, returning its id.
 *
 * MERGE RULES, chosen so that a later, weaker signal cannot undo a stronger
 * earlier one:
 *   · `firstSeen` never moves; `lastSeen` always does.
 *   · `source` / `sourceDetail` are only written when the row had none —
 *     provenance records where we FIRST met someone.
 *   · consent is only ever raised from `unknown`; an existing `opted_in` or
 *     `opted_out` is left exactly as it is. Nothing here can flip a person
 *     who said no back to yes.
 *   · `unsubscribed` is never cleared by this function. Re-subscribing is a
 *     deliberate act with its own path.
 */
export async function recordContact(input: RecordContactInput): Promise<string | null> {
  const verdict = checkEmail(input.email);
  if (!verdict.ok) return null;
  if (input.consent === "opted_in" && !input.consentSource) {
    throw new Error("recordContact: opted_in requires consentSource evidence");
  }

  const now = new Date();
  const rows = await db
    .insert(contacts)
    .values({
      email: verdict.email,
      emailRaw: input.email.trim().slice(0, 254),
      name: input.name ?? null,
      source: input.source,
      sourceDetail: input.sourceDetail ?? null,
      marketingConsent: input.consent,
      consentSource: input.consentSource ?? null,
      consentAt: input.consent === "opted_in" ? now : null,
      customerStatus: input.customerStatus ?? "prospect",
      purchased: input.purchased ?? false,
      purchaseCount: input.purchased ? 1 : 0,
      firstSeen: now,
      lastSeen: now,
    })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        lastSeen: now,
        name: sql`coalesce(${contacts.name}, excluded.name)`,
        sourceDetail: sql`coalesce(${contacts.sourceDetail}, excluded.source_detail)`,
        marketingConsent: sql`
          case when ${contacts.marketingConsent} = 'unknown'
               then excluded.marketing_consent
               else ${contacts.marketingConsent} end`,
        consentSource: sql`
          case when ${contacts.marketingConsent} = 'unknown'
               then excluded.consent_source
               else ${contacts.consentSource} end`,
        consentAt: sql`
          case when ${contacts.marketingConsent} = 'unknown'
               then excluded.consent_at
               else ${contacts.consentAt} end`,
        purchased: sql`${contacts.purchased} or excluded.purchased`,
      },
    })
    .returning({ id: contacts.id });

  return rows[0]?.id ?? null;
}

/**
 * The only path to `opted_in`.
 *
 * Takes the evidence in the same call as the decision, because a consent
 * record whose provenance is written somewhere else is a consent record
 * nobody can audit.
 */
export async function recordOptIn(args: {
  email: string;
  name?: string | null;
  source: string;
  /** e.g. `popup:/companion/world-games` — the form AND the page. */
  consentSource: string;
  sourceDetail?: string | null;
}): Promise<string | null> {
  const verdict = checkEmail(args.email);
  if (!verdict.ok) return null;
  const now = new Date();

  const rows = await db
    .insert(contacts)
    .values({
      email: verdict.email,
      emailRaw: args.email.trim().slice(0, 254),
      name: args.name ?? null,
      source: args.source,
      sourceDetail: args.sourceDetail ?? null,
      marketingConsent: "opted_in",
      consentSource: args.consentSource,
      consentAt: now,
      firstSeen: now,
      lastSeen: now,
    })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        lastSeen: now,
        name: sql`coalesce(${contacts.name}, excluded.name)`,
        // A person opting in now overrides an earlier `unknown` OR an earlier
        // `opted_out`: they are asking, today, on a form that said what it
        // was. That is the one direction a later signal may override an
        // earlier one, and it is the person's own.
        marketingConsent: sql`'opted_in'`,
        consentSource: sql`excluded.consent_source`,
        consentAt: sql`excluded.consent_at`,
        // Re-subscribing lifts a suppression — but only here, and only
        // because the act is the person's own.
        unsubscribed: sql`false`,
        unsubscribedAt: sql`null`,
      },
    })
    .returning({ id: contacts.id });

  return rows[0]?.id ?? null;
}

/**
 * Suppress a contact: sets BOTH the consent state and the suppression flag.
 *
 * Records the suppression even for an address the book has never seen. A
 * subscriber from before the contact book existed lives only in the mail
 * provider; when they unsubscribe, "no row to update" used to mean "nothing
 * recorded", and the dashboard went on counting people it had been told not to
 * write to. So this inserts when it must, and it accepts any plausible address —
 * a throw-away mailbox is still a mailbox somebody asked us to leave alone.
 * The earliest suppression time is kept: asking twice does not move it.
 */
export async function recordUnsubscribe(email: string): Promise<boolean> {
  const verdict = checkAddressShape(email);
  if (!verdict.ok) return false;
  const now = new Date();
  await db
    .insert(contacts)
    .values({
      email: verdict.email,
      emailRaw: email.trim().slice(0, 254),
      source: "unsubscribe",
      sourceDetail: "unsubscribe link",
      marketingConsent: "opted_out",
      unsubscribed: true,
      unsubscribedAt: now,
      firstSeen: now,
      lastSeen: now,
    })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        marketingConsent: "opted_out",
        unsubscribed: true,
        unsubscribedAt: sql`coalesce(${contacts.unsubscribedAt}, excluded.unsubscribed_at)`,
        lastSeen: now,
      },
    });
  return true;
}

// ---------------------------------------------------------------------------
// The popup's site-wide memory
// ---------------------------------------------------------------------------

/**
 * Has this person already met the popup — anywhere, on any page, ever?
 *
 * Asked once per page load by the eligibility endpoint. Three identities are
 * checked because a visitor can hold up to three, and any ONE of them having
 * seen it is enough: a signed-in reader who saw it on a laptop must not meet
 * it again on a phone, and a browser that saw it while signed out must not
 * meet it again after signing in.
 */
export async function hasSeenPopup(args: {
  popup: string;
  visitorId: string;
  userId?: string | null;
}): Promise<boolean> {
  const conditions = [eq(popupImpressions.visitorId, args.visitorId)];
  if (args.userId) conditions.push(eq(popupImpressions.userId, args.userId));

  const row = await db.query.popupImpressions.findFirst({
    where: and(eq(popupImpressions.popup, args.popup), or(...conditions)),
    columns: { id: true },
  });
  return Boolean(row);
}

/**
 * Write the impression down. Idempotent by construction: the unique index on
 * (popup, visitor_id) makes a second insert from a second tab a no-op rather
 * than a duplicate row.
 */
export async function recordPopupShown(args: {
  popup: string;
  visitorId: string;
  userId?: string | null;
  sourcePath?: string | null;
}): Promise<void> {
  await db
    .insert(popupImpressions)
    .values({
      popup: args.popup,
      visitorId: args.visitorId,
      userId: args.userId ?? null,
      sourcePath: args.sourcePath ?? null,
      outcome: "shown",
    })
    .onConflictDoNothing({
      target: [popupImpressions.popup, popupImpressions.visitorId],
    });
}

/**
 * Close the loop on an impression. Never re-opens one: `resolvedAt` is set
 * once, so a dismissal after a submission cannot overwrite the submission.
 */
export async function resolvePopup(args: {
  popup: string;
  visitorId: string;
  outcome: "dismissed" | "submitted";
  contactId?: string | null;
}): Promise<void> {
  await db
    .update(popupImpressions)
    .set({
      outcome: args.outcome,
      resolvedAt: new Date(),
      ...(args.contactId ? { contactId: args.contactId } : {}),
    })
    .where(
      and(
        eq(popupImpressions.popup, args.popup),
        eq(popupImpressions.visitorId, args.visitorId),
        isNull(popupImpressions.resolvedAt),
      ),
    );
}
