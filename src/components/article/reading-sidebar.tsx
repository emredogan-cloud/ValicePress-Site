"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { BlogPostHeading } from "@/lib/blog";

import { SharePanel } from "./share-panel";

/**
 * Sticky reading-tools sidebar — TOC + Share.
 *
 * Per the brief: the **vertical emerald progress line** sits on the
 * RIGHT edge of the TOC card (acting as the visual border between the
 * sidebar and the article body) and a glowing node on that line
 * horizontally aligns with the currently active TOC item.
 *
 * Client Component because:
 *   - IntersectionObserver tracks which heading is currently in view
 *     and drives the `activeId` highlight + the node-position.
 *   - The Share panel needs clipboard interactivity (it lives below
 *     the TOC card).
 */
export function ReadingSidebar({ toc }: { toc: BlogPostHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);
  const [tocOpen, setTocOpen] = useState(false);
  const [nodeOffset, setNodeOffset] = useState(0);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());

  // Watch headings — set activeId to the top-most visible one.
  useEffect(() => {
    if (toc.length === 0) return;

    const headings: HTMLElement[] = toc
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the heading closest to the top of viewport that is still
        // visible (or just-past). We re-derive from the current Map of
        // all observed entries every time to avoid stale state.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]) {
          setActiveId(visible[0].target.id);
          return;
        }
        // No visible? — pick the last heading whose top is above the
        // viewport. This keeps the active marker pinned to the section
        // the user has just read past.
        const above = entries
          .filter((e) => e.boundingClientRect.top < 0)
          .sort(
            (a, b) =>
              b.boundingClientRect.top - a.boundingClientRect.top,
          );
        if (above[0]) setActiveId(above[0].target.id);
      },
      {
        rootMargin: "-80px 0px -65% 0px",
        threshold: [0, 0.1, 0.5, 1],
      },
    );

    for (const h of headings) observer.observe(h);
    return () => observer.disconnect();
  }, [toc]);

  // Re-position the glowing node whenever activeId or layout changes.
  useEffect(() => {
    if (!activeId) return;
    const el = itemRefs.current.get(activeId);
    const parent = el?.parentElement?.parentElement; // <li> → <ol>
    if (!el || !parent) return;
    // Center the node vertically on the active item's middle Y.
    const elRect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const center = elRect.top - parentRect.top + elRect.height / 2;
    setNodeOffset(center);
  }, [activeId, toc]);

  // Re-measure on window resize too (the layout shifts).
  useEffect(() => {
    function onResize() {
      if (!activeId) return;
      const el = itemRefs.current.get(activeId);
      const parent = el?.parentElement?.parentElement;
      if (!el || !parent) return;
      const elRect = el.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      setNodeOffset(elRect.top - parentRect.top + elRect.height / 2);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeId]);

  // The wrapper is a plain <div>, not an <aside>: the table of contents is a <nav aria-label> of its own,
  // and a complementary landmark inside the page's <main> is nested in another landmark.
  // Hide entirely if the post has no headings — sidebar would be empty
  // chrome. Share panel can still render below this null guard, so we
  // return a degraded version with only Share in that case.
  if (toc.length === 0) {
    return (
      <div className="space-y-5">
        <SharePanel />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* TOC card */}
      <nav
        aria-label="On this page"
        className="home-glass relative overflow-visible rounded-[24px] py-6 pl-6 pr-5"
      >
        {/* Top emerald edge line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/35 to-transparent"
        />

        {/*
          Below `lg:` the table of contents is a disclosure, closed by default.
          Measured on the Redmi before this: the TOC card was 408px tall and,
          with the share row beneath it, the article body did not start until
          1134px — 1.6 screens of navigation furniture before the first
          sentence. At `lg:` the sidebar is a sticky column beside the text and
          stays exactly as it was: the summary button is hidden and the list is
          always shown.
        */}
        <button
          type="button"
          onClick={() => setTocOpen((v) => !v)}
          aria-expanded={tocOpen}
          aria-controls="reading-toc"
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-[12px] font-semibold uppercase tracking-[0.2em] text-fg-soft transition-colors hover:text-fg-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50 lg:hidden"
        >
          On this page
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 transition-transform ${tocOpen ? "rotate-180" : ""}`}
          />
        </button>

        <p className="hidden text-[12px] lg:text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-soft lg:block">
          On this page
        </p>

        {/* The list — wrapped in a relatively-positioned <ol> so we can
            place the progress line + node absolutely on its right edge. */}
        <div
          id="reading-toc"
          className={`relative mt-4 ${tocOpen ? "" : "hidden"} lg:block`}
        >
          <ol className="relative space-y-3 pr-3">
            {toc.map((h, i) => {
              const isActive = activeId === h.id;
              const isNumbered = /^\d+\./.test(h.text);
              const display = isNumbered ? h.text : `${i + 1}. ${h.text}`;
              return (
                <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                  <a
                    ref={(el) => {
                      if (el) itemRefs.current.set(h.id, el);
                      else itemRefs.current.delete(h.id);
                    }}
                    href={`#${h.id}`}
                    className={`block text-[13px] leading-snug transition-colors ${
                      isActive
                        ? "text-emerald-bright"
                        : "text-fg-soft hover:text-fg-hi"
                    }`}
                  >
                    {display}
                  </a>
                </li>
              );
            })}
          </ol>

          {/* Vertical emerald progress line — RIGHT edge of TOC */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-full w-px"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(51, 240, 170, 0.15) 8%, rgba(51, 240, 170, 0.25) 50%, rgba(51, 240, 170, 0.15) 92%, transparent 100%)",
            }}
          />

          {/* Glowing node — slides to the active item's vertical center */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-[-3px] h-[7px] w-[7px] rounded-full bg-[#33f0aa] transition-[top] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              top: `${nodeOffset - 3.5}px`,
              boxShadow:
                "0 0 12px rgba(51, 240, 170, 0.9), 0 0 4px rgba(51, 240, 170, 1)",
            }}
          />
        </div>
      </nav>

      {/* Share panel — beneath the TOC */}
      <SharePanel />
    </div>
  );
}
