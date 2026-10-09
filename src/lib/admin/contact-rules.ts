import { isUuid } from "@/lib/admin/ids";
import { checkEmail } from "@/lib/email-address";

export { isUuid };

/**
 * What an administrator may do to the contact book — as rules, not as UI.
 *
 * The contact book has a standing policy (see `@/lib/db/contacts`): consent is
 * only ever raised with evidence, a suppression is only ever lifted by the
 * person it protects, and nothing a later, weaker signal says can undo what an
 * earlier, stronger one recorded. An admin form is a new way to write to that
 * table, so it has to obey the same policy — and the cheapest way to be sure it
 * does is to put the policy in pure functions with no database in sight, where
 * every branch can be tested and the form, the action and the query all ask the
 * same question.
 *
 * What follows therefore REFUSES things, on purpose:
 *   - adding a contact does not subscribe them. A new row is `unknown` (or
 *     `not_marketing_contact`) unless the admin states the evidence for an
 *     opt-in, in words, in the same submission;
 *   - nobody who unsubscribed can be re-subscribed from here — only they can,
 *     through a sign-up form;
 *   - "opted in" cannot be quietly downgraded to "not a marketing contact":
 *     stopping the emails is a suppression and is recorded as one.
 */

export type MarketingConsent = "opted_in" | "opted_out" | "unknown" | "not_marketing_contact";

export const LIMITS = {
  name: 120,
  notes: 2000,
  sourceDetail: 300,
  evidenceMin: 10,
  evidenceMax: 300,
} as const;

/** The consent states an admin may START a contact in. */
export const NEW_CONTACT_CONSENTS = ["unknown", "not_marketing_contact", "opted_in"] as const;
export type NewContactConsent = (typeof NEW_CONTACT_CONSENTS)[number];

export type FieldErrors = Partial<Record<"email" | "name" | "notes" | "sourceDetail" | "consent" | "evidence", string>>;

export interface ValidNewContact {
  email: string;
  /** The address as typed (trimmed) — kept as `emailRaw`. */
  emailRaw: string;
  name: string | null;
  notes: string | null;
  sourceDetail: string | null;
  consent: NewContactConsent;
  /** Present exactly when `consent` is `opted_in`; stored as `admin: <evidence>`. */
  consentSource: string | null;
}

/** Control characters (except newline/tab in notes) have no business in a contact record. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function clean(value: unknown, max: number, { multiline = false } = {}): { value: string | null; tooLong: boolean } {
  if (typeof value !== "string") return { value: null, tooLong: false };
  let v = value.replace(CONTROL, "").replace(/\r\n?/g, "\n");
  if (!multiline) v = v.replace(/[\n\t]+/g, " ");
  v = v.trim();
  if (v.length === 0) return { value: null, tooLong: false };
  return v.length > max ? { value: null, tooLong: true } : { value: v, tooLong: false };
}

export function emailProblem(reason: "empty" | "too-long" | "malformed" | "disposable"): string {
  switch (reason) {
    case "empty":
      return "Enter an email address.";
    case "too-long":
      return "That address is too long (254 characters at most).";
    case "malformed":
      return "That doesn't look like an email address.";
    case "disposable":
      return "That is a throw-away address from a disposable-mail service, so it was not added.";
  }
}

export interface NewContactInput {
  email?: unknown;
  name?: unknown;
  notes?: unknown;
  sourceDetail?: unknown;
  consent?: unknown;
  evidence?: unknown;
}

export function validateNewContact(input: NewContactInput): { ok: true; value: ValidNewContact } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const rawEmail = typeof input.email === "string" ? input.email : "";
  const verdict = checkEmail(rawEmail);
  if (!verdict.ok) errors.email = emailProblem(verdict.reason);

  const name = clean(input.name, LIMITS.name);
  if (name.tooLong) errors.name = `Keep the name to ${LIMITS.name} characters.`;
  const notes = clean(input.notes, LIMITS.notes, { multiline: true });
  if (notes.tooLong) errors.notes = `Keep the notes to ${LIMITS.notes} characters.`;
  const sourceDetail = clean(input.sourceDetail, LIMITS.sourceDetail);
  if (sourceDetail.tooLong) errors.sourceDetail = `Keep this to ${LIMITS.sourceDetail} characters.`;

  const consent = (NEW_CONTACT_CONSENTS as readonly string[]).includes(String(input.consent))
    ? (input.consent as NewContactConsent)
    : input.consent === undefined || input.consent === ""
      ? "unknown"
      : null;
  if (consent === null) errors.consent = "Choose what is known about their consent.";

  let consentSource: string | null = null;
  if (consent === "opted_in") {
    const evidence = clean(input.evidence, LIMITS.evidenceMax);
    if (evidence.tooLong) errors.evidence = `Keep the evidence to ${LIMITS.evidenceMax} characters.`;
    else if (!evidence.value || evidence.value.length < LIMITS.evidenceMin) {
      errors.evidence = "Opting someone in needs the evidence: say how and when they agreed, e.g. “Replied yes to the 12 October email”.";
    } else consentSource = `admin: ${evidence.value}`;
  }

  if (Object.keys(errors).length > 0 || !verdict.ok || consent === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      email: verdict.email,
      emailRaw: rawEmail.trim().slice(0, 254),
      name: name.value,
      notes: notes.value,
      sourceDetail: sourceDetail.value,
      consent,
      consentSource,
    },
  };
}

// ---------------------------------------------------------------------------
// Editing details (never the address, never consent)
// ---------------------------------------------------------------------------

export interface ValidDetails {
  name: string | null;
  notes: string | null;
  sourceDetail: string | null;
}

export function validateDetails(input: Pick<NewContactInput, "name" | "notes" | "sourceDetail">): { ok: true; value: ValidDetails } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = clean(input.name, LIMITS.name);
  if (name.tooLong) errors.name = `Keep the name to ${LIMITS.name} characters.`;
  const notes = clean(input.notes, LIMITS.notes, { multiline: true });
  if (notes.tooLong) errors.notes = `Keep the notes to ${LIMITS.notes} characters.`;
  const sourceDetail = clean(input.sourceDetail, LIMITS.sourceDetail);
  if (sourceDetail.tooLong) errors.sourceDetail = `Keep this to ${LIMITS.sourceDetail} characters.`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name: name.value, notes: notes.value, sourceDetail: sourceDetail.value } };
}

// ---------------------------------------------------------------------------
// Consent changes
// ---------------------------------------------------------------------------

export interface ConsentState {
  marketingConsent: MarketingConsent;
  unsubscribed: boolean;
}

export type ConsentChange =
  | { to: "suppress" }
  | { to: "opt_in"; evidence: unknown }
  | { to: "not_marketing_contact" };

/** The columns a consent change writes — `now` is passed in so the plan stays pure. */
export type ConsentPatch =
  | { marketingConsent: "opted_out"; unsubscribed: true; unsubscribedAt: Date }
  | { marketingConsent: "opted_in"; consentSource: string; consentAt: Date }
  | { marketingConsent: "not_marketing_contact" };

export function planConsentChange(
  current: ConsentState,
  change: ConsentChange,
  now: Date,
): { ok: true; patch: ConsentPatch } | { ok: false; error: string; field?: "evidence" } {
  // A suppression is in force: nothing here may touch it. Not "opt back in", not
  // "relabel" — those would leave a row that says one thing and means another.
  if (current.unsubscribed) {
    return change.to === "suppress"
      ? { ok: false, error: "Already suppressed." }
      : { ok: false, error: "This person has unsubscribed. Only they can opt back in — through a sign-up form — so there is nothing to change here." };
  }

  switch (change.to) {
    case "suppress":
      return { ok: true, patch: { marketingConsent: "opted_out", unsubscribed: true, unsubscribedAt: now } };

    case "opt_in": {
      if (current.marketingConsent === "opted_in") return { ok: false, error: "Already opted in." };
      const evidence = clean(change.evidence, LIMITS.evidenceMax);
      if (evidence.tooLong) return { ok: false, field: "evidence", error: `Keep the evidence to ${LIMITS.evidenceMax} characters.` };
      if (!evidence.value || evidence.value.length < LIMITS.evidenceMin) {
        return {
          ok: false,
          field: "evidence",
          error: "Opting someone in needs the evidence: say how and when they agreed, e.g. “Replied yes to the 12 October email”.",
        };
      }
      return { ok: true, patch: { marketingConsent: "opted_in", consentSource: `admin: ${evidence.value}`, consentAt: now } };
    }

    case "not_marketing_contact":
      if (current.marketingConsent === "opted_in") {
        return { ok: false, error: "This person opted in. To stop emailing them, use Suppress — that records it as a suppression instead of quietly changing their label." };
      }
      if (current.marketingConsent === "not_marketing_contact") return { ok: false, error: "Already marked as not a marketing contact." };
      return { ok: true, patch: { marketingConsent: "not_marketing_contact" } };
  }
}

// ---------------------------------------------------------------------------
// Deleting
// ---------------------------------------------------------------------------

export type DeletePlan = { ok: true } | { ok: false; needsErase: true; error: string };

/**
 * Deleting someone who unsubscribed deletes the record that they asked not to
 * be written to, and the next import that meets the address will happily treat
 * it as new. It is sometimes exactly right (a request to erase everything), so
 * it is allowed — but only when the admin says so in so many words.
 */
export function planDelete(current: Pick<ConsentState, "unsubscribed">, opts: { erase: boolean }): DeletePlan {
  if (current.unsubscribed && !opts.erase) {
    return {
      ok: false,
      needsErase: true,
      error: "This person unsubscribed. Deleting them also deletes the suppression record, so they could be added again later without that history. Tick the box to erase them completely.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// How a row reads
// ---------------------------------------------------------------------------

export type ContactActivity = "active" | "suppressed" | "inactive";

/**
 * Active = may be mailed (opted in, no suppression). Suppressed = a suppression
 * is in force or they opted out. Everything else is on file but not mailable.
 */
export function contactActivity(c: ConsentState): ContactActivity {
  if (c.unsubscribed || c.marketingConsent === "opted_out") return "suppressed";
  if (c.marketingConsent === "opted_in") return "active";
  return "inactive";
}

export const ACTIVITY_LABEL: Record<ContactActivity, string> = {
  active: "Active",
  suppressed: "Suppressed",
  inactive: "Not subscribed",
};
