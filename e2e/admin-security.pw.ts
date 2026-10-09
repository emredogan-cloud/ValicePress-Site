import { expect, test } from "@playwright/test";

/**
 * PHASE 10 — the admin area, as a STRANGER meets it.
 *
 * No session, no cookie, no token: the one visitor who must learn nothing. Three
 * things are checked for every admin address — a page, an API, a file download, a
 * server-action POST: that the answer is a refusal or a trip to the sign-in page,
 * that the body carries none of the admin area's content, and that nothing is
 * cached. (What an ADMIN can do is in `admin.pw.ts`, which needs the stub-auth
 * build; see `scripts/e2e/admin-harness.mjs`.)
 *
 * It runs against whatever `E2E_BASE_URL` points at, and it only READS — so it is
 * safe to aim at a preview deployment.
 */

const CONTACT_ID = "7a5d9f85-6de2-4bb1-aeda-9742fdbfd5bb";

const PAGES = [
  "/admin",
  "/admin/books",
  "/admin/email",
  `/admin/email/${CONTACT_ID}`,
  "/admin/email?q=a&state=active&page=2",
  "/admin/email?view=duplicates",
  "/admin/free-books",
  "/admin/free-books?status=all&q=a",
  "/admin/support",
  "/admin/support?email=reader@example.com",
  "/admin/data",
  "/admin/data?days=90",
];

/** Words that appear only on the admin pages' own content — never in a sign-in redirect or a 404. */
const ADMIN_CONTENT = /Mailable|Contacts on file|Known contacts|Recent orders|Latest signups|Free-ebook requests|Direct revenue|Reader support|Possible duplicates|valice-catalog\.mjs/i;

const isSignInOrRefusal = (status: number, location?: string) =>
  (status >= 300 && status < 400 && /sign-in|accounts\.|login/i.test(location ?? "")) || [401, 403, 404].includes(status);

test.describe("anonymous visitors", () => {
  for (const path of PAGES) {
    test(`GET ${path} → sign-in or a refusal, and no admin content`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(isSignInOrRefusal(res.status(), res.headers()["location"]), `${res.status()} → ${res.headers()["location"]}`).toBe(true);
      expect(await res.text()).not.toMatch(ADMIN_CONTENT);
      // A cached copy of a refusal is harmless; of the page it refused is not.
      expect(res.headers()["x-nextjs-cache"] ?? "").not.toMatch(/HIT/i);
    });
  }

  test("the contact export is not a file anyone can fetch", async ({ request }) => {
    for (const path of ["/admin/email/export", "/admin/email/export?state=active&q=a"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(isSignInOrRefusal(res.status(), res.headers()["location"]), path).toBe(true);
      expect(res.headers()["content-type"] ?? "").not.toMatch(/text\/csv/);
      expect(res.headers()["content-disposition"] ?? "").toBe("");
      expect(await res.text()).not.toMatch(/marketing_consent|consent_source|"email"/);
    }
  });

  test("the old addresses lead INTO the new admin area, not to a leak or a 404 on a bookmark", async ({ request }) => {
    const cases: Array<[string, RegExp]> = [
      ["/admin/contacts", /\/admin\/email$/],
      ["/admin/contacts?q=jane&consent=opted_in", /\/admin\/email\?q=jane&consent=opted_in$/],
      ["/admin/contacts/export?state=active", /\/admin\/email\/export\?state=active$/],
      ["/admin/books/weather-permitting/edit", /\/admin\/books$/],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect([307, 308], from).toContain(res.status());
      expect(res.headers()["location"], from).toMatch(to);
    }
  });

  test("a server action cannot be POSTed to an admin page — the proxy stops it before any action runs", async ({ request }) => {
    for (const path of ["/admin/email", `/admin/email/${CONTACT_ID}`, "/admin/free-books"]) {
      const res = await request.post(path, {
        headers: { "next-action": "0".repeat(40), "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" },
        data: "[]",
        maxRedirects: 0,
      });
      expect(res.status(), path).not.toBe(200);
      expect(isSignInOrRefusal(res.status(), res.headers()["location"]), `${path}: ${res.status()}`).toBe(true);
    }
  });
});

test.describe("the admin API, anonymously", () => {
  const ENDPOINTS = ["/api/admin/events", "/api/admin/events?days=90", "/api/admin/storage-check", "/api/admin/fulfillment-check", "/api/admin/email-check", "/api/admin/sentry-check", "/api/admin/sentry-check?emit=1"];

  for (const path of ENDPOINTS) {
    test(`GET ${path} → 401/403, JSON, uncacheable, nothing about the configuration`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([401, 403], path).toContain(res.status());
      expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/);
      expect(res.headers()["cache-control"] ?? "").toMatch(/no-store/);
      const body = await res.text();
      expect(JSON.parse(body)).toMatchObject({ ok: false });
      expect(body).not.toMatch(/ADMIN_EMAILS|OPS_DIAG_TOKEN|DATABASE_URL|CLERK|R2_|RESEND|SENTRY|@|bucket|stack/i);
    });
  }

  test("a WRONG bearer token is no better than none — and a cross-site request with one is still refused", async ({ request }) => {
    const attempts: Array<Record<string, string>> = [
      { authorization: "Bearer not-the-token" },
      { authorization: `Bearer ${"a".repeat(40)}` },
      { authorization: "Bearer " },
      { authorization: "Basic YWRtaW46YWRtaW4=" },
      { authorization: `Bearer ${"a".repeat(40)}`, "sec-fetch-site": "cross-site" },
    ];
    for (const headers of attempts) {
      for (const path of ENDPOINTS) {
        const res = await request.get(path, { headers, maxRedirects: 0 });
        expect([401, 403], `${path} with ${JSON.stringify(headers)}`).toContain(res.status());
      }
    }
  });

  test("POST /api/admin/email-check (which SENDS an email) is refused to a stranger", async ({ request }) => {
    const attempts: Array<Record<string, string>> = [{}, { authorization: `Bearer ${"a".repeat(40)}` }];
    for (const headers of attempts) {
      const res = await request.post("/api/admin/email-check", { data: { requestId: CONTACT_ID }, headers, maxRedirects: 0 });
      expect([401, 403]).toContain(res.status());
      expect(JSON.parse(await res.text())).toMatchObject({ ok: false });
    }
  });
});

test.describe("what the public site says about the admin area", () => {
  test("it is not in the sitemap, and robots keeps crawlers out", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toMatch(/\/admin/);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow:\s*\/admin/i);
  });

  test("no public page links to an admin address", async ({ page }) => {
    for (const path of ["/", "/about", "/books", "/cart", "/authors"]) {
      await page.goto(path);
      const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs.filter((h) => /^\/?admin(\/|$)|\/admin\//.test(h)), path).toEqual([]);
    }
  });
});
