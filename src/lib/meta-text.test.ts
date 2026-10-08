import { describe, expect, it } from "vitest";

import { bookDescription, clampText, joinList, META_DESCRIPTION_MAX } from "./meta-text";

describe("clampText", () => {
  it("leaves a short text alone, with its whitespace tidied", () => {
    expect(clampText("  A small   town\nromance. ")).toBe("A small town romance.");
  });

  it("stops at the end of the last sentence that fits, with no ellipsis", () => {
    const text = "A strict medical director. A fearless flight paramedic. One rule they couldn't keep. And then the storm closed the only road out of the valley for good.";
    expect(clampText(text, 100)).toBe("A strict medical director. A fearless flight paramedic. One rule they couldn't keep.");
  });

  it("with no sentence end in reach, stops at a natural pause and says it goes on", () => {
    const text = "Stewart Culin's 1894 Paper, Annotated — with a Playing Guide to the Games of Korea and a Register of every Board, Piece and Rule";
    const out = clampText(text, 80);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(text.startsWith(out.slice(0, -1))).toBe(true);
  });

  it("with no pause either, stops at a word, never inside one", () => {
    const text = "word ".repeat(60).trim();
    const out = clampText(text, 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, -1).split(" ").every((w) => w === "word")).toBe(true);
  });

  it("one unbroken string is cut, not looped on", () => {
    const out = clampText("x".repeat(400), 60);
    expect(out.length).toBeLessThanOrEqual(60);
  });

  it("never exceeds the maximum, whatever it is given", () => {
    const samples = [
      "Short.",
      "A sentence that is a bit long. ".repeat(20),
      "Volume One: The Gods — 8 Chapters Complete in the 1922 Text, Annotated, with the Register of Every Name",
      "one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen",
    ];
    for (const s of samples) for (const max of [40, 90, META_DESCRIPTION_MAX]) expect(clampText(s, max).length, `${max}: ${s.slice(0, 30)}`).toBeLessThanOrEqual(max);
  });
});

describe("bookDescription", () => {
  const blurb = "Six years of seeing the world. One summer to get it back. Mara comes home to a town that kept her room exactly as it was.\n\nA second paragraph that must not be used.";

  it("a long subtitle is already a description, and is used as it is", () => {
    const sub = "Stewart Culin's 1895 Survey, Annotated — with a Register of Every Game";
    expect(bookDescription({ title: "Korean Games", subtitle: sub, description: blurb })).toBe(sub);
  });

  it("a short subtitle is a tag: it leads, and the book's own opening follows", () => {
    const d = bookDescription({ title: "The Long Way Back", subtitle: "A Small Town Romance", description: blurb });
    expect(d.startsWith("A Small Town Romance. Six years of seeing the world.")).toBe(true);
    expect(d.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(d).not.toContain("second paragraph");
  });

  it("two books under the same tag read as two books", () => {
    const a = bookDescription({ title: "The Long Way Back", subtitle: "A Small Town Romance", description: "Six years of seeing the world. One summer to get it back." });
    const b = bookDescription({ title: "All the Quiet Places", subtitle: "A Small Town Romance", description: "A grieving single father. A café that is not for sale." });
    expect(a).not.toBe(b);
  });

  it("no blurb → the subtitle; nothing at all → the title, never an empty string", () => {
    expect(bookDescription({ title: "T", subtitle: "A Tag", description: null })).toBe("A Tag");
    expect(bookDescription({ title: "T", subtitle: null, description: "" })).toBe("T — Valice Press");
  });

  it("no subtitle → the blurb's opening", () => {
    expect(bookDescription({ title: "T", subtitle: null, description: "An opening sentence. And more." })).toBe("An opening sentence. And more.");
  });

  it("strips markup from the blurb, and a trailing full stop on the tag is not doubled", () => {
    const d = bookDescription({ title: "T", subtitle: "A Tag.", description: "**Bold** start with a [link](https://x.test) and <em>tags</em>." });
    expect(d).toBe("A Tag. Bold start with a link and tags.");
  });
});

describe("joinList", () => {
  it("reads a list the way it would be said", () => {
    expect(joinList([])).toBe("");
    expect(joinList(["A"])).toBe("A");
    expect(joinList(["A", "B"])).toBe("A and B");
    expect(joinList(["A", "B", "C"])).toBe("A, B and C");
  });

  it("past three items counts the rest instead of listing them", () => {
    expect(joinList(["A", "B", "C", "D"])).toBe("A, B, C and 1 more");
    expect(joinList(["A", "B", "C", "D", "E", "F"])).toBe("A, B, C and 3 more");
  });

  it("ignores blank entries", () => {
    expect(joinList(["A", " ", "B"])).toBe("A and B");
  });
});
