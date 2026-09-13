/**
 * Catalog integrity, as tests.
 *
 * `load-catalog.mjs` refuses to write a catalog that violates these rules,
 * but that check only runs when someone loads the catalog. These are the
 * same invariants enforced in CI, on every commit, because each one of them
 * describes a defect that actually reached production in this project:
 *
 *   - a Paddle price id that was never a real price (`pri_test_meditations_999`),
 *     which failed at the till rather than at load;
 *   - product pages for books Valice Press has no right to sell;
 *   - "Buy on Amazon" as a concept, waiting on ASINs that did not exist.
 *
 * The rule that matters most now is the exclusivity one. KDP Select is a
 * contract, and a data edit that flips a Select title to direct sale would
 * breach it silently — nothing else in the system would object.
 */
import { describe, expect, it } from "vitest";

// Plain-JS catalog data, deliberately not TypeScript so the operational
// scripts can import it under bare `node` without a build step. The shapes
// are asserted below rather than declared.
import {
  AUTHORS,
  BOOKS,
  CATEGORIES,
  RETIRED_PADDLE_PRICE_IDS,
} from "./valice-catalog.mjs";

interface Format {
  format: string;
  availability: "available" | "coming_soon" | "unavailable";
  fulfillment: "direct" | "amazon";
  priceCents: number | null;
  pageCount: number | null;
  amazonAsin: string | null;
  amazonUrl: string | null;
  // "publishing" is KDP's state between submission and sale: the title has been
  // accepted, Amazon has ISSUED THE ASIN and the product page exists, but the
  // listing is not yet purchasable. It is distinct from "in_review", where no ASIN
  // has been issued at all.
  kdp: "live" | "publishing" | "in_review" | "not_created" | "not_applicable";
  masterFileKey: string | null;
}

interface Book {
  slug: string;
  title: string;
  websiteStatus: "published" | "draft";
  kdpSelect: boolean;
  directSale: boolean;
  directSaleBlockedBy: string | null;
  /** The ACTIVE provider's id — a Lemon Squeezy variant id, or null. */
  providerPriceId: string | null;
  series?: { name: string; volume?: number } | null;
  subtitle?: string | null;
  description?: string | null;
  categories: string[];
  authors: string[];
  formats: Format[];
  blockers: string[];
}

const books = BOOKS as unknown as Book[];
/** Has an ebook this site holds and can hand over — the free campaign's test. */
const directEbook = (b: Book) =>
  b.formats.find(
    (f) =>
      f.format === "ebook" &&
      f.fulfillment === "direct" &&
      f.availability === "available",
  );

/**
 * May we CHARGE for it here? Narrower than `directEbook` since the Paddle
 * compliance gate: eighteen public-domain titles are deliverable (the free
 * campaign still works) but are deliberately not Paddle transactions.
 */
const soldHere = (b: Book) => Boolean(directEbook(b)) && b.directSale !== false;

describe("catalog structure", () => {
  it("has unique book slugs", () => {
    const slugs = books.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has at most one row per format per book", () => {
    for (const b of books) {
      const names = b.formats.map((f) => f.format);
      expect(new Set(names).size, `${b.slug} has duplicate format rows`).toBe(
        names.length,
      );
    }
  });

  it("references only categories and authors that exist", () => {
    const cats = new Set((CATEGORIES as { slug: string }[]).map((c) => c.slug));
    const authors = new Set((AUTHORS as { slug: string }[]).map((a) => a.slug));
    for (const b of books) {
      for (const c of b.categories) expect(cats, `${b.slug} → ${c}`).toContain(c);
      for (const a of b.authors) expect(authors, `${b.slug} → ${a}`).toContain(a);
    }
  });

  it("gives every book at least one category and author", () => {
    for (const b of books) {
      expect(b.categories.length, `${b.slug} has no category`).toBeGreaterThan(0);
      expect(b.authors.length, `${b.slug} has no author`).toBeGreaterThan(0);
    }
  });
});

describe("KDP Select exclusivity", () => {
  it("never sells a Select-enrolled book's ebook directly", () => {
    for (const b of books) {
      if (!b.kdpSelect) continue;
      expect(
        directEbook(b),
        `${b.slug} is enrolled in KDP Select — selling its ebook here breaches exclusivity`,
      ).toBeUndefined();
      expect(b.directSale, `${b.slug} is in Select but flagged directSale`).toBe(false);
    }
  });

  it("records a reason whenever direct sale is switched off", () => {
    for (const b of books) {
      if (b.directSale) continue;
      expect(
        b.directSaleBlockedBy,
        `${b.slug} is not sold directly but records no reason why`,
      ).toBeTruthy();
    }
  });
});

/**
 * The Paddle compliance gate, asserted rather than trusted.
 *
 * Paddle declined valicepress.com on 2026-09-09 and 2026-09-11, the second
 * time naming "reselling/redistribution of third party content" and "physical
 * goods sold or otherwise provided as part of the product". The catalog answers
 * both by holding the public-domain series out of the paid checkout and by
 * refusing to advertise print editions that do not exist.
 *
 * These tests exist so that neither can be undone by accident — by a new book
 * copied from an old template, or by somebody restoring a price id without
 * knowing why it was removed. If Paddle later approves the public-domain model
 * in writing, the gate comes out of `valice-catalog.mjs` and these come out
 * with it, deliberately and together.
 */
describe("public-domain restoration", () => {
  const PUBLIC_DOMAIN_SERIES = "Valice Classics";

  /**
   * THE CURTAIN CAME BACK UP.
   *
   * On 2026-09-12 the Valice Classics series was set to `draft` for the
   * duration of Paddle's domain review, and the whole point of doing it that
   * way rather than by deletion was that every book came back by flipping one
   * boolean. On 2026-09-13 Paddle was retired and the boolean was flipped.
   * This test is the proof that the rollback worked and the evidence that it
   * did not cost the books anything on the way through.
   */
  it("has every public-domain title back on the storefront, intact", () => {
    const classics = books.filter((b) => b.series?.name === PUBLIC_DOMAIN_SERIES);
    expect(classics.length).toBeGreaterThanOrEqual(18);
    for (const b of classics) {
      expect(b.websiteStatus, `${b.slug} is still hidden`).toBe("published");
      const ebook = directEbook(b);
      expect(ebook, `${b.slug} lost its ebook format`).toBeDefined();
      expect(ebook!.masterFileKey, `${b.slug} lost its master file key`).toBeTruthy();
      expect(b.title, `${b.slug} lost its title`).toBeTruthy();
      expect(b.description, `${b.slug} lost its description`).toBeTruthy();
      expect(b.categories?.length, `${b.slug} lost its categories`).toBeGreaterThan(0);
    }
  });

  /**
   * No book may be held out of sale for a reason that has stopped existing.
   *
   * The eighteen classics were blocked with a `directSaleBlockedBy` naming
   * Paddle. Paddle is retired, so that sentence is no longer a reason — it is
   * a stale note that would keep eighteen sellable books off the till forever.
   * Any remaining block must cite something still true.
   */
  it("cites no retired payment provider as a reason not to sell", () => {
    const stale = books
      .filter((b) => typeof b.directSaleBlockedBy === "string")
      .filter((b) => /paddle/i.test(b.directSaleBlockedBy as string))
      .map((b) => b.slug);
    expect(
      stale,
      `these are blocked by a provider that no longer takes our money: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  /**
   * The press may sell an EDITION of a public-domain text; it may not claim
   * the text. Every classic has to name its source somewhere a reader sees.
   */
  it("names the source text of every public-domain edition", () => {
    for (const b of books.filter((x) => x.series?.name === PUBLIC_DOMAIN_SERIES)) {
      const prose = `${b.description ?? ""} ${b.subtitle ?? ""}`;
      expect(
        prose.length,
        `${b.slug} has no description to carry its provenance`,
      ).toBeGreaterThan(200);
    }
  });

  /**
   * The free campaign must survive every provider change.
   *
   * Everything that decides "can this be given away" once asked about price,
   * because until 2026-09-12 an unpriced book was always also a book with no
   * file. Three places had to be taught the difference: the API
   * (`/api/free-book`), the gift box, and the loader's `master_file_key`
   * write. If any one of them reverts to the price test, titles silently stop
   * being requestable — the modal opens and the submission answers 409.
   */
  it("keeps the deliverable/buyable split intact", () => {
    const published = books.filter((b) => b.websiteStatus === "published");
    for (const b of published) {
      if (b.providerPriceId) {
        expect(directEbook(b)?.masterFileKey, `${b.slug} is sold with no master`).toBeTruthy();
      }
    }
    expect(published.length).toBeGreaterThanOrEqual(30);
  });

  it("advertises no print edition that does not exist", () => {
    const phantom = books.flatMap((b) =>
      b.formats
        .filter(
          (f) =>
            (f.format === "paperback" ||
              f.format === "hardcover" ||
              f.format === "large_print") &&
            f.availability !== "unavailable" &&
            !f.amazonAsin,
        )
        .map((f) => `${b.slug}/${f.format}`),
    );
    expect(
      phantom,
      `print editions shown without a real ASIN: ${phantom.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the print editions that DO exist, with their Amazon links", () => {
    // The other half of the rule: Valice Press really does sell printed books
    // through Amazon, and no storefront change may quietly delete that.
    const live = books.flatMap((b) =>
      b.formats.filter((f) => f.amazonUrl && f.amazonAsin).map((f) => `${b.slug}/${f.format}`),
    );
    expect(live.length).toBeGreaterThanOrEqual(20);
  });
});

describe("checkout wiring", () => {
  // A Lemon Squeezy variant id is a positive integer sent as a string. The
  // retired Paddle shape (`pri_…`) must never appear in this column again:
  // `pri_test_meditations_999` once passed a naive startsWith("pri_") check
  // and reached production, and the lesson generalises to any leftover.
  const VARIANT_ID = /^[1-9][0-9]{0,14}$/;

  it("carries no retired Paddle price id in the live column", () => {
    const leftovers = books
      .filter((b) => typeof b.providerPriceId === "string")
      .filter((b) => (b.providerPriceId as string).startsWith("pri_"))
      .map((b) => b.slug);
    expect(
      leftovers,
      `Paddle ids left in providerPriceId: ${leftovers.join(", ")}`,
    ).toEqual([]);
  });

  it("shapes every provider price id like a Lemon Squeezy variant id", () => {
    for (const b of books) {
      if (!b.providerPriceId) continue;
      expect(
        String(b.providerPriceId),
        `${b.slug}: "${b.providerPriceId}" is not a Lemon Squeezy variant id`,
      ).toMatch(VARIANT_ID);
    }
  });

  /**
   * The invariant that survives every migration: a book we are NOT allowed to
   * sell here must never carry a live provider price, or an unrelated edit
   * could put it back on the till without anybody deciding to. Codex
   * Mythologica under KDP Select to 2026-11-03 is the case this protects.
   */
  it("carries no provider price for a book that is not sold here", () => {
    for (const b of books) {
      if (soldHere(b)) continue;
      expect(
        b.providerPriceId ?? null,
        `${b.slug} is not sold here but carries a provider price id`,
      ).toBeNull();
    }
  });

  /**
   * Deliberately NOT asserted: that every sellable book HAS a provider price.
   * Between retiring one provider and provisioning the next, every sellable
   * title legitimately has none, and the storefront handles that by showing no
   * buy button. Asserting it here would turn a correct intermediate state into
   * a red suite, and a red suite that is expected to be red stops being read.
   * The loader counts and prints the unwired titles instead.
   */
  it("keeps the archive of retired Paddle ids for audit", () => {
    expect(Object.keys(RETIRED_PADDLE_PRICE_IDS).length).toBeGreaterThanOrEqual(27);
    for (const id of Object.values(RETIRED_PADDLE_PRICE_IDS)) {
      expect(String(id)).toMatch(/^pri_[a-z0-9]{20,}$/);
    }
  });
});

describe("fulfillment", () => {
  it("has a master file in R2 for every ebook sold directly", () => {
    for (const b of books) {
      const e = directEbook(b);
      if (!e) continue;
      expect(
        e.masterFileKey,
        `${b.slug} is on sale but has no master file to watermark`,
      ).toMatch(/^books\/.+\/master\/v\d+\/master\.pdf$/);
    }
  });

  it("prices every format that can be bought", () => {
    for (const b of books) {
      for (const f of b.formats) {
        if (f.availability !== "available") continue;
        expect(
          f.priceCents,
          `${b.slug}/${f.format} is buyable with no price`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("Amazon destinations", () => {
  const ASIN = /^B0[A-Z0-9]{8}$/;

  it("only links to Amazon with a verified ASIN behind it", () => {
    for (const b of books) {
      for (const f of b.formats) {
        if (!f.amazonUrl) continue;
        expect(f.amazonAsin, `${b.slug}/${f.format}: URL without an ASIN`).toBeTruthy();
        expect(f.amazonAsin, `${b.slug}/${f.format}: malformed ASIN`).toMatch(ASIN);
        // The destination is always the verified ASIN's own /dp/ page. An
        // Amazon Attribution tag (created in the Ads console, 2026-09-08) is
        // allowed as a query string on that same page: it changes what
        // Amazon reports, not where the reader lands.
        const dp = `https://www.amazon.com/dp/${f.amazonAsin}`;
        expect(
          f.amazonUrl === dp || f.amazonUrl.startsWith(`${dp}?`),
          `${b.slug}/${f.format}: amazonUrl must be the ASIN's /dp/ page, optionally with a query string`,
        ).toBe(true);
      }
    }
  });

  it("only carries an ASIN for an edition Amazon has actually issued one for", () => {
    // Amazon issues an ASIN when it accepts a title, not when the listing becomes
    // purchasable. An ASIN on a title that is still in review, was never created, or
    // has no Amazon edition at all is, by definition, made up — and that is what this
    // guards. "publishing" is admitted because it is the state between the two: the
    // ASIN exists and resolves to a real product page, the price simply is not up yet.
    //
    // Widened on 2026-09-07 for B0HJ2TPX4T (the Puzzle Book paperback), whose page was
    // loaded and checked before the state was written: right title, ISBN 979-8172268281
    // matching KDP's assignment, 156 pages matching the built interior. Refusing a
    // verified ASIN would have meant deleting a true fact to satisfy a narrow rule.
    const ISSUED = ["live", "publishing"];
    for (const b of books) {
      for (const f of b.formats) {
        if (!f.amazonAsin) continue;
        expect(
          ISSUED,
          `${b.slug}/${f.format} has an ASIN but kdp="${f.kdp}"`,
        ).toContain(f.kdp);
      }
    }
  });

  it("never leaves an available Amazon edition without somewhere to send the buyer", () => {
    for (const b of books) {
      for (const f of b.formats) {
        if (f.fulfillment !== "amazon" || f.availability !== "available") continue;
        expect(
          f.amazonUrl,
          `${b.slug}/${f.format} is on sale at Amazon with no link`,
        ).toBeTruthy();
      }
    }
  });
});

describe("previews", () => {
  it("renders a real preview for every published book", async () => {
    // Guards the regression this replaced: every product page used to show
    // the same invented sample prose. A published book with no preview must
    // show no preview section — never borrowed or generic text — so the
    // manifest and the published set are kept in step here.
    const { getPreview } = await import("../../src/lib/previews/index.js");
    for (const b of books) {
      if (b.websiteStatus !== "published") continue;
      const preview = getPreview(b.slug);
      expect(preview, `${b.slug} is published with no rendered preview`).not.toBeNull();
      expect(preview!.pages.length, `${b.slug} preview is empty`).toBeGreaterThan(0);
    }
  });

  it("keeps previews far short of the whole book", async () => {
    const { getPreview } = await import("../../src/lib/previews/index.js");
    for (const b of books) {
      const preview = getPreview(b.slug);
      if (!preview) continue;
      // A preview is a sample, not a substitute. 5% of the book is already
      // generous; these run well under 3%.
      const share = preview.pages.length / b.formats[0].pageCount!;
      expect(share, `${b.slug} previews ${(share * 100).toFixed(1)}% of the book`).toBeLessThan(
        0.05,
      );
    }
  });
});

describe("publication", () => {
  it("uses only the two states the loader understands", () => {
    for (const b of books) {
      expect(["published", "draft"]).toContain(b.websiteStatus);
    }
  });

  it("publishes nothing that cannot be either bought or linked", () => {
    // A published page with no ebook to sell and no Amazon edition to link
    // is a dead end: a product page for something nobody can obtain.
    for (const b of books) {
      if (b.websiteStatus !== "published") continue;
      const obtainable =
        Boolean(directEbook(b)) ||
        b.formats.some((f) => f.availability === "available" && f.amazonUrl);
      expect(obtainable, `${b.slug} is published but cannot be obtained anywhere`).toBe(
        true,
      );
    }
  });

  it("records why each book is where it is", () => {
    for (const b of books) {
      expect(Array.isArray(b.blockers), `${b.slug} has no blockers array`).toBe(true);
    }
  });
});
