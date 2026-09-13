import { describe, expect, it } from "vitest";
import {
  BUNDLES,
  SUSPENDED_BUNDLES,
  bundleSaving,
  bundlesContaining,
  matchBundle,
} from "./bundles";
import { BOOKS } from "../../scripts/catalog/valice-catalog.mjs";

/** Live plus suspended: a suspended definition that rots cannot be restored. */
const ALL_DEFINITIONS = [...BUNDLES, ...SUSPENDED_BUNDLES];

describe("reader bundles", () => {
  it("every member is a real, published book", () => {
    for (const b of ALL_DEFINITIONS) {
      for (const slug of b.bookSlugs) {
        const book = BOOKS.find((x) => x.slug === slug);
        expect(book, `${b.slug} names an unknown book ${slug}`).toBeTruthy();
        if (!book) continue;
        // Not `published`: the Stoic Library's two members are public-domain
        // titles, hidden from the storefront for the Paddle review. The
        // definition still has to name real books that still exist, which is
        // what makes it restorable — but it cannot require them to be visible
        // while they are deliberately not.
        expect(
          ["published", "draft"],
          `${slug} is neither published nor draft`,
        ).toContain(book.websiteStatus);
      }
    }
  });

  it("the advertised 'separately' price is the sum of the members' real prices", () => {
    for (const b of ALL_DEFINITIONS) {
      const sum = b.bookSlugs.reduce((total, slug) => {
        const book = BOOKS.find((x) => x.slug === slug);
        const ebook = book?.formats.find((f) => f.format === "ebook");
        expect(ebook, `${slug} has no ebook format`).toBeTruthy();
        return total + (ebook?.priceCents ?? 0);
      }, 0);
      expect(sum, `${b.slug} misstates what its books cost separately`).toBe(
        b.separatelyCents,
      );
    }
  });

  it("a bundle actually saves money", () => {
    for (const b of ALL_DEFINITIONS) {
      expect(bundleSaving(b), `${b.slug} saves nothing`).toBeGreaterThan(0);
      expect(b.bundleCents).toBeLessThan(b.separatelyCents);
    }
  });

  it("carries a live Paddle discount id", () => {
    for (const b of ALL_DEFINITIONS) expect(b.discountId).toMatch(/^dsc_[a-z0-9]+$/);
  });

  it("matches only when every member is in the cart", () => {
    const b = SUSPENDED_BUNDLES[0];
    // While the Stoic Library is suspended, BUNDLES is empty and nothing can
    // match — including its own member list. That is the point: the cart must
    // not offer a saving it has no way to charge. Both members are sellable
    // again since the 2026-09-13 restoration; what is missing now is a
    // multi-item checkout to attach the discount to.
    expect(matchBundle(b.bookSlugs)).toBeNull();
    expect(matchBundle([])).toBeNull();
  });

  it("bundlesContaining finds a book's bundles and nothing else", () => {
    const b = SUSPENDED_BUNDLES[0];
    expect(bundlesContaining("codex-bestiarium")).not.toContain(b);
  });

  /**
   * The invariant that outlives any one provider. A bundle is a buy button for
   * several books at once, so every member must be individually sellable —
   * otherwise the cart shows a saving on a transaction that cannot complete.
   *
   * Deliberately checks `directSale` (are we cleared to sell it) and NOT
   * `providerPriceId` (is it wired to a checkout yet). A bundle listed while
   * one member is under an exclusivity term is a real defect; a bundle listed
   * during the hour between provisioning two variants is not.
   */
  it("every LIVE bundle's members are all actually sellable", () => {
    for (const b of BUNDLES) {
      for (const slug of b.bookSlugs) {
        const book = BOOKS.find((x) => x.slug === slug);
        expect(book?.directSale, `${b.slug}: ${slug} is not sold direct`).toBe(true);
      }
    }
  });

  it("no bundle is a subset of another (one cart, one discount)", () => {
    for (const a of BUNDLES) {
      for (const b of BUNDLES) {
        if (a === b) continue;
        const aIn = new Set(a.bookSlugs);
        expect(b.bookSlugs.every((s) => aIn.has(s))).toBe(false);
      }
    }
  });
});

describe("the bundle's precondition is server-side", () => {
  it("never matches a cart missing any member", () => {
    for (const b of BUNDLES) {
      for (const member of b.bookSlugs) {
        const partial = b.bookSlugs.filter((s) => s !== member);
        expect(
          matchBundle(partial),
          `${b.slug} matched without ${member} — a partial cart would take the whole set's discount`,
        ).toBeNull();
      }
    }
  });
});
