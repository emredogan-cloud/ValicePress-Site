import { describe, expect, it } from "vitest";

import { scaleSizes } from "./image-sizes";

describe("scaleSizes", () => {
  it("scales every length and keeps the media conditions", () => {
    expect(scaleSizes("(min-width: 1024px) 34vw, 90vw", 0.38)).toBe("(min-width: 1024px) calc(34vw * 0.38), calc(90vw * 0.38)");
  });

  it("a single bare length", () => {
    expect(scaleSizes("50vw", 0.5)).toBe("calc(50vw * 0.5)");
  });

  it("several conditions, and a condition with 'and'", () => {
    expect(scaleSizes("(min-width: 1280px) and (max-width: 1500px) 300px, (min-width: 640px) 200px, 100px", 0.5)).toBe(
      "(min-width: 1280px) and (max-width: 1500px) calc(300px * 0.5), (min-width: 640px) calc(200px * 0.5), calc(100px * 0.5)",
    );
  });

  it("a length that is itself a function with a comma is one length", () => {
    expect(scaleSizes("(min-width: 640px) 440px, min(78vw, 440px)", 0.5)).toBe("(min-width: 640px) calc(440px * 0.5), calc(min(78vw, 440px) * 0.5)");
  });

  it("the default of the cover stack reads sensibly", () => {
    expect(scaleSizes("(min-width: 1024px) 20vw, 50vw", 0.38)).toBe("(min-width: 1024px) calc(20vw * 0.38), calc(50vw * 0.38)");
  });
});
