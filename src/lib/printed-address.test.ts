import { describe, expect, it } from "vitest";

import { isPrintedAddress, printedAddressRedirect } from "./printed-address";

/**
 * These are not style preferences. Every path asserted here is printed inside
 * a physical book that is already on sale, and a printed address cannot be
 * patched — so the forgiveness has to hold for the life of the edition.
 */
describe("printed addresses", () => {
  it("recognises every path that a Valice book actually prints", () => {
    for (const path of [
      "/companion/world-games",
      "/companion/world-myths",
      "/companion/hangul",
      "/companion/dudeney",
      "/companion/codex-bestiarium",
      "/companion/codex-mythologica",
      "/companion/myth-hunters-field-book",
      "/codex-enigmatica/verify",
      "/weather-permitting-bonus",
    ]) {
      expect(isPrintedAddress(path), path).toBe(true);
    }
  });

  it("forgives the case of the Weather Permitting bonus address printed in the book", () => {
    expect(printedAddressRedirect("https://valicepress.com/Weather-Permitting-Bonus"))
      .toBe("https://valicepress.com/weather-permitting-bonus");
    expect(printedAddressRedirect("https://valicepress.com/WEATHER-PERMITTING-BONUS"))
      .toBe("https://valicepress.com/weather-permitting-bonus");
    expect(printedAddressRedirect("https://valicepress.com/weather-permitting-bonus")).toBeNull();
  });

  it("sends a capitalised companion address to its canonical form", () => {
    // What a reader types after copying a page set in Cinzel, whose
    // lowercase glyphs are small caps.
    expect(printedAddressRedirect("https://valicepress.com/COMPANION/CODEX-BESTIARIUM"))
      .toBe("https://valicepress.com/companion/codex-bestiarium");
    // What a reader types out of ordinary sentence-case habit.
    expect(printedAddressRedirect("https://valicepress.com/Companion/Hangul"))
      .toBe("https://valicepress.com/companion/hangul");
    expect(printedAddressRedirect("https://valicepress.com/Codex-Enigmatica/Verify"))
      .toBe("https://valicepress.com/codex-enigmatica/verify");
  });

  it("leaves a correctly typed address alone", () => {
    expect(printedAddressRedirect("https://valicepress.com/companion/hangul")).toBeNull();
    expect(printedAddressRedirect("https://valicepress.com/")).toBeNull();
  });

  it("does not lowercase paths that are not printed in books", () => {
    // A blanket lowercase redirect would mask real broken links and would
    // break any future case-sensitive segment.
    expect(printedAddressRedirect("https://valicepress.com/Books/Some-Slug")).toBeNull();
    expect(printedAddressRedirect("https://valicepress.com/API/Events")).toBeNull();
  });

  it("keeps the query string a companion download may carry", () => {
    expect(printedAddressRedirect("https://valicepress.com/Companion/Hangul?from=book"))
      .toBe("https://valicepress.com/companion/hangul?from=book");
  });
});
