import { describe, expect, it } from "vitest";

import { isBookId } from "./reader-access";

/**
 * The shape guard in front of the reader.
 *
 * It is not what makes a book private — a session and an entitlement are — but
 * it is the reason a hostile `bookId` never reaches a query, a storage key, or
 * a log line of unbounded length. Every value below is something an attacker
 * would actually put in that path segment.
 */
describe("isBookId", () => {
  it("accepts the ids this application mints", () => {
    for (const id of [
      "e7548256-63eb-4e31-b2af-62445aaa2060",
      "E7548256-63EB-4E31-B2AF-62445AAA2060",
      "0f9d3b1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
    ]) {
      expect(isBookId(id), id).toBe(true);
    }
  });

  it("refuses anything that could be read as a path", () => {
    for (const value of [
      "../../etc/passwd",
      "..%2F..%2Fetc%2Fpasswd",
      "books/meditations/master/v1/master.pdf",
      "e7548256-63eb-4e31-b2af-62445aaa2060/../other",
      "/e7548256-63eb-4e31-b2af-62445aaa2060",
      "a/b",
      "..",
      ".",
    ]) {
      expect(isBookId(value), value).toBe(false);
    }
  });

  it("refuses slugs, which is what a person guessing would try first", () => {
    // The storefront's URLs are slugs and the reader's are uuids. Someone who
    // has only ever seen `/books/kwaidan` will try `/read/kwaidan`, and that
    // must cost one 404, not a catalogue lookup.
    for (const slug of ["kwaidan", "codex-bestiarium", "meditations"]) {
      expect(isBookId(slug), slug).toBe(false);
    }
  });

  it("refuses SQL and markup shapes without querying on them", () => {
    for (const value of [
      "' OR 1=1--",
      "e7548256-63eb-4e31-b2af-62445aaa2060' OR '1'='1",
      "<script>alert(1)</script>",
      "${process.env.DATABASE_URL}",
      "%00",
      "null",
      "undefined",
    ]) {
      expect(isBookId(value), value).toBe(false);
    }
  });

  it("refuses a uuid that is nearly right", () => {
    for (const value of [
      "e7548256-63eb-4e31-b2af-62445aaa206", // one short
      "e7548256-63eb-4e31-b2af-62445aaa20600", // one long
      "e7548256_63eb_4e31_b2af_62445aaa2060", // wrong separator
      "e7548256-63eb-0e31-b2af-62445aaa2060", // version nibble 0
      "e7548256-63eb-4e31-02af-62445aaa2060", // variant nibble 0
      "g7548256-63eb-4e31-b2af-62445aaa2060", // not hex
      "00000000-0000-0000-0000-000000000000", // the nil uuid
    ]) {
      expect(isBookId(value), value).toBe(false);
    }
  });

  it("refuses absurd input rather than logging it or querying on it", () => {
    expect(isBookId("")).toBe(false);
    expect(isBookId("a".repeat(100_000))).toBe(false);
  });

  it("refuses non-strings, which is what a tampered JSON body carries", () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      expect(isBookId(value)).toBe(false);
    }
  });
});
