import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CategoryCoverStack } from "./category-cover-stack";

/**
 * The shape one discovery card needs, assembled by the page from a real DB
 * category. `href` is always a real internal route — no dead cards.
 */
export interface CategoryCardData {
  key: string;
  name: string;
  tagline: string;
  href: string;
  icon: LucideIcon;
  tint: string;
  /** Real covers of the books in the category (asset manifest paths). */
  coverSrcs: readonly string[];
  /** Optional bespoke artwork at /images/categories/<slug>.webp. */
  artSrc: string | null;
}

/**
 * Category discovery card. The artwork is either a bespoke image for the
 * category or — the default — a fan of the real covers filed in it. A bottom
 * scrim keeps the overlaid title legible; the info row (icon + name +
 * tagline + arrow) sits along the bottom.
 */
export function CategoryCard({ item }: { item: CategoryCardData }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group block rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60"
    >
      {/*
        `@container`: the info row below adapts to the CARD's width, not the
        viewport's. The card's width is not monotonic in viewport width — the
        grid is 2-up at base, 3-up at `sm:` and 5-up at `lg:` — so a viewport
        breakpoint cannot express "this card is too narrow for a single row".
        Measured overhang of the widest title word before this change:
          320px card136 +87px | 392px card172 +51px | 430px card191 +32px
          768px card227 +15px | 1024px card179 +63px | 1440px card238 +4px
        Six of six cards collided at 1024px, the worst case of all.
      */}
      <article className="home-card-hover home-glass @container relative aspect-[5/4] overflow-hidden rounded-[24px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-emerald-bright/40 to-transparent"
        />

        {/* Artwork — slow zoom on hover */}
        <div className="absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]">
          {item.artSrc ? (
            <Image
              src={item.artSrc}
              alt=""
              fill
              sizes="(min-width: 1024px) 20vw, 50vw"
              className="object-cover"
            />
          ) : (
            <CategoryCoverStack
              coverSrcs={item.coverSrcs}
              name={item.name}
              tint={item.tint}
            />
          )}
        </div>

        {/* Bottom scrim — legibility for the overlaid title */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              "linear-gradient(0deg, rgba(5,7,5,0.92) 0%, rgba(5,7,5,0.5) 42%, transparent 100%)",
          }}
        />

        {/* Info row */}
        {/* Below a 228px card the title takes its own full-width line and the
            badge/tagline/arrow sit beneath it. At 228px and up — which is every
            desktop column from 1280px — the original single row is restored
            unchanged. */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end gap-2 p-4 @min-[228px]:flex-nowrap @min-[228px]:gap-3 sm:p-5">
          <span className="order-2 flex h-9 w-9 flex-shrink-0 @min-[228px]:order-none items-center justify-center rounded-xl border border-emerald-deep/30 bg-emerald-deep/10 text-emerald-bright shadow-[0_0_12px_-2px_rgba(51,240,170,0.45)] backdrop-blur-sm transition-all duration-300 group-hover:border-emerald-bright/50 group-hover:bg-emerald-deep/20 group-hover:shadow-[0_0_18px_-2px_rgba(51,240,170,0.6)]">
            <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>

          <div className="order-first w-full min-w-0 @min-[228px]:order-none @min-[228px]:w-auto @min-[228px]:flex-1">
            {/* `hyphens: auto` + `overflow-wrap: anywhere` is the guarantee, not
                the plan: the stacked layout gives the title room at every width
                measured, and these two make it impossible for a longer category
                name added later to paint over the badge again. Proper
                hyphenation is also what a book would do. */}
            <h2
              lang="en"
              className="font-serif text-[18px] font-medium leading-tight text-white transition-colors [overflow-wrap:anywhere] hyphens-auto group-hover:text-emerald-bright sm:text-[20px]"
            >
              {item.name}
            </h2>
            <p className="mt-0.5 truncate text-xs text-white/60">
              {item.tagline}
            </p>
          </div>

          <span
            aria-hidden
            className="order-3 ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.12] @min-[228px]:ml-0 bg-white/[0.04] text-white/70 backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:border-emerald-bright/50 group-hover:bg-emerald-bright/10 group-hover:text-emerald-bright"
          >
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </span>
        </div>
      </article>
    </Link>
  );
}
