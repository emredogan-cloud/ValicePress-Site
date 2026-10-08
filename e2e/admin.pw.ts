import { createHmac, createHash } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";

import { horizontalOverflow, isMobileProject } from "./helpers";

/**
 * PHASE 10 — the admin area, as an ADMINISTRATOR uses it.
 *
 * These tests need a signed-in administrator, which a test machine cannot be, so
 * they run against a build whose identity check is stubbed in a throw-away copy
 * (`node scripts/e2e/admin-harness.mjs` — read its header for why that is safe).
 * Without that build every test here is SKIPPED, loudly, rather than failing for
 * a reason that is not the code's.
 *
 * They write to the sandbox database: contacts named `qa-<run>.…@e2e-admin.invalid`,
 * all deleted at the end. No email is sent anywhere — the harness blanks every
 * provider key.
 *
 * What is held to account: the dashboard never prints a failure as a zero and
 * never invents a source; the books page cannot edit a book; the email tab can
 * add, edit, suppress, delete, search, filter, export and find duplicates — and
 * REFUSES to subscribe anyone without evidence, to un-suppress anyone, or to
 * delete a suppression record by accident; what an administrator types survives
 * an error; a non-admin is shown nothing; and nothing is wider than a phone.
 */

const STUB = process.env.E2E_ADMIN_STUB === "1";
const RUN = Math.random().toString(36).slice(2, 8);
const mail = (n: string, domain = "e2e-admin.invalid") => `qa-${RUN}.${n}@${domain}`;

test.describe("admin (stub-auth build)", () => {
  test.skip(!STUB, "needs the stub-auth build — run `node scripts/e2e/admin-harness.mjs`");
  // These write rows; the harness runs them one at a time, which keeps the counts readable.

  test.afterAll(async () => {
    if (!STUB || !process.env.DATABASE_URL) return;
    const name = new URL(process.env.DATABASE_URL).pathname;
    if (name !== "/bookstore") return; // never delete anywhere else
    const sql = neon(process.env.DATABASE_URL);
    await sql`delete from contacts where email like ${`qa-${RUN}.%`} or email like ${`qa${RUN}%`}`;
  });

  async function open(page: Page, path: string) {
    await page.goto(path);
    // Forms submit through an `onSubmit` that exists only once React has hydrated.
    await page.waitForLoadState("networkidle");
  }

  async function addContact(page: Page, fields: { email: string; name?: string; consent?: "unknown" | "not_marketing_contact" | "opted_in"; evidence?: string; notes?: string; anyway?: boolean }) {
    await open(page, "/admin/email");
    const form = page.locator("details", { hasText: "Add a contact" });
    if (!(await form.evaluate((d) => (d as HTMLDetailsElement).open))) await form.locator("summary").click();
    await page.getByLabel("Email address").fill(fields.email);
    if (fields.name) await page.getByLabel("Name (optional)").fill(fields.name);
    if (fields.notes) await page.getByLabel("Notes (optional)").fill(fields.notes);
    if (fields.consent === "opted_in") {
      await page.getByLabel(/They agreed to marketing email/).check();
      if (fields.evidence !== undefined) await page.getByLabel(/Evidence they agreed/).fill(fields.evidence);
    } else if (fields.consent === "not_marketing_contact") {
      await page.getByLabel(/Not a marketing contact/).check();
    }
    await page.getByRole("button", { name: fields.anyway ? /add anyway/i : "Add contact" }).click();
  }

  // -------------------------------------------------------------------------
  // the shell
  // -------------------------------------------------------------------------

  test("one shell: six places, the current one marked, each opens its own page", async ({ page }) => {
    await open(page, "/admin");
    const nav = page.getByRole("navigation", { name: "Admin sections" });
    await expect(nav.getByRole("link")).toHaveText(["Overview", "Books", "Email", "Free books", "Reader support", "Site data"]);
    await expect(nav.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");

    const places: Array<[string, string, string]> = [
      ["Books", "/admin/books", "Books"],
      ["Email", "/admin/email", "Email"],
      ["Free books", "/admin/free-books", "Free-ebook requests"],
      ["Reader support", "/admin/support", "Reader support"],
      ["Site data", "/admin/data", "Site data"],
    ];
    for (const [tab, url, h1] of places) {
      await nav.getByRole("link", { name: tab, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${url}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      await expect(nav.getByRole("link", { name: tab, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: "Overview", exact: true })).not.toHaveAttribute("aria-current", "page");
    }
    // there is exactly one <main> and it carries the skip-link target
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("main#main-content")).toHaveCount(1);
  });

  test("a signed-in NON-admin is shown a refusal and nothing else; a signed-out visitor is told to sign in", async ({ page, context, baseURL }) => {
    for (const [mode, title] of [
      ["denied", "Not authorized"],
      ["out", "Sign in required"],
    ] as const) {
      await context.clearCookies();
      await context.addCookies([{ name: "e2e_admin", value: mode, url: baseURL! }]);
      for (const path of ["/admin", "/admin/email", "/admin/books", "/admin/free-books", "/admin/support", "/admin/data"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }), `${mode} ${path}`).toHaveText(title);
        const text = (await page.locator("body").innerText()).toLowerCase();
        expect(text).not.toMatch(/mailable|contacts on file|recent orders|latest signups|free-ebook requests|add a contact|direct revenue/);
        expect(text).not.toMatch(/admin_emails|allowlist|allow-list/);
        await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
      }
      // the export and the API refuse too
      const csv = await page.request.get("/admin/email/export", { maxRedirects: 0 });
      expect(csv.status(), mode).toBe(mode === "out" ? 401 : 403);
      expect(csv.headers()["content-type"] ?? "").not.toMatch(/csv/);
      const api = await page.request.get("/api/admin/events");
      expect(api.status(), mode).toBe(mode === "out" ? 401 : 403);
    }
    await context.clearCookies();
  });

  // -------------------------------------------------------------------------
  // overview
  // -------------------------------------------------------------------------

  test("overview: a source that does not exist says so, a table that is missing says so, and the numbers agree with the rest of the site", async ({ page, request }) => {
    await open(page, "/admin");
    const card = (name: string) => page.locator(`[data-stat="${name}"]`);

    // No sales source for Amazon/KDP: the sentence, not a number.
    await expect(card("Amazon / KDP sales")).toHaveAttribute("data-state", "unavailable");
    await expect(card("Amazon / KDP sales")).toContainText("Sales data unavailable — no connected sales source");
    await expect(card("Page views")).toHaveAttribute("data-state", "unavailable");
    await expect(card("Page views")).toContainText("not recorded in this database");

    // The sandbox has no `analytics_events` table: that is "unavailable", and NOT "0 events".
    const events = card("Funnel events (7 days)");
    await expect(events).toHaveAttribute("data-state", /unavailable|ok/);
    if ((await events.getAttribute("data-state")) === "unavailable") {
      await expect(events).toContainText("has not been created");
    }
    // No card anywhere is in the "error" state on a healthy sandbox.
    await expect(page.locator('[data-state="error"]')).toHaveCount(0);

    // Published titles = the books the public site lists (one sitemap entry each).
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const publicBooks = new Set([...sitemap.matchAll(/<loc>[^<]*\/books\/([^</]+)<\/loc>/g)].map((m) => m[1])).size;
    const published = await card("Published titles").locator("p.font-serif").innerText();
    expect(Number(published.replace(/,/g, ""))).toBe(publicBooks);

    // Featured books: in the pinned order, the draft one marked as not on any shelf.
    const featured = card("Featured books");
    await expect(featured.locator("li").first()).toContainText("Weather Permitting");
    await expect(featured).toContainText(/Ridge Runner|ridge-runner/);
    await expect(featured).toContainText(/draft — not on any shelf|not in the database/);
  });

  test("books: read-only — no form, no edit link, no create, and '$0.00' never appears", async ({ page }) => {
    await open(page, "/admin/books");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Books");
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator('main a[href*="/edit"]')).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
    await expect(page.getByText("Read-only")).toBeVisible();
    const rows = page.locator("tr[data-book]");
    expect(await rows.count()).toBeGreaterThan(30);
    expect(await page.locator("main").innerText()).not.toContain("$0.00");
    // a book this site does not sell reads "Not sold here" and "No"
    const amazonOnly = page.locator('tr[data-book="weather-permitting"]');
    await expect(amazonOnly).toContainText("Not sold here");
    // the draft is listed, and not linked to a public page that does not exist
    const draft = page.locator('tr[data-book="ridge-runner"]');
    await expect(draft).toContainText("draft");
    await expect(draft.locator("a")).toHaveCount(0);
    // the old edit address leads back to this page rather than to a form
    await page.goto("/admin/books/weather-permitting/edit");
    await expect(page).toHaveURL(/\/admin\/books$/);
  });

  // -------------------------------------------------------------------------
  // email
  // -------------------------------------------------------------------------

  test("email: add a contact — it starts NOT subscribed, appears in the list, opens, and is still there after a reload", async ({ page }) => {
    const email = mail("add");
    await addContact(page, { email, name: "QA Person", notes: "likes puzzles" });
    await expect(page.getByRole("status").filter({ hasText: `Added ${email}.` })).toBeVisible();

    await open(page, `/admin/email?q=${encodeURIComponent(email)}`);
    const row = page.locator(`tr[data-contact="${email}"]`);
    await expect(row).toHaveAttribute("data-activity", "inactive");
    await expect(row).toContainText("Not subscribed");
    await expect(row).toContainText("QA Person");

    await row.getByRole("link", { name: email }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(email);
    await expect(page.getByLabel("Name")).toHaveValue("QA Person");
    await expect(page.getByLabel("Notes")).toHaveValue("likes puzzles");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(email);
  });

  test("email: bad input is explained field by field, and what was typed is still there", async ({ page }) => {
    await open(page, "/admin/email");
    await page.locator("details", { hasText: "Add a contact" }).locator("summary").click();
    await page.getByLabel("Email address").fill("not an email");
    await page.getByLabel("Notes (optional)").fill("met at the fair");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("That doesn't look like an email address.")).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveValue("not an email");
    await expect(page.getByLabel("Notes (optional)")).toHaveValue("met at the fair");

    // a disposable-mail address is refused, and said so
    await page.getByLabel("Email address").fill(mail("x", "mailinator.com"));
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText(/throw-away address/)).toBeVisible();
  });

  test("email: the same address twice — in another case — is refused and points at the original", async ({ page }) => {
    const email = mail("dupe");
    await addContact(page, { email });
    await expect(page.getByRole("status")).toContainText(`Added ${email}.`);
    await page.getByLabel("Email address").fill(email.toUpperCase());
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText(`${email} is already in the contact book.`).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the existing contact" })).toBeVisible();
    const { total } = await listCount(page, email);
    expect(total).toBe(1);
  });

  async function listCount(page: Page, q: string) {
    await open(page, `/admin/email?q=${encodeURIComponent(q)}`);
    const total = Number(await page.locator("[data-contacts-total]").first().getAttribute("data-contacts-total"));
    return { total };
  }

  test("email: a Gmail alias of an existing contact is warned about; 'add anyway' adds it; the duplicates report lists both", async ({ page }) => {
    const base = `qa${RUN}alias`;
    await addContact(page, { email: `${base}.one@gmail.com` });
    await expect(page.getByRole("status")).toContainText("Added");
    await page.getByLabel("Email address").fill(`${base}one+books@googlemail.com`);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText(/looks like another address for/i).first()).toBeVisible();
    await page.getByRole("button", { name: /add anyway/i }).click();
    await expect(page.getByRole("status")).toContainText(`Added ${base}one+books@googlemail.com.`);

    await open(page, "/admin/email?view=duplicates");
    const group = page.locator(`[data-duplicate-group="${base}one@gmail.com"]`);
    await expect(group).toBeVisible();
    await expect(group).toContainText(`${base}.one@gmail.com`);
    await expect(group).toContainText(`${base}one+books@googlemail.com`);
    await expect(page.getByText(/nothing is merged or deleted for you/i)).toBeVisible();
  });

  test("email: an opt-in WITHOUT evidence is refused; with evidence it is mailable and the evidence is shown", async ({ page }) => {
    const email = mail("optin");
    await addContact(page, { email, consent: "opted_in" });
    await expect(page.getByText(/needs the evidence/i).first()).toBeVisible();
    await expect(page.getByLabel(/Evidence they agreed/)).toHaveAttribute("aria-invalid", "true");
    expect((await listCount(page, email)).total).toBe(0); // nothing was written

    await addContact(page, { email, consent: "opted_in", evidence: "Replied yes to the 12 October email" });
    await expect(page.getByRole("status")).toContainText(`Added ${email}.`);
    await open(page, `/admin/email?q=${encodeURIComponent(email)}`);
    const row = page.locator(`tr[data-contact="${email}"]`);
    await expect(row).toHaveAttribute("data-activity", "active");
    await expect(row).toContainText("admin: Replied yes to the 12 October email");
  });

  test("email: edit the details — they persist across a reload; the address and consent are not editable here", async ({ page }) => {
    const email = mail("edit");
    await addContact(page, { email, name: "Before" });
    await page.getByRole("link", { name: "Open it" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Before");
    await page.getByLabel("Name").fill("After");
    await page.getByLabel("Where you met them").fill("a book fair");
    await page.getByLabel("Notes").fill("changed");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("After");
    await expect(page.getByLabel("Where you met them")).toHaveValue("a book fair");
    await expect(page.getByLabel("Notes")).toHaveValue("changed");
    // no field for the address
    await expect(page.getByLabel(/^Email/)).toHaveCount(0);
    // too-long text is refused
    await page.getByLabel("Name").fill("x".repeat(200));
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Keep the name to 120 characters.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("After");
  });

  test("email: suppress asks first — and afterwards the person has NO consent controls, and cannot be opted back in", async ({ page }) => {
    const email = mail("suppress");
    await addContact(page, { email, consent: "opted_in", evidence: "Replied yes to the 12 October email" });
    await page.getByRole("link", { name: "Open it" }).click();

    await page.getByRole("button", { name: /Suppress — stop emailing/ }).click();
    await expect(page.getByText("Stop emailing this person?")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Stop emailing this person?")).toHaveCount(0);

    await page.getByRole("button", { name: /Suppress — stop emailing/ }).click();
    await page.getByRole("button", { name: "Yes, suppress" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Suppressed" })).toBeVisible();

    await page.reload();
    await expect(page.locator("[data-consent-locked]")).toContainText("Only they can opt back in");
    await expect(page.getByRole("button", { name: /Suppress|Record opt-in/ })).toHaveCount(0);
    await expect(page.getByLabel(/Record that they agreed/)).toHaveCount(0);

    // the list agrees, and the filter finds them
    await open(page, `/admin/email?q=${encodeURIComponent(email)}&state=suppressed`);
    await expect(page.locator(`tr[data-contact="${email}"]`)).toHaveAttribute("data-activity", "suppressed");
    await open(page, `/admin/email?q=${encodeURIComponent(email)}&state=active`);
    await expect(page.locator(`tr[data-contact="${email}"]`)).toHaveCount(0);
  });

  test("email: record an opt-in from the contact's own page — evidence required", async ({ page }) => {
    const email = mail("late-optin");
    await addContact(page, { email });
    await page.getByRole("link", { name: "Open it" }).click();
    await page.getByLabel(/Record that they agreed/).fill("ok");
    await page.getByRole("button", { name: "Record opt-in" }).click();
    await expect(page.getByText(/needs the evidence/i).first()).toBeVisible();
    await page.getByLabel(/Record that they agreed/).fill("Told me yes at the Izmir book fair");
    await page.getByRole("button", { name: "Record opt-in" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Recorded" })).toBeVisible();
    await page.reload();
    await expect(page.locator("dd", { hasText: "admin: Told me yes at the Izmir book fair" })).toBeVisible();
    await expect(page.locator("[data-activity='active']")).toBeVisible();
  });

  test("email: delete is a question; a suppressed contact needs the explicit 'erase' tick", async ({ page }) => {
    // ordinary contact
    const plain = mail("delete");
    await addContact(page, { email: plain });
    await page.getByRole("link", { name: "Open it" }).click();
    await page.getByRole("button", { name: /Delete this contact/ }).click();
    await expect(page.getByText(/Permanently delete/)).toContainText(plain);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: /Delete this contact/ }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/admin\/email\?deleted=1$/);
    await expect(page.getByRole("status").filter({ hasText: "Contact deleted." })).toBeVisible();
    expect((await listCount(page, plain)).total).toBe(0);

    // suppressed contact
    const gone = mail("erase");
    await addContact(page, { email: gone });
    await page.getByRole("link", { name: "Open it" }).click();
    await page.getByRole("button", { name: /Suppress — stop emailing/ }).click();
    await page.getByRole("button", { name: "Yes, suppress" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Suppressed" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /Delete this contact/ }).click();
    const erase = page.getByRole("checkbox", { name: /erase the suppression record/i });
    await expect(erase).toBeVisible(); // asked for up front
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Tick the box/ })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin/email/[0-9a-f-]{36}$`)); // still here — NOT deleted
    await erase.check();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/admin\/email\?deleted=1$/);
    expect((await listCount(page, gone)).total).toBe(0);
  });

  test("email: search treats % and _ as characters; filters and sorting work; the count is honest", async ({ page }) => {
    await addContact(page, { email: mail("pct%a") });
    await addContact(page, { email: mail("pctXb") });
    const search = async (q: string, extra = "") => {
      await open(page, `/admin/email?q=${encodeURIComponent(q)}${extra}`);
      return page.locator("tr[data-contact]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-contact")));
    };
    expect(await search(`qa-${RUN}.pct%`)).toEqual([mail("pct%a")]);
    expect(await search(`qa-${RUN}.pct_a`)).toEqual([]);
    const sorted = await search(`qa-${RUN}.pct`, "&sort=email");
    expect(sorted).toEqual([...sorted].sort());
    expect(sorted.length).toBe(2);

    // "everyone" can be narrowed by consent, and the page says how many match
    await open(page, `/admin/email?q=qa-${RUN}&consent=opted_in`);
    const optedIn = await page.locator("tr[data-contact]").count();
    await open(page, `/admin/email?q=qa-${RUN}`);
    const all = await page.locator("tr[data-contact]").count();
    expect(all).toBeGreaterThan(optedIn);
    await expect(page.locator("[data-contacts-total]").first()).toHaveAttribute("data-contacts-total", String(all));
  });

  test("email: the CSV export — whole view, consent and evidence travel with the address, formulas are defused, nothing is cached", async ({ page }) => {
    await addContact(page, { email: mail("csv"), name: '=HYPERLINK("http://evil.example","click")', consent: "opted_in", evidence: "Replied yes to the 12 October email", notes: "line one\nline, two \"quoted\"" });
    await expect(page.getByRole("status").filter({ hasText: `Added ${mail("csv")}.` })).toBeVisible();
    const res = await page.request.get(`/admin/email/export?q=${encodeURIComponent(`qa-${RUN}.csv`)}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/csv/);
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="valicepress-contacts-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.headers()["cache-control"]).toMatch(/no-store/);
    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xfeff); // BOM, for Excel
    const [header, row] = body.replace(/^﻿/, "").split("\r\n");
    expect(header).toBe('"email","name","source","source_detail","first_seen","last_seen","purchased","purchase_count","customer_status","marketing_consent","consent_source","consent_at","unsubscribed","notes"');
    expect(row).toContain(`"${mail("csv")}"`);
    expect(row).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`); // defused: leading quote, quotes doubled
    expect(row).toContain('"opted_in"');
    expect(row).toContain('"admin: Replied yes to the 12 October email"');
    // multi-line, comma and quote notes stay inside ONE quoted cell
    expect(row).toContain('"line one\nline, two ""quoted"""');
  });

  test("email: an unsubscribe link reaches the contact book (it used to reach only the mail provider)", async ({ page, request }) => {
    test.skip(!process.env.RESEND_API_KEY, "the harness signs unsubscribe links with a dummy key");
    const email = mail("unsub", "example.org");
    const key = createHash("sha256").update(`valice-unsubscribe-v1\0${process.env.RESEND_API_KEY}`).digest("hex");
    const token = createHmac("sha256", key).update(email).digest("hex").slice(0, 20);
    // the provider is blanked in the harness, so the route answers 503 AFTER recording the suppression locally
    const res = await request.post(`/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`);
    expect([200, 503]).toContain(res.status());
    await open(page, `/admin/email?q=${encodeURIComponent(email)}&state=suppressed`);
    const row = page.locator(`tr[data-contact="${email}"]`);
    await expect(row).toHaveAttribute("data-activity", "suppressed");
    await expect(row).toContainText("unsubscribe");
    // a wrong token records nothing
    const bad = mail("unsub-bad", "example.org");
    const refused = await request.post(`/api/newsletter/unsubscribe?e=${encodeURIComponent(bad)}&t=${"0".repeat(20)}`);
    expect(refused.status()).toBe(400);
    expect((await listCount(page, bad)).total).toBe(0);
  });

  // -------------------------------------------------------------------------
  // free books, support, data
  // -------------------------------------------------------------------------

  test("free books: the queue lives under the shell, with every status, search and an honest note about delivery", async ({ page }) => {
    await open(page, "/admin/free-books");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Free-ebook requests");
    const filters = page.getByRole("group", { name: "Filter by status" });
    await expect(filters.getByRole("link")).toHaveCount(7);
    await expect(filters.getByRole("link", { name: /^sending/ })).toBeVisible();
    // the stale "15-minute link" claim is gone; what is said now is what the code does
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/15-minute/);
    expect(text).toMatch(/up to 20 MB as an attachment/);
    expect(text).toMatch(/secure link that works for 72 hours/);
    const search = page.getByRole("search", { name: "Search requests" });
    await search.getByLabel("Search").fill("nobody-has-this@example.org");
    await search.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=nobody-has-this/);
    await expect(page.getByText(/No pending requests matching/)).toBeVisible();
    // one <main>, one h1
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("reader support and site data open, are labelled, and make no write", async ({ page }) => {
    await open(page, "/admin/support?email=nobody-has-this@example.org");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reader support");
    await expect(page.locator("main")).toHaveCount(1);
    await open(page, "/admin/data?days=30");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site data");
    await expect(page.getByRole("link", { name: "Last 30 days" })).toHaveAttribute("aria-current", "true");
    await expect(page.locator('[data-stat="Page views"]')).toHaveAttribute("data-state", "unavailable");
  });

  // -------------------------------------------------------------------------
  // phones
  // -------------------------------------------------------------------------

  test("on a phone, no admin page is wider than the screen and the controls are touchable", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "phone layouts");
    for (const width of [320, 360, 393]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/admin", "/admin/books", "/admin/email", "/admin/email?view=duplicates", "/admin/free-books", "/admin/support", "/admin/data"]) {
        await open(page, path);
        expect(await horizontalOverflow(page), `${width}px ${path}`).toBeLessThanOrEqual(0);
        for (const link of await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link").all()) {
          const box = (await link.boundingBox())!;
          expect(box.height, `${path}: nav link height`).toBeGreaterThanOrEqual(43.5);
        }
      }
    }
  });
});
