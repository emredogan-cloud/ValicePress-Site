/**
 * The admin's email actions, with the gate and the database replaced.
 *
 * What is held to account here is the ORDER and the SHAPE of what an action
 * does: it asks the gate before it reads a field; it validates before it writes;
 * it never lets a database error — or the SQL in it — reach the browser; it
 * revalidates what it changed; and a successful delete really does redirect
 * (`redirect` works by throwing, and a `catch` that swallowed it would leave the
 * operator on a page for a contact that no longer exists).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminActionDenial = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/admin/context", () => ({ adminActionDenial: () => adminActionDenial() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

class RedirectSignal extends Error {
  constructor(public to: string) {
    super(`NEXT_REDIRECT ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

const write = vi.hoisted(() => ({
  adminAddContact: vi.fn(),
  adminUpdateContactDetails: vi.fn(),
  adminChangeConsent: vi.fn(),
  adminDeleteContact: vi.fn(),
}));
vi.mock("@/lib/db/queries/contacts-write", () => write);
vi.mock("@/lib/auth", () => ({
  AdminAccessError: class AdminAccessError extends Error {
    kind = "not_admin";
  },
}));

import { AdminAccessError } from "@/lib/auth";

import {
  addContactAction,
  deleteContactAction,
  markNotMarketingAction,
  optInContactAction,
  suppressContactAction,
  updateDetailsAction,
  type EmailActionState,
} from "./actions";

const ID = "7a5d9f85-6de2-4bb1-aeda-9742fdbfd5bb";
const IDLE: EmailActionState = { status: "idle" };
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  adminActionDenial.mockReset().mockResolvedValue(null);
  revalidatePath.mockReset();
  for (const fn of Object.values(write)) fn.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("every action asks the gate FIRST, and a refusal changes nothing", () => {
  const cases: Array<[string, (f: FormData) => Promise<EmailActionState>, Record<string, string>]> = [
    ["add", (f) => addContactAction(IDLE, f), { email: "a@b.org" }],
    ["update", (f) => updateDetailsAction(IDLE, f), { id: ID, name: "x" }],
    ["suppress", (f) => suppressContactAction(IDLE, f), { id: ID }],
    ["opt-in", (f) => optInContactAction(IDLE, f), { id: ID, evidence: "Replied yes to the 12 October email" }],
    ["not-marketing", (f) => markNotMarketingAction(IDLE, f), { id: ID }],
    ["delete", (f) => deleteContactAction(IDLE, f), { id: ID, erase: "on" }],
  ];

  it.each(cases)("%s", async (_name, run, fields) => {
    adminActionDenial.mockResolvedValue("You are not authorized to do that.");
    const result = await run(form(fields));
    expect(result).toEqual({ status: "error", error: "You are not authorized to do that." });
    for (const fn of Object.values(write)) expect(fn).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("addContactAction", () => {
  const good = { email: "  Jane@Example.org ", name: "Jane", consent: "unknown" };

  it("validates BEFORE writing — and reports every field problem", async () => {
    const r = await addContactAction(IDLE, form({ email: "nope", consent: "opted_in" }));
    expect(r).toMatchObject({ status: "error", errors: { email: expect.any(String), evidence: expect.any(String) } });
    expect(write.adminAddContact).not.toHaveBeenCalled();
  });

  it("passes the VALIDATED value on, adds as unknown by default, and revalidates the list and the overview", async () => {
    write.adminAddContact.mockResolvedValue({ ok: true, value: { id: ID, email: "jane@example.org" } });
    const r = await addContactAction(IDLE, form(good));
    expect(r).toEqual({ status: "ok", message: "Added jane@example.org.", id: ID });
    expect(write.adminAddContact).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.org", emailRaw: "Jane@Example.org", consent: "unknown", consentSource: null }),
      { allowAlias: false },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/email");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("allowAlias is true ONLY for the explicit 'add anyway' button", async () => {
    write.adminAddContact.mockResolvedValue({ ok: true, value: { id: ID, email: "jane@example.org" } });
    await addContactAction(IDLE, form({ ...good, allowAlias: "on" }));
    expect(write.adminAddContact).toHaveBeenLastCalledWith(expect.anything(), { allowAlias: true });
    await addContactAction(IDLE, form({ ...good, allowAlias: "true" }));
    expect(write.adminAddContact).toHaveBeenLastCalledWith(expect.anything(), { allowAlias: false });
  });

  it("a duplicate comes back as a field error on the email, with the existing row", async () => {
    write.adminAddContact.mockResolvedValue({ ok: false, code: "duplicate", field: "email", existingId: ID, error: "jane@example.org is already in the contact book." });
    const r = await addContactAction(IDLE, form(good));
    expect(r).toEqual({ status: "error", error: "jane@example.org is already in the contact book.", errors: { email: "jane@example.org is already in the contact book." }, existingId: ID });
  });

  it("an alias may be forced — the form is told so", async () => {
    write.adminAddContact.mockResolvedValue({ ok: false, code: "alias", field: "email", existingId: ID, error: "That looks like another address for x@gmail.com…" });
    const r = await addContactAction(IDLE, form(good));
    expect(r).toMatchObject({ status: "error", canForce: true, existingId: ID });
  });

  it("an opt-in carries its evidence through, stored with the 'admin:' prefix", async () => {
    write.adminAddContact.mockResolvedValue({ ok: true, value: { id: ID, email: "jane@example.org" } });
    await addContactAction(IDLE, form({ ...good, consent: "opted_in", evidence: "Replied yes to the 12 October email" }));
    expect(write.adminAddContact).toHaveBeenCalledWith(expect.objectContaining({ consent: "opted_in", consentSource: "admin: Replied yes to the 12 October email" }), expect.anything());
  });

  it("a database failure is one calm sentence — no SQL, no parameters, no address", async () => {
    const driver = Object.assign(new Error("deadlock detected"), { name: "NeonDbError", code: "40P01" });
    write.adminAddContact.mockRejectedValue(Object.assign(new Error('Failed query: insert into "contacts" … params: jane@example.org'), { cause: driver }));
    const r = await addContactAction(IDLE, form(good));
    expect(r.status).toBe("error");
    expect(JSON.stringify(r)).not.toMatch(/insert into|params|jane@example|deadlock|contacts/i);
    expect(revalidatePath).not.toHaveBeenCalled();
    const logged = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("NeonDbError 40P01: deadlock detected");
    expect(logged).not.toMatch(/insert into|params|jane@example/i);
  });

  it("an access failure thrown from the query layer is a refusal, not a 'went wrong'", async () => {
    write.adminAddContact.mockRejectedValue(new AdminAccessError("not_admin"));
    expect(await addContactAction(IDLE, form(good))).toEqual({ status: "error", error: "You are not authorized to do that." });
  });
});

describe("updateDetailsAction", () => {
  it("validates, writes name/notes/source detail only, and revalidates that contact's page", async () => {
    write.adminUpdateContactDetails.mockResolvedValue({ ok: true, value: null });
    const r = await updateDetailsAction(IDLE, form({ id: ID, name: " Jane ", notes: "", sourceDetail: "fair" }));
    expect(r).toEqual({ status: "ok", message: "Saved." });
    expect(write.adminUpdateContactDetails).toHaveBeenCalledWith(ID, { name: "Jane", notes: null, sourceDetail: "fair" });
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/email/${ID}`);
  });

  it("refuses over-long text without calling the database", async () => {
    const r = await updateDetailsAction(IDLE, form({ id: ID, name: "x".repeat(500) }));
    expect(r).toMatchObject({ status: "error", errors: { name: expect.any(String) } });
    expect(write.adminUpdateContactDetails).not.toHaveBeenCalled();
  });

  it("a vanished contact is said plainly", async () => {
    write.adminUpdateContactDetails.mockResolvedValue({ ok: false, code: "not_found", error: "That contact no longer exists. Reload the list." });
    expect(await updateDetailsAction(IDLE, form({ id: ID, name: "x" }))).toMatchObject({ status: "error", error: "That contact no longer exists. Reload the list." });
  });
});

describe("consent actions", () => {
  it("suppress asks the query layer to suppress, and says so", async () => {
    write.adminChangeConsent.mockResolvedValue({ ok: true, value: { marketingConsent: "opted_out" } });
    const r = await suppressContactAction(IDLE, form({ id: ID }));
    expect(r).toEqual({ status: "ok", message: "Suppressed. They will not be emailed." });
    expect(write.adminChangeConsent).toHaveBeenCalledWith(ID, { to: "suppress" });
  });

  it("opt-in passes the evidence THROUGH untouched (the policy judges it), and a refusal lands on the evidence field", async () => {
    write.adminChangeConsent.mockResolvedValue({ ok: false, code: "refused", field: "evidence", error: "Opting someone in needs the evidence…" });
    const r = await optInContactAction(IDLE, form({ id: ID, evidence: "yes" }));
    expect(write.adminChangeConsent).toHaveBeenCalledWith(ID, { to: "opt_in", evidence: "yes" });
    expect(r).toMatchObject({ status: "error", errors: { evidence: "Opting someone in needs the evidence…" } });
  });

  it("a refusal to lift a suppression is shown, not hidden", async () => {
    write.adminChangeConsent.mockResolvedValue({ ok: false, code: "refused", error: "This person has unsubscribed. Only they can opt back in…" });
    const r = await optInContactAction(IDLE, form({ id: ID, evidence: "Replied yes to the 12 October email" }));
    expect(r).toMatchObject({ status: "error", error: expect.stringContaining("Only they can opt back in") });
  });

  it("'mark as not a marketing contact' maps to its own change", async () => {
    write.adminChangeConsent.mockResolvedValue({ ok: true, value: { marketingConsent: "not_marketing_contact" } });
    await markNotMarketingAction(IDLE, form({ id: ID }));
    expect(write.adminChangeConsent).toHaveBeenCalledWith(ID, { to: "not_marketing_contact" });
  });

  it("a contact changed under the admin's hands says so", async () => {
    write.adminChangeConsent.mockResolvedValue({ ok: false, code: "changed", error: "This contact changed while you were looking at it…" });
    expect(await suppressContactAction(IDLE, form({ id: ID }))).toMatchObject({ status: "error", error: expect.stringContaining("changed while you were looking") });
  });
});

describe("deleteContactAction", () => {
  it("a successful delete revalidates and REDIRECTS — the redirect is not swallowed", async () => {
    write.adminDeleteContact.mockResolvedValue({ ok: true, value: { email: "jane@example.org" } });
    await expect(deleteContactAction(IDLE, form({ id: ID }))).rejects.toMatchObject({ to: "/admin/email?deleted=1" });
    expect(write.adminDeleteContact).toHaveBeenCalledWith(ID, { erase: false });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/email");
  });

  it("erase is true only when the box was ticked", async () => {
    write.adminDeleteContact.mockResolvedValue({ ok: true, value: { email: "x" } });
    await deleteContactAction(IDLE, form({ id: ID, erase: "on" })).catch(() => {});
    expect(write.adminDeleteContact).toHaveBeenLastCalledWith(ID, { erase: true });
    await deleteContactAction(IDLE, form({ id: ID, erase: "yes" })).catch(() => {});
    expect(write.adminDeleteContact).toHaveBeenLastCalledWith(ID, { erase: false });
  });

  it("deleting a suppressed contact without 'erase' stays on the page with the explanation — and does not redirect", async () => {
    write.adminDeleteContact.mockResolvedValue({ ok: false, code: "needs_erase", error: "This person unsubscribed… Tick the box to erase them completely." });
    const r = await deleteContactAction(IDLE, form({ id: ID }));
    expect(r).toMatchObject({ status: "error", error: expect.stringContaining("Tick the box") });
  });

  it("a failure is a calm sentence and no redirect", async () => {
    write.adminDeleteContact.mockRejectedValue(new Error("boom"));
    const r = await deleteContactAction(IDLE, form({ id: ID }));
    expect(r.status).toBe("error");
  });
});
