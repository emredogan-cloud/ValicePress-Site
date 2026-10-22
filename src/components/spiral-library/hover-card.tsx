"use client";

import type { Ref } from "react";

import { offerLine } from "./library-list";
import type { LibraryBook } from "./library-shelves";

/**
 * The card beside a cover the pointer rests on: what the book is, and where it
 * can be bought. It informs and nothing more — no link, no button, no
 * navigation; clicking the cover is what opens Quick View.
 *
 * `aria-hidden`: every word on it is in the book's link in the library list.
 * The scene places it beside the cover's box on screen (`onHoverRect` in the
 * island), writing the position straight to the element because it changes
 * with every frame the camera moves.
 */
export function HoverCard({ book, ref }: { book: LibraryBook | null; ref: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none invisible absolute left-0 top-0 z-20 w-[17.5rem] rounded-xl border border-[rgba(201,162,92,0.3)] bg-[rgba(16,15,13,0.93)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
    >
      {book ? (
        <>
          <p className="font-serif text-[17px] leading-snug text-[var(--lib-gold)]">{book.item.title}</p>
          <p className="mt-0.5 text-[12.5px] text-fg-soft">{book.item.author}</p>
          {book.item.subtitle ? (
            <p className="mt-2.5 line-clamp-3 text-[12.5px] leading-relaxed text-fg-mid">{book.item.subtitle}</p>
          ) : null}
          {book.item.formats.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {book.item.formats.map((f) => (
                <li
                  key={f}
                  className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.08em] text-fg-mid"
                >
                  {f}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 border-t border-white/[0.08] pt-2.5 text-[12px] text-[var(--lib-cove)]">{offerLine(book)}</p>
          <p className="mt-1 text-[11px] text-fg-fade">Click the cover for details</p>
        </>
      ) : null}
    </div>
  );
}
