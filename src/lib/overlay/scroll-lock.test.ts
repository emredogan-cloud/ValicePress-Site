import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { isScrollLocked, lockScroll } from "./scroll-lock";

const html = () => document.documentElement;
const body = () => document.body;

afterEach(() => {
  html().removeAttribute("style");
  body().removeAttribute("style");
});

describe("lockScroll", () => {
  it("locks html and body, and puts back exactly what the page had", () => {
    html().style.overflow = "scroll";
    body().style.overflow = "auto";
    body().style.paddingRight = "7px";

    const release = lockScroll();
    expect(html().style.overflow).toBe("hidden");
    expect(body().style.overflow).toBe("hidden");
    expect(isScrollLocked()).toBe(true);

    release();
    expect(html().style.overflow).toBe("scroll");
    expect(body().style.overflow).toBe("auto");
    expect(body().style.paddingRight).toBe("7px");
    expect(isScrollLocked()).toBe(false);
  });

  it("leaves the page unlocked and untouched when nothing had set a value", () => {
    const release = lockScroll();
    release();
    expect(html().style.overflow).toBe("");
    expect(body().style.overflow).toBe("");
  });

  // The bug this module exists for: with save/restore pairs, closing A then B
  // wrote back "hidden" and the page stayed locked with nothing open.
  it("stays locked until the LAST holder lets go, in any release order", () => {
    const a = lockScroll();
    const b = lockScroll();

    a(); // first-in released first: not last-in-first-out
    expect(isScrollLocked()).toBe(true);
    expect(body().style.overflow).toBe("hidden");

    b();
    expect(isScrollLocked()).toBe(false);
    expect(body().style.overflow).toBe("");
  });

  it("restores the page's own values, not the values another overlay read", () => {
    body().style.overflow = "auto";
    const a = lockScroll();
    const b = lockScroll(); // would have "read" hidden under save/restore pairs
    b();
    a();
    expect(body().style.overflow).toBe("auto");
  });

  it("ignores a second release, so it cannot release somebody else's hold", () => {
    const a = lockScroll();
    const b = lockScroll();
    a();
    a(); // double release — must not count against b
    expect(isScrollLocked()).toBe(true);
    b();
    expect(isScrollLocked()).toBe(false);
  });

  it("can lock again after a full release", () => {
    lockScroll()();
    const again = lockScroll();
    expect(body().style.overflow).toBe("hidden");
    again();
    expect(body().style.overflow).toBe("");
  });
});

/**
 * HYGIENE GUARD — the lock stays in one place.
 *
 * Five components used to write the page's overflow themselves. Nothing stopped
 * a sixth. This fails the build if any module other than the lock assigns
 * `body.style.overflow` / `documentElement.style.overflow`, so the next overlay
 * author finds `lockScroll` instead of reinventing the stuck-lock bug.
 */
describe("scroll lock hygiene", () => {
  const SRC = path.resolve(__dirname, "../..");
  const ALLOWED = new Set([path.resolve(__dirname, "scroll-lock.ts")]);

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
    }
    return out;
  }

  it("has no overflow writer outside src/lib/overlay/scroll-lock.ts", () => {
    const offenders: string[] = [];
    // `body.style.overflow =`, `html.style.overflow =`, `documentElement.style.overflow =`
    const writer = /\b(?:body|html|documentElement)\.style\.overflow(?:X|Y)?\s*=(?!=)/;
    for (const file of walk(SRC)) {
      if (ALLOWED.has(file)) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (writer.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1}  ${line.trim()}`);
        });
    }
    expect(offenders, `use lockScroll() from "@/lib/overlay/scroll-lock":\n${offenders.join("\n")}`).toEqual([]);
  });
});
