import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { AUTHORS, BOOKS } from "../scripts/catalog/valice-catalog.mjs";

import { clippedContent, horizontalOverflow, isMobileProject, MOBILE_WIDTHS } from "./helpers";

/**
 * PHASE 7 — the authors directory and a page for every author in it.
 *
 * The data and the sources are checked elsewhere (`reference-authors.test.ts`,
 * `scripts/authors/verify-sources.mjs`). What is asserted here is what a reader gets in a browser: that the
 * directory lists each person once and can be searched, filtered and sorted; that every card leads to a page
 * that renders; that every photograph loads; and — the thing this page once got badly wrong — that the page
 * never says Valice Press publishes someone it does not, and never hides that it does.
 */

const DIR = path.resolve(__dirname, "../src/content/authors");
interface Researched {
  slug: string;
  name: string;
  category: string;
  sources: Array<{ url: string }>;
  portrait: { src: string; alt: string; credit: string; licenceUrl: string | null } | null;
  portraitNote?: string;
  related: string[];
  bio?: string[];
}
const researched: Researched[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")));

const publishedAuthors = (AUTHORS as Array<{ slug: string; name: string }>).filter((a) =>
  (BOOKS as Array<{ authors: string[]; websiteStatus: string }>).some((b) => b.websiteStatus === "published" && b.authors.includes(a.slug)),
);
const publishedSlugs = new Set(publishedAuthors.map((a) => a.slug));
const everyone = [...new Set([...researched.map((r) => r.slug), ...publishedSlugs])].sort();
const publishedBookSlugs = new Set((BOOKS as Array<{ slug: string; websiteStatus: string }>).filter((b) => b.websiteStatus === "published").map((b) => b.slug));

const surnameKey = (name: string) => {
  const parts = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\./g, "").split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? name.toLowerCase();
};

async function cards(page: Page) {
  const items = page.locator('section[aria-label="Authors"] > ul > li');
  await expect(items.first()).toBeVisible();
  return items;
}
const cardNames = (page: Page) => page.locator('section[aria-label="Authors"] > ul > li h3').allTextContents();

test.describe("/authors — the directory", () => {
  test("lists every researched author and every author Valice publishes, each person once", async ({ page }) => {
    await page.goto("/authors");
    const items = await cards(page);
    const n = await items.count();
    expect(n, "researched ∪ published").toBe(everyone.length);
    expect(n).toBeGreaterThanOrEqual(25);
    const hrefs = await items.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(new Set(hrefs).size, "a person appears twice").toBe(hrefs.length);
    expect(hrefs.map((h) => h!.split("/").pop()).sort()).toEqual(everyone);
    await expect(page.getByRole("status")).toHaveText(`${n} authors`);
  });

  test("marks exactly the people the catalogue publishes as on the Valice list, and calls everyone else a reference author", async ({ page }) => {
    await page.goto("/authors");
    const items = await cards(page);
    for (const li of await items.all()) {
      const slug = (await li.locator("a").first().getAttribute("href"))!.split("/").pop()!;
      const badge = li.getByText("On the Valice list", { exact: true });
      if (publishedSlugs.has(slug)) await expect(badge, `${slug} is published`).toHaveCount(1);
      else {
        await expect(badge, `${slug} is not published`).toHaveCount(0);
        await expect(li.getByText("Reference author"), slug).toHaveCount(1);
      }
    }
  });

  test("filters by category; the count on each filter is the number of cards it shows", async ({ page }) => {
    await page.goto("/authors");
    await cards(page);
    const group = page.getByRole("group", { name: "Filter authors" });
    const buttons = await group.getByRole("button").all();
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const b of buttons) {
      const label = (await b.textContent())!;
      await b.click();
      await expect(b).toHaveAttribute("aria-pressed", "true");
      expect((await cards(page)).count(), label).resolves.toBe(Number(/(\d+)\s*$/.exec(label)![1]));
    }
    for (const [name, min] of [["Historical voices", 10], ["Games & puzzles", 5], ["Sapphic romance", 10]] as const) {
      const label = (await group.getByRole("button", { name: new RegExp(`^${name}`) }).textContent())!;
      expect(Number(/(\d+)\s*$/.exec(label)![1]), name).toBeGreaterThanOrEqual(min);
    }
  });

  test("searches by name, by a book and by a place, ignoring accents", async ({ page }) => {
    await page.goto("/authors");
    await cards(page);
    const search = page.getByRole("searchbox", { name: /Search authors/ });
    await search.fill("fingersmith");
    expect(await cardNames(page)).toEqual(["Sarah Waters"]);
    await search.fill("kwaidan");
    expect(await cardNames(page)).toContain("Lafcadio Hearn");
    await search.fill("dogan");
    expect((await cardNames(page)).join()).toMatch(/Do[gğ]an/);
    await search.fill("tulsa");
    expect(await cardNames(page)).toEqual(["Martin Gardner"]);
    await search.fill("zzzqqq");
    await expect(page.getByText("No authors match.")).toBeVisible();
    await page.getByRole("button", { name: "Show everyone" }).click();
    expect(await (await cards(page)).count()).toBe(everyone.length);
    await expect(search).toHaveValue("");
  });

  test("sorts by family name, and by birth year (Ovid, born 43 BC, first)", async ({ page }) => {
    await page.goto("/authors");
    await cards(page);
    const keys = (await cardNames(page)).map(surnameKey);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    await page.getByLabel("Sort authors").selectOption("Earliest born");
    expect((await cardNames(page))[0]).toBe("Ovid");
    await page.getByLabel("Sort authors").selectOption("Most books");
    const first = (await cardNames(page))[0];
    expect(publishedAuthors.some((a) => a.name === first || surnameKey(a.name) === surnameKey(first)), `most books → ${first}`).toBe(true);
  });

  test("every photograph on every card loads, and every author without one shows the initials mark", async ({ page }) => {
    await page.goto("/authors");
    const items = await cards(page);
    // the grid is not lazy-rendered, but images are: scroll the page so they all request
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForLoadState("networkidle");
    const broken = await page.locator('section[aria-label="Authors"] img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc));
    expect(broken).toEqual([]);
    for (const li of await items.all()) {
      const slug = (await li.locator("a").first().getAttribute("href"))!.split("/").pop()!;
      const r = researched.find((x) => x.slug === slug);
      const hasPhoto = Boolean(r?.portrait);
      expect(await li.locator("img").count(), `${slug} photograph`).toBe(hasPhoto ? 1 : 0);
      expect(await li.locator("[data-identity-mark]").count(), `${slug} mark`).toBe(hasPhoto ? 0 : 1);
      if (hasPhoto) expect(await li.locator("img").getAttribute("alt")).toBe(r!.portrait!.alt);
    }
  });

  test("credits every photograph whose licence asks for it, in one list under the grid", async ({ page }) => {
    await page.goto("/authors");
    await cards(page);
    const details = page.locator("details", { hasText: "Photograph credits" });
    await details.locator("summary").click();
    const list = details.locator("ul li");
    const withPhoto = researched.filter((r) => r.portrait);
    expect(await list.count()).toBe(withPhoto.length);
    for (const r of withPhoto) await expect(details.locator("li", { hasText: r.name }).first()).toContainText(r.portrait!.credit.split(" · ")[0]);
  });

  test("is not wider than the screen", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const widths = isMobileProject(testInfo) ? MOBILE_WIDTHS : ([1024, 1440] as const);
    await page.goto("/authors", { waitUntil: "domcontentloaded" });
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(150);
      expect(await horizontalOverflow(page), `/authors at ${w}px`).toBeLessThanOrEqual(0);
      expect(await clippedContent(page), `/authors at ${w}px: content cut off`).toEqual([]);
    }
  });
});

test.describe("/authors/<slug> — every person has a page, and the page is honest about who they are", () => {
  test("every author in the directory has a page, and the sitemap lists them all", async ({ request }) => {
    for (const slug of everyone) {
      const res = await request.get(`/authors/${slug}`);
      expect(res.status(), slug).toBe(200);
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const slug of everyone) expect(sitemap, `sitemap lacks ${slug}`).toContain(`/authors/${slug}`);
    expect((await request.get("/authors/nobody-by-this-name")).status()).toBe(404);
  });

  test("a researched page prints its facts, its sources and its licence — and says what it is", async ({ request }) => {
    for (const r of researched) {
      const html = await (await request.get(`/authors/${r.slug}`)).text();
      const isPublished = publishedSlugs.has(r.slug);
      expect(html, `${r.slug}: sources`).toContain("Where this comes from");
      for (const s of r.sources) expect(html, `${r.slug}: ${s.url}`).toContain(s.url.replace(/&/g, "&amp;"));
      expect(html).toContain("Major works");
      expect(html).toContain("Turning points");
      if (isPublished) {
        expect(html, `${r.slug}: published`).toContain("On the Valice list");
        expect(html, `${r.slug}: must not call a published author a reference author`).not.toContain("A reference author.");
      } else {
        expect(html, `${r.slug}: reference`).toContain("A reference author.");
        expect(html, `${r.slug}: must not carry the published badge`).not.toContain("On the Valice list");
        expect(html, `${r.slug}: must not claim to publish them`).not.toMatch(/Valice Press publishes/);
      }
      if (r.portrait) {
        expect(html, `${r.slug}: credit`).toContain(r.portrait.credit.split(" · ")[0].replace(/&/g, "&amp;"));
        expect(html).toContain("Wikimedia Commons");
      } else {
        expect(html, `${r.slug}: honest placeholder`).toContain("not a likeness");
      }
    }
  });

  test("structured data names the person, their dates and where else they are recorded", async ({ request }) => {
    for (const slug of ["lafcadio-hearn", "sarah-waters", "ovid", "radclyffe"]) {
      const html = await (await request.get(`/authors/${slug}`)).text();
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const person = blocks.flatMap((b) => b["@graph"] ?? [b]).find((n: { "@type"?: string }) => n["@type"] === "Person");
      expect(person, slug).toBeTruthy();
      const r = researched.find((x) => x.slug === slug)!;
      expect(person.name).toBeTruthy();
      expect(person.sameAs.some((u: string) => u.includes("wikipedia.org")), `${slug} sameAs`).toBe(true);
      expect(person.sameAs.some((u: string) => u.includes("wikidata.org"))).toBe(true);
      if (slug === "ovid") expect(person.birthDate, "an ancient date is not a schema.org year").toBeUndefined();
      if (slug === "lafcadio-hearn") expect(person.birthDate).toBe("1850");
      if (r.portrait) expect(person.image).toContain(r.portrait.src);
    }
  });

  test("every photograph on a profile loads; the figure names its source", async ({ page }) => {
    test.setTimeout(180_000);
    for (const r of researched) {
      await page.goto(`/authors/${r.slug}`, { waitUntil: "load" });
      await expect(page.locator("h1")).toBeVisible();
      if (r.portrait) {
        const img = page.locator("figure img").first();
        await expect(img).toBeVisible();
        expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), `${r.slug} photo`).toBe(true);
        expect(await img.getAttribute("alt")).toBe(r.portrait.alt);
        await expect(page.locator("figcaption")).toContainText("Wikimedia Commons");
      } else {
        await expect(page.locator("figure [data-identity-mark]")).toHaveCount(1);
      }
    }
  });

  test("books on an author's page are real catalogue titles; shelf neighbours say they are not by the author", async ({ page }) => {
    await page.goto("/authors/lafcadio-hearn");
    const own = page.locator("#books a[href^='/books/']");
    expect(await own.count()).toBeGreaterThanOrEqual(1);
    for (const href of await own.evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) expect(publishedBookSlugs.has(href.split("/").pop()!), href).toBe(true);

    await page.goto("/authors/sarah-waters");
    await expect(page.locator("#books")).toHaveCount(0); // she is not published here: no "titles we publish"
    const shelf = page.locator("#shelf");
    await expect(shelf).toContainText("They are not by Sarah Waters");
    for (const href of await shelf.locator("a[href^='/books/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) expect(publishedBookSlugs.has(href.split("/").pop()!), href).toBe(true);
  });

  test("related authors link to pages that exist", async ({ request }) => {
    for (const r of researched) for (const rel of r.related) expect((await request.get(`/authors/${rel}`)).status(), `${r.slug} → ${rel}`).toBe(200);
  });

  test("a profile is not wider than the screen", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const widths = isMobileProject(testInfo) ? MOBILE_WIDTHS : ([1024, 1440] as const);
    for (const slug of ["sarah-waters", "lafcadio-hearn", "radclyffe", "emre-dogan"]) {
      await page.goto(`/authors/${slug}`, { waitUntil: "domcontentloaded" });
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(120);
        expect(await horizontalOverflow(page), `/authors/${slug} at ${w}px`).toBeLessThanOrEqual(0);
        expect(await clippedContent(page), `/authors/${slug} at ${w}px: content cut off`).toEqual([]);
      }
    }
  });
});
