"use client";

import { useEffect, useState } from "react";

/**
 * The strip of anchors under the hero — Overview · Preview · About the book ·
 * About the author · Editions — that follows the reader down the page and says
 * which section they are in.
 *
 * They are plain in-page links, so they work without JavaScript and in a
 * reader's "links" list; the script only marks the one in view (IntersectionObserver
 * on the sections, nothing polled). A tab whose section the page did not render is
 * not offered: the server passes only the sections that exist.
 *
 * Sticky below the 64px header; on a phone the strip scrolls sideways inside
 * itself rather than wrapping or widening the page.
 */
export interface DetailTab {
  id: string;
  label: string;
}

export function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const els = tabs.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => e !== null);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    // A section is "current" while it covers the band just below the sticky bars
    // (header 64 + this strip ~52). Sections sit in different orders on the page
    // than in the strip, so track which are inside the band and pick the topmost.
    const inBand = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.set(e.target.id, e.boundingClientRect.top);
          else inBand.delete(e.target.id);
        }
        if (inBand.size === 0) return;
        const topmost = [...inBand.entries()].sort((a, b) => a[1] - b[1])[0][0];
        setActive(topmost);
      },
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [tabs]);

  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label="Sections of this page"
      className="sticky top-16 z-40 mt-12 border-y border-white/[0.06] bg-[#07110b]/85 backdrop-blur-xl sm:mt-16"
    >
      <ul className="mx-auto flex max-w-[1180px] gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:gap-3 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <li key={t.id} className="shrink-0">
              <a
                href={`#${t.id}`}
                aria-current={on ? "true" : undefined}
                className={`relative flex h-[52px] items-center px-3 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors sm:px-5 sm:text-[11px] ${
                  on ? "text-emerald-bright" : "text-fg-soft hover:text-fg-hi"
                }`}
              >
                {t.label}
                {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#33f0aa] shadow-[0_0_10px_#33f0aa] sm:inset-x-4" />}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
