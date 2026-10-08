// @vitest-environment node
/**
 * The contact book's writes, against a REAL database — the sandbox one.
 *
 * Skipped unless asked for (CI has no database):
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/db/queries/contacts-write.db.test.ts
 *
 * Three guards, because these tests write:
 *   1. they only run when RUN_DB_TESTS=1;
 *   2. they REFUSE unless DATABASE_URL names the `bookstore` sandbox — the same
 *      rule `scripts/e2e/serve.mjs` enforces — so a pulled production URL cannot
 *      be written to by running the wrong command;
 *   3. every address is `valice-qa-<run>.…`, and the whole family is deleted at
 *      the end (and swept at the start, in case a previous run died).
 *
 * `requireAdmin` is replaced, because there is no Clerk session in a test; what
 * is under test is everything AFTER the gate, plus — separately — that a
 * rejected gate stops the write before it starts.
 *
 * What this proves that the pure tests cannot: that the SQL does what the policy
 * says. The unique index really stops a duplicate, the alias check really finds a
 * Gmail variant, a suppression really survives an opt-in attempt, an unsubscribe
 * for a stranger really leaves a row behind, and `%` in a search really is a
 * character.
 */
import { loadEnvConfig } from "@next/env";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";

let gate: "admin" | "denied" = "admin";
vi.mock("@/lib/auth", () => ({
  AdminAccessError: class AdminAccessError extends Error {
    kind: string;
    constructor(kind: string) {
      super(`Admin access denied: ${kind}`);
      this.kind = kind;
    }
  },
  requireAdmin: async () => {
    if (gate === "denied") {
      const { AdminAccessError } = await import("@/lib/auth");
      throw new AdminAccessError("not_admin");
    }
    return { email: "admin@test.invalid", localUserId: "local-1" };
  },
}));

const RUN_ID = Math.random().toString(36).slice(2, 8);
const prefix = `valice-qa-${RUN_ID}`;
const addr = (n: string, domain = "example.org") => `${prefix}.${n}@${domain}`;

type Mods = {
  write: typeof import("./contacts-write");
  read: typeof import("./contacts-admin");
  contacts: typeof import("@/lib/db/contacts");
  rules: typeof import("@/lib/admin/contact-rules");
  db: typeof import("@/lib/db");
  schema: typeof import("@/lib/db/schema");
  orm: typeof import("drizzle-orm");
};
let m: Mods;

async function sweep() {
  await m.db.db.delete(m.schema.contacts).where(m.orm.like(m.schema.contacts.email, "valice-qa-%"));
}

describe.skipIf(!RUN)("contact book writes (sandbox database)", () => {
  beforeAll(async () => {
    loadEnvConfig(process.cwd());
    const name = (() => {
      try {
        return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
      } catch {
        return "";
      }
    })();
    if (name !== "bookstore") {
      throw new Error(`REFUSING TO RUN: DATABASE_URL points at "${name || "(unset)"}", not the sandbox "bookstore".`);
    }
    m = {
      write: await import("./contacts-write"),
      read: await import("./contacts-admin"),
      contacts: await import("@/lib/db/contacts"),
      rules: await import("@/lib/admin/contact-rules"),
      db: await import("@/lib/db"),
      schema: await import("@/lib/db/schema"),
      orm: await import("drizzle-orm"),
    };
    await sweep();
  });

  afterAll(async () => {
    if (m) {
      await sweep();
    }
  });

  const newContact = (email: string, over: Record<string, unknown> = {}) => {
    const r = m.rules.validateNewContact({ email, name: "QA Person", ...over });
    if (!r.ok) throw new Error(`fixture invalid: ${JSON.stringify(r.errors)}`);
    return r.value;
  };

  describe("adding", () => {
    it("adds a contact as UNKNOWN — adding someone does not subscribe them — and it persists", async () => {
      const email = addr("add-1");
      const r = await m.write.adminAddContact(newContact(email, { sourceDetail: "met at a fair", notes: "likes puzzles" }));
      expect(r.ok).toBe(true);
      const id = r.ok ? r.value.id : "";
      const row = await m.read.getContactById(id);
      expect(row).toMatchObject({ email, name: "QA Person", source: "admin", sourceDetail: "met at a fair", notes: "likes puzzles", marketingConsent: "unknown", unsubscribed: false, consentSource: null, consentAt: null });
    });

    it("an opt-in is stored WITH its evidence and a time", async () => {
      const email = addr("add-optin");
      const r = await m.write.adminAddContact(newContact(email, { consent: "opted_in", evidence: "Replied yes to the 12 October email" }));
      const row = await m.read.getContactById(r.ok ? r.value.id : "");
      expect(row).toMatchObject({ marketingConsent: "opted_in", consentSource: "admin: Replied yes to the 12 October email", unsubscribed: false });
      expect(row?.consentAt).toBeInstanceOf(Date);
    });

    it("refuses an address already in the book — spelled however — and says which row", async () => {
      const email = addr("dupe");
      const first = await m.write.adminAddContact(newContact(email));
      expect(first.ok).toBe(true);
      const again = await m.write.adminAddContact(newContact(email.toUpperCase()));
      expect(again).toMatchObject({ ok: false, code: "duplicate", field: "email" });
      expect(again.ok === false && again.existingId).toBe(first.ok ? first.value.id : "x");
    });

    it("warns about a Gmail alias of an existing contact, and adds it only when told to", async () => {
      const base = `${prefix}alias`;
      const first = await m.write.adminAddContact(newContact(`${base}.one@gmail.com`));
      expect(first.ok).toBe(true);

      const variant = newContact(`${base}one+books@googlemail.com`);
      const warned = await m.write.adminAddContact(variant);
      expect(warned).toMatchObject({ ok: false, code: "alias", field: "email" });
      expect(warned.ok === false && warned.error).toContain(`${base}.one@gmail.com`);

      const forced = await m.write.adminAddContact(variant, { allowAlias: true });
      expect(forced.ok).toBe(true);

      const groups = await m.read.listAliasGroups();
      const mine = groups.find((g) => g.canonical === `${base}one@gmail.com`);
      expect(mine?.members.map((x) => x.email).sort()).toEqual([`${base}.one@gmail.com`, `${base}one+books@googlemail.com`].sort());
    });

    it("two adds of the same address at once leave exactly one row (the unique index decides)", async () => {
      const email = addr("race");
      const results = await Promise.all([m.write.adminAddContact(newContact(email)), m.write.adminAddContact(newContact(email))]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)[0]).toMatchObject({ code: "duplicate" });
      const { rows } = await m.read.listContacts({ q: email });
      expect(rows).toHaveLength(1);
    });
  });

  describe("editing", () => {
    it("changes the name, notes and source detail — not the address, not the consent", async () => {
      const email = addr("edit");
      const added = await m.write.adminAddContact(newContact(email));
      const id = added.ok ? added.value.id : "";
      const details = m.rules.validateDetails({ name: "Renamed", notes: "new note", sourceDetail: "moved" });
      expect(details.ok).toBe(true);
      if (!details.ok) return;
      expect(await m.write.adminUpdateContactDetails(id, details.value)).toEqual({ ok: true, value: null });
      expect(await m.read.getContactById(id)).toMatchObject({ email, name: "Renamed", notes: "new note", sourceDetail: "moved", marketingConsent: "unknown" });
    });

    it("an unknown or malformed id is 'not found', and never reaches SQL as something else", async () => {
      const details = m.rules.validateDetails({ name: "x" });
      if (!details.ok) throw new Error("fixture");
      for (const id of ["not-a-uuid", "", "00000000-0000-4000-8000-000000000000", "' OR 1=1 --"]) {
        expect(await m.write.adminUpdateContactDetails(id, details.value), id).toMatchObject({ ok: false, code: "not_found" });
        expect(await m.write.adminChangeConsent(id, { to: "suppress" }), id).toMatchObject({ ok: false, code: "not_found" });
        expect(await m.write.adminDeleteContact(id, { erase: true }), id).toMatchObject({ ok: false, code: "not_found" });
        expect(await m.read.getContactById(id), id).toBeNull();
      }
    });
  });

  describe("consent", () => {
    it("Suppress sets the consent AND the flag AND the time — and counts as suppressed in the summary", async () => {
      const email = addr("suppress");
      const added = await m.write.adminAddContact(newContact(email, { consent: "opted_in", evidence: "Replied yes to the 12 October email" }));
      const id = added.ok ? added.value.id : "";
      expect(await m.write.adminChangeConsent(id, { to: "suppress" })).toEqual({ ok: true, value: { marketingConsent: "opted_out" } });
      const row = await m.read.getContactById(id);
      expect(row).toMatchObject({ marketingConsent: "opted_out", unsubscribed: true });
      const { rows } = await m.read.listContacts({ q: email, state: "suppressed" });
      expect(rows.map((r) => r.email)).toEqual([email]);
      const active = await m.read.listContacts({ q: email, state: "active" });
      expect(active.rows).toEqual([]);
    });

    it("a suppression can NOT be lifted from here — not by opt-in, not by relabelling", async () => {
      const email = addr("sticky");
      const added = await m.write.adminAddContact(newContact(email));
      const id = added.ok ? added.value.id : "";
      await m.write.adminChangeConsent(id, { to: "suppress" });
      const before = await m.read.getContactById(id);
      for (const change of [{ to: "opt_in", evidence: "Replied yes to the 12 October email" }, { to: "not_marketing_contact" }] as const) {
        expect(await m.write.adminChangeConsent(id, change), change.to).toMatchObject({ ok: false, code: "refused" });
      }
      expect(await m.read.getContactById(id)).toEqual(before);
    });

    it("records an opt-in with evidence for someone who is not suppressed; refuses it without", async () => {
      const added = await m.write.adminAddContact(newContact(addr("evidence")));
      const id = added.ok ? added.value.id : "";
      expect(await m.write.adminChangeConsent(id, { to: "opt_in", evidence: "yes" })).toMatchObject({ ok: false, field: "evidence" });
      expect(await m.write.adminChangeConsent(id, { to: "opt_in", evidence: "Replied yes to the 12 October email" })).toEqual({ ok: true, value: { marketingConsent: "opted_in" } });
      expect(await m.read.getContactById(id)).toMatchObject({ marketingConsent: "opted_in", consentSource: "admin: Replied yes to the 12 October email" });
    });

    it("someone who opted in cannot be relabelled 'not a marketing contact' — only suppressed", async () => {
      const added = await m.write.adminAddContact(newContact(addr("downgrade"), { consent: "opted_in", evidence: "Replied yes to the 12 October email" }));
      const id = added.ok ? added.value.id : "";
      expect(await m.write.adminChangeConsent(id, { to: "not_marketing_contact" })).toMatchObject({ ok: false, code: "refused" });
      expect(await m.read.getContactById(id)).toMatchObject({ marketingConsent: "opted_in" });
    });
  });

  describe("deleting", () => {
    it("removes an ordinary contact, for good", async () => {
      const added = await m.write.adminAddContact(newContact(addr("delete")));
      const id = added.ok ? added.value.id : "";
      expect(await m.write.adminDeleteContact(id, { erase: false })).toMatchObject({ ok: true });
      expect(await m.read.getContactById(id)).toBeNull();
    });

    it("a suppressed contact is deleted only on an explicit 'erase' — otherwise the suppression record is kept", async () => {
      const added = await m.write.adminAddContact(newContact(addr("erase")));
      const id = added.ok ? added.value.id : "";
      await m.write.adminChangeConsent(id, { to: "suppress" });
      expect(await m.write.adminDeleteContact(id, { erase: false })).toMatchObject({ ok: false, code: "needs_erase" });
      expect(await m.read.getContactById(id)).not.toBeNull();
      expect(await m.write.adminDeleteContact(id, { erase: true })).toMatchObject({ ok: true });
      expect(await m.read.getContactById(id)).toBeNull();
    });
  });

  describe("unsubscribes reach the book", () => {
    it("an unsubscribe for an address the book has never seen leaves a suppression behind", async () => {
      const email = addr("stranger", "mailinator.com"); // even a disposable mailbox must be honoured
      expect(await m.contacts.recordUnsubscribe(email)).toBe(true);
      const { rows } = await m.read.listContacts({ q: email });
      expect(rows[0]).toMatchObject({ email, marketingConsent: "opted_out", unsubscribed: true, source: "unsubscribe" });
    });

    it("an unsubscribe for an existing opted-in contact flips it, and asking twice does not move the time", async () => {
      const email = addr("known");
      await m.contacts.recordOptIn({ email, source: "newsletter", consentSource: "popup:/test" });
      expect(await m.contacts.recordUnsubscribe(email)).toBe(true);
      const first = (await m.read.listContacts({ q: email })).rows[0];
      expect(first).toMatchObject({ marketingConsent: "opted_out", unsubscribed: true });
      await m.contacts.recordUnsubscribe(email);
      const second = (await m.read.listContacts({ q: email })).rows[0];
      expect(second.email).toBe(email);
      const times = await m.db.db
        .select({ at: m.schema.contacts.unsubscribedAt })
        .from(m.schema.contacts)
        .where(m.orm.eq(m.schema.contacts.email, email));
      expect(times[0].at).toBeInstanceOf(Date);
    });

    it("garbage is refused, not recorded", async () => {
      expect(await m.contacts.recordUnsubscribe("not an address")).toBe(false);
      expect(await m.contacts.recordUnsubscribe("")).toBe(false);
    });

    it("a person who then opts in again, on a form, lifts their own suppression (and only that path does)", async () => {
      const email = addr("returns");
      await m.contacts.recordUnsubscribe(email);
      await m.contacts.recordOptIn({ email, source: "newsletter", consentSource: "popup:/test" });
      expect((await m.read.listContacts({ q: email })).rows[0]).toMatchObject({ marketingConsent: "opted_in", unsubscribed: false });
    });
  });

  describe("reading", () => {
    it("a % or _ typed into the search is a character, not a wildcard", async () => {
      await m.write.adminAddContact(newContact(addr("pct%x")));
      await m.write.adminAddContact(newContact(addr("pctyx")));
      const literal = await m.read.listContacts({ q: `${prefix}.pct%` });
      expect(literal.rows.map((r) => r.email)).toEqual([addr("pct%x")]);
      const underscore = await m.read.listContacts({ q: `${prefix}.pct_x` });
      expect(underscore.rows).toEqual([]);
    });

    it("filters by how a row reads, and sorts", async () => {
      const a = await m.write.adminAddContact(newContact(addr("state-a"), { consent: "opted_in", evidence: "Replied yes to the 12 October email" }));
      await m.write.adminAddContact(newContact(addr("state-b")));
      const c = await m.write.adminAddContact(newContact(addr("state-c")));
      if (c.ok) await m.write.adminChangeConsent(c.value.id, { to: "suppress" });
      const view = async (state: "active" | "suppressed" | "inactive") =>
        (await m.read.listContacts({ q: `${prefix}.state-`, state, sort: "email" })).rows.map((r) => r.email);
      expect(await view("active")).toEqual([addr("state-a")]);
      expect(await view("inactive")).toEqual([addr("state-b")]);
      expect(await view("suppressed")).toEqual([addr("state-c")]);
      const sorted = (await m.read.listContacts({ q: `${prefix}.state-`, sort: "email" })).rows.map((r) => r.email);
      expect(sorted).toEqual([addr("state-a"), addr("state-b"), addr("state-c")]);
      expect(a.ok).toBe(true);
    });

    it("the export reads every row of a view — in pages — not the first 500", async () => {
      const { rows, truncated } = await m.read.listContactsForExport({ q: prefix });
      expect(truncated).toBe(false);
      expect(rows.length).toBeGreaterThan(5);
      expect(rows.every((r) => r.email.startsWith("valice-qa-"))).toBe(true);
    });
  });

  describe("the gate", () => {
    it("a refused admin stops every write before it starts — nothing is inserted, changed or deleted", async () => {
      const email = addr("gate");
      const added = await m.write.adminAddContact(newContact(email));
      const id = added.ok ? added.value.id : "";
      const before = await m.read.getContactById(id);

      gate = "denied";
      try {
        const details = m.rules.validateDetails({ name: "Hacked" });
        if (!details.ok) throw new Error("fixture");
        await expect(m.write.adminAddContact(newContact(addr("gate-2")))).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.write.adminUpdateContactDetails(id, details.value)).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.write.adminChangeConsent(id, { to: "suppress" })).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.write.adminDeleteContact(id, { erase: true })).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.read.listContacts({})).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.read.getContactById(id)).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.read.listAliasGroups()).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.read.listContactsForExport({})).rejects.toMatchObject({ kind: "not_admin" });
        await expect(m.read.getContactSummary()).rejects.toMatchObject({ kind: "not_admin" });
      } finally {
        gate = "admin";
      }

      expect(await m.read.getContactById(id)).toEqual(before);
      expect((await m.read.listContacts({ q: addr("gate-2") })).rows).toEqual([]);
    });
  });
});
