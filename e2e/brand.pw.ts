import { expect, test } from "@playwright/test";

import { isMobileProject } from "./helpers";

/**
 * PHASE 6 — the logo, the icons and the four social profiles as they RENDER.
 *
 * The unit tests (`social.test.ts`, `brand.test.ts`, `seo.test.ts`) pin the sources. This pins
 * what a browser and a crawler actually receive: the header carries the mark (square, loaded),
 * the browser tab gets real icons, the footer / drawer / About page link the four profiles from
 * the one list, structured data names the logo and the profiles, and the old personal handle and
 * the GitHub link are nowhere in the HTML.
 */

const PROFILES = [
  ["X", "https://x.com/ValicePress"],
  ["Instagram", "https://www.instagram.com/valicepress/"],
  ["Facebook", "https://www.facebook.com/profile.php?id=61594861742767"],
  ["TikTok", "https://www.tiktok.com/@valicepress"],
] as const;

test.describe("logo", () => {
  test("the header shows the mark: loaded, square, not stretched", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const img = page.locator("header img[src*='valice-press-mark']").first();
    await expect(img).toBeVisible();
    const m = await img.evaluate((el: HTMLImageElement) => ({ nw: el.naturalWidth, nh: el.naturalHeight, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }));
    expect(m.nw).toBeGreaterThan(0);
    expect(m.nw).toBe(m.nh);
    expect(Math.abs(m.w - m.h)).toBeLessThan(1);
    expect(m.w).toBeGreaterThanOrEqual(32); // a 36px tile on a phone, less its 1px border
  });

  test("the browser tab gets real icons, and each answers 200 as an image", async ({ page, request }) => {
    await page.goto("/", { waitUntil: "load" });
    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']")).map((l) => (l as HTMLLinkElement).href));
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    expect(await page.locator("link[rel='apple-touch-icon']").count()).toBeGreaterThanOrEqual(1);
    for (const href of new Set(hrefs)) {
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
      expect(res.headers()["content-type"], href).toMatch(/^image\//);
    }
  });
});

test.describe("structured data and cards", () => {
  test("Organization names the logo file and exactly the four profiles; the logo answers 200", async ({ page, request }) => {
    await page.goto("/", { waitUntil: "load" });
    const blocks = await page.locator("script[type='application/ld+json']").allTextContents();
    const org = blocks
      .flatMap((b) => {
        try {
          const j = JSON.parse(b);
          return Array.isArray(j["@graph"]) ? j["@graph"] : [j];
        } catch {
          return [];
        }
      })
      .find((n: { "@type"?: string }) => n["@type"] === "Organization");
    expect(org, "an Organization node").toBeTruthy();
    expect(org.sameAs).toEqual(PROFILES.map(([, href]) => href));
    expect(org.logo.url).toMatch(/\/images\/brand\/valice-press-logo-512\.png$/);
    const res = await request.get(org.logo.url.replace(/^https?:\/\/[^/]+/, ""));
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  });

  test("twitter:site is the press's own handle", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("meta[name='twitter:site']")).toHaveAttribute("content", "@ValicePress");
  });
});

test.describe("social profiles", () => {
  for (const path of ["/", "/about"]) {
    test(`${path}: the footer links all four, each opening in a new tab with a name a screen reader can use`, async ({ page }) => {
      await page.goto(path, { waitUntil: "load" });
      const footer = page.locator("footer");
      for (const [name, href] of PROFILES) {
        const link = footer.locator(`a[href="${href}"]`);
        await expect(link, `${name} in the footer of ${path}`).toHaveCount(1);
        await expect(link).toHaveAttribute("target", "_blank");
        expect(await link.getAttribute("rel")).toContain("noopener");
        expect(await link.getAttribute("aria-label")).toContain(name);
      }
    });
  }

  test("/about links them from the founder card and the 'where to go next' grid too", async ({ page }) => {
    await page.goto("/about", { waitUntil: "load" });
    for (const [name, href] of PROFILES) {
      expect(await page.locator(`main a[href="${href}"]`).count(), `${name} on /about`).toBeGreaterThanOrEqual(2);
    }
  });

  test("the phone drawer offers them", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "the drawer is the phone / tablet navigation");
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("button", { name: "Menu" }).tap();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    for (const [name, href] of PROFILES) {
      const link = drawer.locator(`a[href="${href}"]`);
      await expect(link, `${name} in the drawer`).toHaveCount(1);
      const box = await link.boundingBox();
      expect(box!.width, `${name} touch target`).toBeGreaterThanOrEqual(43.5);
      expect(box!.height, `${name} touch target`).toBeGreaterThanOrEqual(43.5);
    }
  });

  test("no page carries the earlier personal handle or a code-host link", async ({ request }) => {
    for (const path of ["/", "/about", "/books", "/ebooks", "/authors", "/categories", "/blog"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const html = (await res.text()).toLowerCase();
      for (const stale of ["emredogancloud", "emredogan-cloud", "github.com/"]) {
        expect(html.includes(stale), `${path} contains ${stale}`).toBe(false);
      }
    }
  });
});
