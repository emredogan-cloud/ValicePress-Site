"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { ShelfCategory } from "./library-shelves";

/**
 * The shelves, by name — the readable, operable copy of the gold lettering on
 * the bands. A slim column beside the library on a wide screen, a row of chips
 * under the header on a phone.
 *
 * A shelf is an in-page link (`#shelf-<slug>`), so a reader can share where they
 * are; the island turns the jump into a scroll to that shelf's stop. A
 * cross-shelf collection (Young Explorers: every one of its books stands on
 * another shelf) is not a shelf, so it is a toggle that picks its books out
 * wherever they stand, with a link to its own page.
 */
export interface RailShelf {
  category: ShelfCategory;
  count: number;
}

export interface RailCollection {
  category: ShelfCategory;
  count: number;
}

export function CollectionRail({
  shelves,
  collections,
  active,
  highlight,
  onShelf,
  onHighlight,
  collectionsAs = "toggles",
  layout,
}: {
  shelves: readonly RailShelf[];
  collections: readonly RailCollection[];
  /** Index of the shelf in front, or null when none is (list mode). */
  active: number | null;
  highlight: string | null;
  onShelf: (index: number) => void;
  onHighlight: (slug: string | null) => void;
  /** Toggles pick a collection's books out in the scene; with no scene (the list), they are links to its page. */
  collectionsAs?: "toggles" | "links";
  layout: "column" | "chips";
}) {
  const column = layout === "column";
  const nav = useRef<HTMLElement>(null);

  // A row of chips wider than the phone keeps the shelf in front in view.
  useEffect(() => {
    const row = nav.current;
    if (column || !row || active === null) return;
    const chip = row.querySelector<HTMLElement>("[aria-current]");
    if (!chip) return;
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active, column]);

  return (
    <nav
      ref={nav}
      aria-label="Shelves"
      className={
        column
          ? "pointer-events-auto w-[15.5rem]"
          : "pointer-events-auto w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
    >
      <ul className={column ? "flex flex-col gap-0.5" : "flex w-max gap-2 px-4 pb-1"}>
        {shelves.map(({ category, count }, i) => {
          const current = active === i;
          return (
            <li key={category.slug}>
              <a
                href={`#shelf-${category.slug}`}
                aria-current={current ? "location" : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onShelf(i);
                }}
                className={
                  column
                    ? `group flex min-h-10 items-center gap-3 rounded-md px-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lib-gold)] ${
                        current ? "text-[var(--lib-gold)]" : "text-fg-mid hover:text-fg-hi"
                      }`
                    : `flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lib-gold)] ${
                        current
                          ? "border-[var(--lib-brass)] bg-[rgba(201,162,92,0.14)] text-[var(--lib-gold)]"
                          : "border-white/[0.1] bg-black/45 text-fg-mid"
                      }`
                }
              >
                {column && (
                  <span
                    aria-hidden
                    className={`h-px transition-all ${current ? "w-6 bg-[var(--lib-gold)]" : "w-3 bg-white/25 group-hover:w-4"}`}
                  />
                )}
                <span className={column ? "flex-1" : undefined}>{category.name}</span>
                <span className="tabular-nums text-[11.5px] text-fg-soft">{count}</span>
              </a>
            </li>
          );
        })}
        {collections.map(({ category, count }) => {
          const on = highlight === category.slug;
          if (collectionsAs === "links") {
            return (
              <li key={category.slug}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-dashed border-white/[0.18] bg-black/45 px-4 text-[13px] text-fg-mid hover:text-fg-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lib-gold)]"
                >
                  {category.name}
                  <span className="tabular-nums text-[11.5px] text-fg-soft">{count}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={category.slug} className={column ? "mt-3 border-t border-white/[0.08] pt-3" : "flex items-center"}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onHighlight(on ? null : category.slug)}
                className={
                  column
                    ? `flex min-h-10 w-full items-center gap-3 rounded-md px-2 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lib-gold)] ${
                        on ? "text-[var(--lib-gold)]" : "text-fg-mid hover:text-fg-hi"
                      }`
                    : `flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lib-gold)] ${
                        on
                          ? "border-[var(--lib-brass)] bg-[rgba(201,162,92,0.14)] text-[var(--lib-gold)]"
                          : "border-dashed border-white/[0.18] bg-black/45 text-fg-mid"
                      }`
                }
              >
                {column && <span aria-hidden className="text-[10px] text-[var(--lib-brass)]">✦</span>}
                <span className={column ? "flex-1" : undefined}>
                  {category.name}
                  <span className="sr-only">, {count} books on other shelves</span>
                </span>
                <span aria-hidden className="tabular-nums text-[11.5px] text-fg-soft">
                  {count}
                </span>
              </button>
              {on && column && (
                <Link
                  href={`/categories/${category.slug}`}
                  className="mt-1 inline-flex min-h-10 items-center px-2 text-[12px] text-[var(--lib-brass)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--lib-gold)]"
                >
                  See all in {category.name} →
                </Link>
              )}
              {on && !column && (
                <Link
                  href={`/categories/${category.slug}`}
                  className="ml-2 inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-[var(--lib-brass)] bg-black/45 px-4 text-[13px] text-[var(--lib-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lib-gold)]"
                >
                  See all →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
