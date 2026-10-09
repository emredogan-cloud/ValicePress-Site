import { describe, expect, it } from "vitest";

import {
  ACTIVITY_LABEL,
  LIMITS,
  contactActivity,
  emailProblem,
  isUuid,
  planConsentChange,
  planDelete,
  validateDetails,
  validateNewContact,
  type ConsentState,
} from "./contact-rules";

const NOW = new Date("2026-10-08T12:00:00Z");
const st = (over: Partial<ConsentState> = {}): ConsentState => ({ marketingConsent: "unknown", unsubscribed: false, ...over });

describe("validateNewContact", () => {
  it("accepts a plain address and normalises it", () => {
    const r = validateNewContact({ email: "  Jane@Example.COM ", name: "  Jane  ", consent: "unknown" });
    expect(r).toEqual({
      ok: true,
      value: { email: "jane@example.com", emailRaw: "Jane@Example.COM", name: "Jane", notes: null, sourceDetail: null, consent: "unknown", consentSource: null },
    });
  });

  it.each([
    ["", "Enter an email address."],
    ["   ", "Enter an email address."],
    ["no-at-sign", "That doesn't look like an email address."],
    ["a@b", "That doesn't look like an email address."],
    ["a b@c.com", "That doesn't look like an email address."],
    ["someone@mailinator.com", "That is a throw-away address from a disposable-mail service, so it was not added."],
    [`${"a".repeat(250)}@x.com`, "That address is too long (254 characters at most)."],
  ])("refuses the address %j", (email, message) => {
    const r = validateNewContact({ email });
    expect(r).toEqual({ ok: false, errors: { email: message } });
  });

  it("defaults the consent to unknown — adding someone does not subscribe them", () => {
    for (const consent of [undefined, "", "unknown"]) {
      const r = validateNewContact({ email: "a@b.org", consent });
      expect(r.ok && r.value.consent, String(consent)).toBe("unknown");
    }
  });

  it("refuses a consent state an admin may not start a contact in", () => {
    for (const consent of ["opted_out", "subscribed", "yes", "OPTED_IN", 7]) {
      expect(validateNewContact({ email: "a@b.org", consent })).toEqual({ ok: false, errors: { consent: "Choose what is known about their consent." } });
    }
  });

  it("an opt-in needs EVIDENCE, in words — and the evidence is stored with it", () => {
    const none = validateNewContact({ email: "a@b.org", consent: "opted_in" });
    expect(none.ok).toBe(false);
    expect(!none.ok && none.errors.evidence).toMatch(/needs the evidence/);

    const short = validateNewContact({ email: "a@b.org", consent: "opted_in", evidence: "yes" });
    expect(short.ok).toBe(false);

    const good = validateNewContact({ email: "a@b.org", consent: "opted_in", evidence: "  Replied yes to the 12 October email  " });
    expect(good).toMatchObject({ ok: true, value: { consent: "opted_in", consentSource: "admin: Replied yes to the 12 October email" } });
  });

  it("evidence is ignored (not stored) unless the contact is being opted in", () => {
    const r = validateNewContact({ email: "a@b.org", consent: "unknown", evidence: "Replied yes to the 12 October email" });
    expect(r.ok && r.value.consentSource).toBeNull();
  });

  it("limits free text and strips control characters", () => {
    const tooLong = validateNewContact({ email: "a@b.org", name: "x".repeat(LIMITS.name + 1), notes: "y".repeat(LIMITS.notes + 1), sourceDetail: "z".repeat(LIMITS.sourceDetail + 1) });
    expect(tooLong.ok).toBe(false);
    expect(!tooLong.ok && Object.keys(tooLong.errors).sort()).toEqual(["name", "notes", "sourceDetail"]);

    const dirty = validateNewContact({ email: "a@b.org", name: "Ja\u0000ne\u0007\nDoe", notes: "line one\r\nline two\u0001" });
    expect(dirty).toMatchObject({ ok: true, value: { name: "Jane Doe", notes: "line one\nline two" } });
  });

  it("empty optional fields become null, not empty strings", () => {
    expect(validateNewContact({ email: "a@b.org", name: "   ", notes: "", sourceDetail: undefined })).toMatchObject({ ok: true, value: { name: null, notes: null, sourceDetail: null } });
  });

  it("reports every problem at once, so a form can show them all", () => {
    const r = validateNewContact({ email: "nope", name: "x".repeat(500), consent: "opted_in" });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["email", "evidence", "name"]);
  });

  it("never throws on junk from the browser", () => {
    for (const email of [null, undefined, 7, {}, [], true]) {
      expect(() => validateNewContact({ email, name: email, notes: email, consent: email, evidence: email })).not.toThrow();
    }
  });
});

describe("validateDetails", () => {
  it("trims, nulls the empty, limits the long", () => {
    expect(validateDetails({ name: " A ", notes: " ", sourceDetail: "x" })).toEqual({ ok: true, value: { name: "A", notes: null, sourceDetail: "x" } });
    expect(validateDetails({ name: "x".repeat(LIMITS.name + 1) })).toEqual({ ok: false, errors: { name: `Keep the name to ${LIMITS.name} characters.` } });
  });
});

describe("planConsentChange — the policy that keeps the list honest", () => {
  it("Suppress works on anyone not already suppressed, and records WHEN", () => {
    for (const marketingConsent of ["opted_in", "unknown", "not_marketing_contact"] as const) {
      expect(planConsentChange(st({ marketingConsent }), { to: "suppress" }, NOW), marketingConsent).toEqual({
        ok: true,
        patch: { marketingConsent: "opted_out", unsubscribed: true, unsubscribedAt: NOW },
      });
    }
  });

  it("a suppression can never be lifted, relabelled or opted back in from here", () => {
    const suppressed = st({ marketingConsent: "opted_out", unsubscribed: true });
    for (const change of [
      { to: "opt_in", evidence: "Replied yes to the 12 October email" },
      { to: "not_marketing_contact" },
      { to: "suppress" },
    ] as const) {
      const r = planConsentChange(suppressed, change, NOW);
      expect(r.ok, change.to).toBe(false);
    }
    const r = planConsentChange(suppressed, { to: "opt_in", evidence: "Replied yes to the 12 October email" }, NOW);
    expect(!r.ok && r.error).toMatch(/Only they can opt back in/);
  });

  it("opting in needs evidence of at least ten characters, and stores it with an 'admin:' prefix and a time", () => {
    const base = st({ marketingConsent: "unknown" });
    for (const evidence of [undefined, "", "  ", "yes", "short", 5, null]) {
      const r = planConsentChange(base, { to: "opt_in", evidence }, NOW);
      expect(r.ok, String(evidence)).toBe(false);
      expect(!r.ok && r.field).toBe("evidence");
    }
    expect(planConsentChange(base, { to: "opt_in", evidence: " Replied yes to the 12 October email " }, NOW)).toEqual({
      ok: true,
      patch: { marketingConsent: "opted_in", consentSource: "admin: Replied yes to the 12 October email", consentAt: NOW },
    });
  });

  it("opting in someone already opted in changes nothing", () => {
    expect(planConsentChange(st({ marketingConsent: "opted_in" }), { to: "opt_in", evidence: "Replied yes to the 12 October email" }, NOW)).toEqual({ ok: false, error: "Already opted in." });
  });

  it("someone who opted in cannot be quietly relabelled 'not a marketing contact' — that is a suppression", () => {
    const r = planConsentChange(st({ marketingConsent: "opted_in" }), { to: "not_marketing_contact" }, NOW);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/use Suppress/);
  });

  it("an unknown contact can be marked 'not a marketing contact'", () => {
    expect(planConsentChange(st({ marketingConsent: "unknown" }), { to: "not_marketing_contact" }, NOW)).toEqual({ ok: true, patch: { marketingConsent: "not_marketing_contact" } });
    expect(planConsentChange(st({ marketingConsent: "not_marketing_contact" }), { to: "not_marketing_contact" }, NOW).ok).toBe(false);
  });

  it("an opted-out contact that is not flagged suppressed can still be suppressed (the flag is what stops a send)", () => {
    expect(planConsentChange(st({ marketingConsent: "opted_out", unsubscribed: false }), { to: "suppress" }, NOW)).toMatchObject({ ok: true });
  });
});

describe("planDelete", () => {
  it("anyone not suppressed can be deleted", () => {
    expect(planDelete({ unsubscribed: false }, { erase: false })).toEqual({ ok: true });
  });

  it("a suppressed contact is deleted only when the admin says to erase the suppression too", () => {
    const refused = planDelete({ unsubscribed: true }, { erase: false });
    expect(refused).toMatchObject({ ok: false, needsErase: true });
    expect(planDelete({ unsubscribed: true }, { erase: true })).toEqual({ ok: true });
  });
});

describe("contactActivity", () => {
  it("reads active / suppressed / not subscribed", () => {
    expect(contactActivity({ marketingConsent: "opted_in", unsubscribed: false })).toBe("active");
    expect(contactActivity({ marketingConsent: "opted_in", unsubscribed: true })).toBe("suppressed");
    expect(contactActivity({ marketingConsent: "opted_out", unsubscribed: false })).toBe("suppressed");
    expect(contactActivity({ marketingConsent: "unknown", unsubscribed: false })).toBe("inactive");
    expect(contactActivity({ marketingConsent: "not_marketing_contact", unsubscribed: false })).toBe("inactive");
    expect(ACTIVITY_LABEL).toEqual({ active: "Active", suppressed: "Suppressed", inactive: "Not subscribed" });
  });
});

describe("misc", () => {
  it("emailProblem has a sentence for every reason", () => {
    for (const r of ["empty", "too-long", "malformed", "disposable"] as const) expect(emailProblem(r).length).toBeGreaterThan(10);
  });

  it("isUuid accepts canonical ids only", () => {
    expect(isUuid("7a5d9f85-6de2-4bb1-aeda-9742fdbfd5bb")).toBe(true);
    expect(isUuid("7A5D9F85-6DE2-4BB1-AEDA-9742FDBFD5BB")).toBe(true);
    for (const bad of ["", "abc", "7a5d9f856de24bb1aeda9742fdbfd5bb", null, undefined, 7, "7a5d9f85-6de2-4bb1-aeda-9742fdbfd5bb "]) expect(isUuid(bad)).toBe(false);
  });
});
