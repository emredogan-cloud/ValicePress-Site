import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFERRED_IMAGE_PLACEHOLDER } from "@/components/media/image-deferrer";

import { BookMarquee } from "./book-marquee";

/**
 * What the server sends for the home page's shelf. The covers are NOT asked for in the markup: the home page's hero
 * photograph is its largest paint, and these twelve (~550 kB) were being fetched beside it (see `image-deferrer.tsx`).
 */
const BOOKS = [
  { slug: "weather-permitting", title: "Weather Permitting", authors: ["Quinn Gallagher"] },
  { slug: "the-sweetest-season", title: "The Sweetest Season", authors: ["Harper Hayes"] },
  { slug: "the-great-book-of-world-games", title: "The Great Book of World Games", authors: ["Emre Doğan"] },
];

describe("<BookMarquee> — the shelf the server renders", () => {
  const html = renderToStaticMarkup(<BookMarquee books={BOOKS} />);
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const live = imgs.filter((i) => i.includes("data:image/gif"));

  it("draws every cover on a placeholder and carries the real file in data-src", () => {
    expect(live.length, "two lanes of three").toBe(6);
    for (const b of BOOKS) {
      const mine = live.filter((i) => i.includes(`data-src="/images/books/thumb/${b.slug}.webp"`));
      expect(mine, b.slug).toHaveLength(2);
    }
    expect(html).toContain(DEFERRED_IMAGE_PLACEHOLDER);
  });

  it("never names a cover's file in a `src` the browser would fetch at once", () => {
    for (const i of live) expect(i, i).not.toMatch(/\ssrc="\/images\//);
    expect(html).not.toContain('loading="lazy"');
  });

  it("keeps a real <img> for each cover inside <noscript>, for a visitor without JavaScript", () => {
    const noscripts = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map((m) => m[1]);
    expect(noscripts).toHaveLength(6);
    for (const n of noscripts) expect(n).toMatch(/<img src="\/images\/books\/thumb\/[a-z0-9-]+\.webp"/);
  });

  it("still says what each cover is: a name on the visible lane, none on its aria-hidden copy", () => {
    expect(live.filter((i) => i.includes('alt="Weather Permitting — cover"'))).toHaveLength(1);
    expect(live.filter((i) => i.includes('alt=""'))).toHaveLength(3);
  });
});
