import { describe, expect, it } from "vitest";

import { tileSizes } from "./look-inside";

describe("tileSizes — what the Look Inside strip promises the browser", () => {
  it("a portrait page is a narrow tile: ~150px on a phone, ~190px from sm — not 80vw", () => {
    expect(tileSizes(262, 393)).toBe("(min-width: 640px) 193px, 153px");
  });

  it("a wide A+ banner is as wide as the phone allows less a peek of the next tile (up to 440px), and 290px tall times its ratio from sm", () => {
    expect(tileSizes(314, 129)).toBe("(min-width: 640px) 706px, min(calc(100vw - 128px), 440px)");
  });

  it("the boundary: a ratio of exactly 1.15 is still a 'page'", () => {
    expect(tileSizes(115, 100)).toBe("(min-width: 640px) 334px, 265px");
  });
});
