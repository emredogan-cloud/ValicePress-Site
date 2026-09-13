import { describe, expect, it } from "vitest";

import {
  getCompanion,
  getCompanionAsset,
  listCompanions,
} from "./companions";
import {
  COMPANION_SHEET_IDS,
  renderCompanionSheet,
} from "./companion-sheets";
// The catalogue is the source of truth a companion's claim is checked against.
import { BOOKS } from "../../scripts/catalog/valice-catalog.mjs";

/**
 * The companion bridge is the one mechanism that turns an Amazon buyer into a
 * Valice reader, and its entry point is a QR code printed permanently inside a
 * paperback. These tests defend the properties that a printed, uneditable URL
 * depends on.
 */

describe("companion registry", () => {
  it("exposes at least one companion", () => {
    expect(listCompanions().length).toBeGreaterThan(0);
  });

  it("resolves the hangul companion by slug", () => {
    expect(getCompanion("hangul")?.bookSlug).toBe(
      "korean-hangul-handwriting-workbook",
    );
  });

  it("returns undefined for an unknown slug rather than throwing", () => {
    expect(getCompanion("does-not-exist")).toBeUndefined();
  });

  it("gives every companion a unique slug", () => {
    const slugs = listCompanions().map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /**
   * A companion page must render in every commercial state of its book —
   * before listing, in review, live, and withdrawn. Nothing here may depend
   * on the book being purchasable, because the QR code outlives the edition.
   */
  it("declares a lifecycle state and a plain-language note for it", () => {
    for (const c of listCompanions()) {
      expect([
        "book-available",
        "book-not-yet-available",
        "book-withdrawn",
      ]).toContain(c.state);
      expect(c.stateNote.length).toBeGreaterThan(20);
    }
  });

  /**
   * THE FIELD MAY NOT CONTRADICT THE CATALOGUE.
   *
   * `state` is hand-written and drifts — measured 2026-09-13, twenty of
   * twenty-nine said `book-not-yet-available` for a book that was published
   * and sellable. The companion PAGE no longer trusts the field for that
   * (it asks the storefront), so this test exists to stop the field itself
   * rotting into a lie that some other surface might one day read.
   *
   * The rule is narrow on purpose. `book-withdrawn` is the one state the
   * catalogue genuinely cannot express, so it is never contradicted here.
   * And `book-not-yet-available` is allowed for a published book: between
   * provisioning a checkout and loading the catalogue, "published" and "you
   * can get it" legitimately disagree. What is forbidden is the direction
   * that misleads a reader holding the book: claiming `book-available` for a
   * title the catalogue says is nowhere to be had, in print or digitally.
   */
  it("never claims a book is available that the catalogue cannot supply", () => {
    const bySlug = new Map(
      (BOOKS as Array<Record<string, unknown>>).map((b) => [b.slug as string, b]),
    );
    for (const c of listCompanions()) {
      if (c.state !== "book-available") continue;
      const book = bySlug.get(c.bookSlug);
      // A companion for a book that is not in the catalogue at all cannot
      // claim availability — `etymon` is the live example, and its book is
      // still in production on another branch.
      expect(book, `${c.slug}: no catalogue row for "${c.bookSlug}"`).toBeDefined();
      if (!book) continue;
      const formats = (book.formats ?? []) as Array<Record<string, unknown>>;
      const sellableHere =
        book.directSale !== false &&
        formats.some(
          (f) =>
            f.format === "ebook" &&
            f.fulfillment === "direct" &&
            f.availability === "available",
        );
      const onAmazon = formats.some((f) => f.amazonAsin && f.availability === "available");
      expect(
        sellableHere || onAmazon,
        `${c.slug} says book-available, but ${c.bookSlug} is sold neither here nor on Amazon`,
      ).toBe(true);
    }
  });

  it("keeps every generated asset href inside its own companion's namespace", () => {
    for (const c of listCompanions()) {
      for (const a of c.assets) {
        if (a.kind !== "generated") continue;
        expect(a.href.startsWith(`/companion/${c.slug}/sheets/`)).toBe(true);
      }
    }
  });

  it("points every generated asset at a sheet the generator can actually build", () => {
    for (const c of listCompanions()) {
      for (const a of c.assets) {
        if (a.kind !== "generated") continue;
        const id = a.href.split("/").pop()!.replace(/\.pdf$/, "");
        expect(COMPANION_SHEET_IDS).toContain(id);
      }
    }
  });

  it("looks an asset up by id", () => {
    expect(getCompanionAsset("hangul", "practice-grid")?.kind).toBe("generated");
    expect(getCompanionAsset("hangul", "nope")).toBeUndefined();
  });

  /**
   * The Hangul book carries an unresolved CC BY-NC question on a dictionary
   * source used for its vocabulary. The companion was built to be independent
   * of that source so it can go live while the book's rights are settled.
   * If someone later adds a vocabulary sheet here, this test should be the
   * thing that stops them until the licence is cleared.
   */
  it("ships no vocabulary/dictionary-derived asset for hangul", () => {
    const hangul = getCompanion("hangul")!;
    const text = hangul.assets
      .map((a) => `${a.id} ${a.title} ${a.description}`)
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/vocabular|dictionar|word list|97 words/);
  });
});

describe("companion sheet generation", () => {
  it.each(COMPANION_SHEET_IDS)("renders %s as a real PDF", async (id) => {
    const bytes = await renderCompanionSheet(id);
    // A PDF starts with %PDF-
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    // Guards against a silently-empty document (an empty PDF is ~1KB of
    // structure with no content streams; every real sheet draws hundreds of
    // vector ops and lands far above this).
    expect(bytes.byteLength).toBeGreaterThan(2000);
  });

  it("rejects an unknown sheet id instead of serving a blank document", async () => {
    await expect(renderCompanionSheet("not-a-sheet")).rejects.toThrow(
      /Unknown companion sheet/,
    );
  });
});
