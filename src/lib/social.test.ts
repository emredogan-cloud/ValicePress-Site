import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SOCIAL_LINKS, SOCIAL_URLS, TWITTER_SITE } from "./social";

/**
 * The press's social addresses are written ONCE (`./social.ts`). Everything that shows
 * them — footer, mobile menu, About page, founder card, structured data, Twitter card —
 * reads that list, so correcting an address is a one-line change and a stale one cannot
 * survive in a corner nobody looked at.
 */

const SRC = path.resolve(__dirname, "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|json|mdx?|css|html)$/.test(name)) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC);
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => path.relative(SRC, f);

/** The one file that may contain the addresses, and the tests that pin them independently. */
const MAY_NAME_THE_ADDRESSES = new Set(["lib/social.ts", "lib/social.test.ts", "lib/seo.test.ts"]);

describe("the press's social profiles", () => {
  it("are the four the founder gave, in the order they are shown", () => {
    expect(SOCIAL_LINKS.map((l) => [l.id, l.href])).toEqual([
      ["x", "https://x.com/ValicePress"],
      ["instagram", "https://www.instagram.com/valicepress/"],
      ["facebook", "https://www.facebook.com/profile.php?id=61594861742767"],
      ["tiktok", "https://www.tiktok.com/@valicepress"],
    ]);
  });

  it("are https addresses with no tracking and no duplicates", () => {
    for (const l of SOCIAL_LINKS) {
      const u = new URL(l.href);
      expect(u.protocol).toBe("https:");
      expect(u.hash).toBe("");
      // Facebook's numeric profile id is the only query string any of them needs.
      if (l.id !== "facebook") expect(u.search).toBe("");
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.handle.length).toBeGreaterThan(0);
      expect(l.blurb.length).toBeGreaterThan(0);
    }
    expect(new Set(SOCIAL_URLS).size).toBe(SOCIAL_URLS.length);
    expect(SOCIAL_URLS).toEqual(SOCIAL_LINKS.map((l) => l.href));
  });

  it("name the same account the Twitter card names", () => {
    const x = SOCIAL_LINKS.find((l) => l.id === "x")!;
    expect(TWITTER_SITE).toBe(`@${new URL(x.href).pathname.slice(1)}`);
    expect(x.handle).toBe(TWITTER_SITE);
  });
});

describe("one source", () => {
  const needles = SOCIAL_LINKS.map((l) => l.href.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase());

  it("no file in src/ spells out one of the four addresses except the list itself and the tests that pin it", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (MAY_NAME_THE_ADDRESSES.has(rel(f))) continue;
      const text = read(f).toLowerCase();
      for (const n of needles) if (text.includes(n)) offenders.push(`${rel(f)} contains ${n}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the earlier personal handle and the code-host link are gone from the shipped source", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (MAY_NAME_THE_ADDRESSES.has(rel(f)) || /\.test\.tsx?$/.test(f)) continue;
      const text = read(f).toLowerCase();
      for (const stale of ["emredogancloud", "emredogan-cloud", "github.com/"]) {
        if (text.includes(stale)) offenders.push(`${rel(f)} contains ${stale}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every consumer reads the list (no component keeps a private copy of the networks)", () => {
    for (const f of ["components/home/home-footer.tsx", "components/home/mobile-nav.tsx", "components/about/founder-card.tsx"]) {
      expect(read(path.join(SRC, f)), f).toMatch(/SocialLinks/);
    }
    expect(read(path.join(SRC, "components/about/next-steps-grid.tsx"))).toMatch(/SOCIAL_LINKS/);
    expect(read(path.join(SRC, "lib/seo.ts"))).toMatch(/SOCIAL_URLS/);
    expect(read(path.join(SRC, "lib/metadata.ts"))).toMatch(/TWITTER_SITE/);
    expect(read(path.join(SRC, "app/layout.tsx"))).toMatch(/TWITTER_SITE/);
  });
});
