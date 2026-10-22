"use client";

import Image from "next/image";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";

import type { LibraryBook, LibraryShelf } from "./library-shelves";

/**
 * The library as HTML: every shelf a heading, every book a real link to its
 * page. It is in the server's HTML, so a crawler and a reader without
 * JavaScript get all of it.
 *
 * TWO PRESENTATIONS OF ONE LIST.
 *   "index" — beside the 3D scene. Visually hidden, and the keyboard and screen
 *             reader surface of the scene: Tab walks the books shelf by shelf,
 *             the focused book's link shows as a caption at the foot of the
 *             stage, and the scene turns that cover to the front and lights it.
 *   "list"  — the library itself, for a device without WebGL, a reader saving
 *             data, or anyone who chose it: the same shelves as rows of covers.
 *
 * A plain press opens Quick View; ⌘/Ctrl/Shift-click and middle-click open the
 * book's page, as on the catalogue's cards.
 */

/** What a book's link says after its title and author: where it can be bought. */
export function offerLine(book: LibraryBook): string {
  if (book.amazonEditions.length > 0) {
    return `On Amazon: ${book.amazonEditions.map((e) => e.label).join(", ")}`;
  }
  return book.item.buyableHere ? "Sold here as a DRM-free digital edition" : "See the book’s page for where to buy it";
}

export type OpenVia = "pointer" | "keyboard";

interface ListProps {
  shelves: readonly LibraryShelf[];
  presentation: "index" | "list";
  onOpen: (slug: string, via: OpenVia) => void;
  /** Index presentation: a book's link took or lost keyboard focus. */
  onFocusBook?: (shelf: number, book: number, slug: string, visible: boolean) => void;
  onBlurBook?: () => void;
}

function intercept(e: MouseEvent<HTMLAnchorElement>, slug: string, onOpen: ListProps["onOpen"]) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  onOpen(slug, e.detail === 0 ? "keyboard" : "pointer");
}

/** ← and → move along the shelf, as they would across a row of books. */
function arrows(e: KeyboardEvent<HTMLAnchorElement>) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const li = e.currentTarget.closest("li");
  const next = e.key === "ArrowRight" ? li?.nextElementSibling : li?.previousElementSibling;
  const link = next?.querySelector("a");
  if (!link) return;
  e.preventDefault();
  link.focus();
}

export function LibraryList({ shelves, presentation, onOpen, onFocusBook, onBlurBook }: ListProps) {
  if (presentation === "index") {
    return (
      <div className="library-index">
        {shelves.map((shelf, i) => {
          const heading = `library-shelf-${shelf.category.slug}`;
          return (
            <div key={shelf.category.slug}>
              <h2 id={heading} className="sr-only">
                {shelf.category.name}, {shelf.books.length} {shelf.books.length === 1 ? "book" : "books"}
              </h2>
              <ul aria-labelledby={heading}>
                {shelf.books.map((b, j) => (
                  <li key={b.item.slug}>
                    <a
                      id={`library-book-${b.item.slug}`}
                      href={`/books/${b.item.slug}`}
                      onClick={(e) => intercept(e, b.item.slug, onOpen)}
                      onKeyDown={arrows}
                      onFocus={(e: FocusEvent<HTMLAnchorElement>) =>
                        onFocusBook?.(i, j, b.item.slug, e.currentTarget.matches(":focus-visible"))
                      }
                      onBlur={() => onBlurBook?.()}
                      className="absolute bottom-[5.5rem] left-1/2 z-30 flex max-w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 flex-col items-center gap-0.5 rounded-2xl border border-[rgba(201,162,92,0.5)] bg-[rgba(16,15,13,0.94)] px-5 py-2.5 text-center [clip-path:inset(50%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lib-gold)] focus-visible:[clip-path:none]"
                    >
                      <span className="font-serif text-[16px] leading-snug text-[var(--lib-gold)]">{b.item.title}</span>
                      <span className="text-[12px] text-fg-mid">
                        by {b.item.author}
                        <span className="sr-only">. {offerLine(b)}. </span>
                      </span>
                      <span aria-hidden className="text-[11px] text-fg-soft">
                        Enter for details · ← → along the shelf
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
      {shelves.map((shelf) => {
        const heading = `library-shelf-${shelf.category.slug}`;
        return (
          <section
            key={shelf.category.slug}
            id={`shelf-${shelf.category.slug}`}
            aria-labelledby={heading}
            className="scroll-mt-20 border-t border-white/[0.07] py-8 first:border-t-0"
          >
            <h2 id={heading} className="flex items-baseline gap-3 font-serif text-[22px] text-[var(--lib-gold)]">
              {shelf.category.name}
              <span className="font-sans text-[12px] tabular-nums text-fg-soft">
                {shelf.books.length} {shelf.books.length === 1 ? "book" : "books"}
              </span>
            </h2>
            <ul className="mt-5 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
              {shelf.books.map((b) => (
                <li key={b.item.slug} className="min-w-0">
                  <a
                    href={`/books/${b.item.slug}`}
                    onClick={(e) => intercept(e, b.item.slug, onOpen)}
                    className="group block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--lib-gold)]"
                  >
                    <span
                      className="relative block overflow-hidden rounded-[4px] bg-[#3d3024] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                      style={{ aspectRatio: `1 / ${b.aspect}` }}
                    >
                      {b.item.coverSrc ? (
                        <Image
                          src={b.item.coverSrc}
                          alt=""
                          fill
                          sizes="(min-width: 1280px) 150px, (min-width: 768px) 16vw, (min-width: 640px) 24vw, 31vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                      ) : null}
                    </span>
                    <span className="mt-2 line-clamp-2 block text-[12.5px] leading-snug text-fg-hi">{b.item.title}</span>
                    <span className="block truncate text-[11.5px] text-fg-soft">
                      {b.item.author}
                      <span className="sr-only">. {offerLine(b)}.</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
