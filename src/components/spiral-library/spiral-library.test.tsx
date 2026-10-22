import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOOKS, CATEGORIES } from "../../../scripts/catalog/valice-catalog.mjs";

import type { BookEdition } from "@/components/book-card";
import { toCatalogItems } from "@/components/catalog/catalog-item";
import { bookCoverSrc } from "@/lib/asset-map";
import { withKindleEditions } from "@/lib/kindle-editions";

import { buildLibraryShelves, withCollections } from "./library-shelves";
import { SpiralLibrary } from "./spiral-library";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- a stand-in for next/image in jsdom
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// The real catalogue, as `/books` builds it: published records → catalogue items → collections joined.
interface Rec {
  slug: string;
  title: string;
  websiteStatus: string;
  categories: string[];
  formats: Array<BookEdition & { amazonAsin: string | null }>;
}
const published = (BOOKS as unknown as Rec[]).filter((b) => b.websiteStatus === "published");
const items = toCatalogItems(
  published.map((b) => ({
    id: b.slug,
    slug: b.slug,
    title: b.title,
    priceCents: 0,
    currency: "USD",
    authors: [],
    coverSrc: bookCoverSrc(b.slug),
    editions: withKindleEditions(b.formats.map((f) => ({ ...f, isbn: null, masterFileKey: null })))
      .filter((f) => f.availability !== "unavailable")
      .map((f) => ({ ...f, currency: "USD" })),
  })),
);
const collections = (CATEGORIES as unknown as Array<{ slug: string; name: string }>).map((c) => ({
  slug: c.slug,
  name: c.name,
  bookSlugs: published.filter((b) => b.categories.includes(c.slug)).map((b) => b.slug),
}));
const joined = withCollections(items, collections);
const library = buildLibraryShelves(joined.books, joined.categories);

describe("SpiralLibrary — the server's HTML (what a crawler and a reader without JavaScript get)", () => {
  const html = renderToString(<SpiralLibrary library={library} />);
  const doc = new DOMParser().parseFromString(html, "text/html");

  it("holds the page's one <h1>, and marks itself as holding the newsletter popup", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector("h1")?.textContent).toBe("All books");
    const section = doc.querySelector("section");
    expect(section?.hasAttribute("data-holds-popup")).toBe(true);
    expect(section?.getAttribute("data-library")).toBe("pending");
  });

  it("links every published book once, by its own page, shelf by shelf", () => {
    const links = [...doc.querySelectorAll<HTMLAnchorElement>('.library-index a[href^="/books/"]')].map((a) => a.getAttribute("href"));
    expect(links).toHaveLength(published.length);
    expect(new Set(links).size).toBe(published.length);
    const headings = [...doc.querySelectorAll(".library-index h2")].map((h) => h.textContent?.split(",")[0]);
    expect(headings).toEqual(library.shelves.map((s) => s.category.name));
  });

  it("names the shelves in a rail, and offers the cross-shelf collection as a toggle, not a shelf", () => {
    const rail = doc.querySelector('nav[aria-label="Shelves"]');
    const shelfLinks = [...(rail?.querySelectorAll('a[href^="#shelf-"]') ?? [])].map((a) => a.getAttribute("href"));
    expect(shelfLinks).toEqual(library.shelves.map((s) => `#shelf-${s.category.slug}`));
    for (const c of library.crossShelfCategories) {
      expect(rail?.textContent).toContain(c.name);
      expect(shelfLinks).not.toContain(`#shelf-${c.slug}`);
    }
  });

  it("sends no canvas: the scene is loaded in the browser, after the page", () => {
    expect(doc.querySelector("canvas")).toBeNull();
  });
});

describe("SpiralLibrary — a browser without WebGL 2 gets the list, which is the whole library", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows every shelf as a list of its books, each a link to the book's page, and cannot switch to the scene", () => {
    const { container } = render(<SpiralLibrary library={library} />);
    expect(container.querySelector("section")?.getAttribute("data-library")).toBe("list");
    expect(container.querySelector("canvas")).toBeNull();
    for (const shelf of library.shelves) {
      const section = container.querySelector(`#shelf-${shelf.category.slug}`) as HTMLElement;
      expect(section, shelf.category.slug).not.toBeNull();
      expect(within(section).getAllByRole("link")).toHaveLength(shelf.books.length);
    }
    expect((screen.getByRole("button", { name: "Library" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed")).toBe("true");
  });
});
