import { describe, expect, it } from "vitest";

import { csvCell, csvRow } from "./csv";

describe("csvCell", () => {
  it("quotes everything and doubles inner quotes", () => {
    expect(csvCell("plain")).toBe('"plain"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a,b\nc")).toBe('"a,b\nc"');
  });

  it("an empty value is an empty cell, not the word null", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell("")).toBe('""');
  });

  it("numbers and booleans are written plainly", () => {
    expect(csvCell(0)).toBe('"0"');
    expect(csvCell(false)).toBe('"false"');
  });

  it.each(["=1+1", '=HYPERLINK("http://evil.example","click")', "+SUM(A1)", "-2+3", "@cmd", "\tx", "\rx"])(
    "neutralises a cell that a spreadsheet would run as a formula: %j",
    (cell) => {
      const out = csvCell(cell);
      expect(out.startsWith(`"'`)).toBe(true);
      // the dangerous character is no longer first in the cell
      expect(out.slice(1)[0]).toBe("'");
    },
  );

  it("does not touch a cell that merely contains those characters later on", () => {
    expect(csvCell("a=b")).toBe('"a=b"');
    expect(csvCell("jane+books@gmail.com")).toBe('"jane+books@gmail.com"');
  });

  it("csvRow joins cells", () => {
    expect(csvRow(["a", 1, null, "=x"])).toBe(`"a","1","","'=x"`);
  });
});
