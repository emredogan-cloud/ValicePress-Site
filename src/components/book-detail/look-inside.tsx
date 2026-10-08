"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Dialog, DialogBody, DialogClose } from "@/components/ui/dialog";
import type { LookInsideTile } from "@/lib/book-detail";

/**
 * What the browser is told about the width of a strip tile — the same numbers the tile's classes use
 * below: a banner (ratio > 1.15) is `min(100vw - 128px, 440px)` wide on a phone, a page is 230px tall there,
 * and from `sm` every tile is 290px tall. Promising `80vw` for a 150px page made a phone fetch a 1080px file.
 *
 * The 128px is what makes the row look like a row: the strip is `100vw - 72px` wide (16px of page gutter and
 * 20px of card padding a side), so a banner of `100vw - 128px` leaves 56px, of which the 16px gap is not a
 * tile — 40px of the next one shows. At `78vw` the banner and the gap filled the strip exactly, and the
 * phone showed one picture and nothing to say there were more.
 */
export function tileSizes(width: number, height: number): string {
  const ratio = width / height;
  const wide = ratio > 1.15;
  return `(min-width: 640px) ${Math.round(290 * ratio)}px, ${wide ? "min(calc(100vw - 128px), 440px)" : `${Math.round(230 * ratio)}px`}`;
}

/**
 * Look inside — the card on a book's page that shows what is in the book before
 * anyone buys it: the book's own A+ pictures first, then real pages of the
 * interior (rendered from the same PDF the buyer gets), then the back cover and
 * the two passages. The row shows the first of them; the button (or any tile)
 * opens a viewer that steps through all of it.
 *
 * What it will not do: show another book's picture, repeat a picture, or pad a
 * book that has little with something that is not its own. `lookInsideTiles`
 * builds the list from files that exist under this book's slug.
 *
 * The viewer is the shared `Dialog` — it locks the page once, closes on Escape
 * and on Android Back, returns focus to the tile that opened it — and adds
 * Left/Right arrows and swipe for stepping.
 */
export function LookInside({
  title,
  note,
  strip,
  all,
}: {
  title: string;
  /** One line about what the pages are ("The first four pages of Chapter One."). */
  note: string | null;
  /** What the row shows. */
  strip: LookInsideTile[];
  /** Everything the viewer steps through (a superset of `strip`, in the same order). */
  all: LookInsideTile[];
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Focus goes back to whatever opened the viewer: `Dialog` captures the active element itself.
  const openAt = useCallback(
    (id: string) => {
      setIndex(Math.max(0, all.findIndex((t) => t.id === id)));
      setOpen(true);
    },
    [all],
  );

  if (strip.length === 0) return null;
  const firstIsAplus = strip[0].kind === "aplus";

  return (
    <section id="preview" aria-labelledby="look-inside-heading" className="mx-auto mt-10 max-w-[1180px] scroll-mt-36 px-4 sm:mt-14 sm:px-6">
      <div className="home-glass overflow-hidden rounded-[22px] p-5 sm:p-8 lg:grid lg:grid-cols-[minmax(0,_250px)_minmax(0,_1fr)] lg:items-center lg:gap-10">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">Preview</p>
          <h2 id="look-inside-heading" className="mt-3 font-serif text-[34px] font-medium leading-tight text-fg-hi sm:text-[42px]">
            Look inside
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-mid">
            {note ??
              (firstIsAplus
                ? `Pictures from ${title}’s own A+ page, and what is inside the cover.`
                : `What is inside ${title}.`)}
          </p>
          <button
            type="button"
            onClick={() => openAt(all[0].id)}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-[#33f0aa]/45 px-6 text-[14px] font-medium text-emerald-bright transition-colors hover:bg-[#33f0aa]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright"
          >
            Read preview
            <span aria-hidden>→</span>
          </button>
        </div>

        {/* The row. Each tile keeps the shape of its picture (a page is portrait, an A+
            picture is a wide banner), so nothing is cropped or stretched; on a phone a banner is
            shorter than a page and sits in the middle of the row's height rather than hanging from
            the top of it. It scrolls sideways inside itself; the page never does. */}
        <ul
          aria-label={`Pictures from ${title}`}
          className="mt-7 flex snap-x snap-mandatory items-center gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] lg:mt-0"
        >
          {strip.map((t) => {
            // A banner is sized by width on a phone (so one is visible whole beside a hint of the next),
            // everything else by height; from `sm` all of them share one height.
            const wide = t.width / t.height > 1.15;
            return (
              <li key={t.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => openAt(t.id)}
                  aria-label={`Open: ${t.alt}`}
                  className={`group relative block overflow-hidden rounded-[12px] border border-white/[0.08] bg-[#0a1410] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright sm:h-[290px] sm:w-auto ${
                    wide ? "w-[min(calc(100vw_-_128px),440px)]" : "h-[230px]"
                  }`}
                  style={{ aspectRatio: `${t.width} / ${t.height}` }}
                >
                  <Image src={t.src} alt="" fill sizes={tileSizes(t.width, t.height)} className="object-cover" />
                  {t.kind === "page" && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-center text-[11px] tabular-nums text-white/80">
                      {t.caption}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Viewer title={title} tiles={all} index={index} setIndex={setIndex} open={open} onOpenChange={setOpen} />
    </section>
  );
}

/* ------------------------------------------------------------------ viewer */

function Viewer({
  title,
  tiles,
  index,
  setIndex,
  open,
  onOpenChange,
}: {
  title: string;
  tiles: LookInsideTile[];
  index: number;
  setIndex: (i: number) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const last = tiles.length - 1;
  const step = useCallback((d: number) => setIndex(Math.max(0, Math.min(last, index + d))), [index, last, setIndex]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step]);

  const tile = tiles[Math.min(index, last)];
  if (!tile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} labelledBy="look-inside-viewer-title" size="xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <h2 id="look-inside-viewer-title" className="truncate font-serif text-[17px] text-fg-hi sm:text-[19px]">
            Look inside · {title}
          </h2>
          <p className="text-[12px] tabular-nums text-fg-soft" aria-live="polite">
            {Math.min(index, last) + 1} / {tiles.length}
            {tile.caption ? ` · ${tile.caption}` : ""}
          </p>
        </div>
        <DialogClose aria-label="Close preview" />
      </div>

      <DialogBody className="bg-black/30 p-3 sm:p-5">
        <div
          className="relative mx-auto flex max-w-full items-center justify-center"
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            const t = e.changedTouches[0];
            if (!start || !t) return;
            const dx = t.clientX - start.x;
            // a deliberate sideways swipe only — a vertical scroll must not turn the page
            if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(t.clientY - start.y)) step(dx < 0 ? 1 : -1);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- already a right-sized WebP from /public, in a viewer that must open at once */}
          <img
            key={tile.id}
            src={tile.src}
            alt={tile.alt}
            width={tile.width}
            height={tile.height}
            decoding="async"
            className="block h-auto max-h-[calc(100dvh-210px)] w-auto max-w-full rounded-[10px] object-contain"
          />
          {tiles.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={index === 0}
                aria-label="Previous picture"
                className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-fg-hi backdrop-blur transition-opacity hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-emerald-bright disabled:pointer-events-none disabled:opacity-0"
              >
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={index === last}
                aria-label="Next picture"
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-fg-hi backdrop-blur transition-opacity hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-emerald-bright disabled:pointer-events-none disabled:opacity-0"
              >
                <ChevronRight aria-hidden className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {tiles.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="All pictures">
            {tiles.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show picture ${i + 1}: ${t.caption || t.kind}`}
                aria-current={i === index ? "true" : undefined}
                className={`relative h-14 shrink-0 overflow-hidden rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-emerald-bright ${
                  i === index ? "border-[#33f0aa]" : "border-white/[0.1] opacity-70 hover:opacity-100"
                }`}
                style={{ aspectRatio: `${t.width} / ${t.height}` }}
              >
                <Image src={t.src} alt="" fill sizes="120px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogBody>
    </Dialog>
  );
}
