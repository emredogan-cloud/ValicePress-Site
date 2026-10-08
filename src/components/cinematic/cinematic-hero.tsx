import type { ReactNode } from "react";

/**
 * <CinematicHero> — the canonical hero block for every cinematic surface.
 *
 * Replaces the duplicated DNA across the existing 9 hero components
 * (`home/hero`, `catalog/catalog-hero`, `cart/cart-hero`, `blog/blog-hero`,
 * `authors/authors-hero`, `search/search-hero`, `library/library-hero`,
 * `genres/genres-hero`, `category/category-hero`, `article/article-hero`).
 *
 * Audit findings this resolves:
 *   - 10 inline copies of the last-word emerald gradient → `.home-headline-accent`
 *   - 3 inline hero-frame box-shadows → `.home-hero-frame` (used when `variant="with-panel"`)
 *   - 4 distinct H1 size scales merged into 4 typed `size` tokens
 *   - 3 grid-column variants for two-column layouts merged into a single `panelSide` prop
 *   - Diamond ornament + dust drift wrapped behind two boolean flags
 *
 * This component is the ROOT of the Phase-0 design system. Anything that
 * looks like a hero in Phase 1+ MUST start here; only the panel (the
 * scene art on the side) is bespoke per surface.
 *
 * Pure Server Component. No props are stateful. Panel art and child slot
 * content can themselves be client components if needed — this wrapper
 * makes no assumption about them.
 */

export type CinematicHeroSize = "xl" | "lg" | "md" | "sm";
export type CinematicHeroVariant = "solo" | "with-panel";
export type CinematicHeroPanelSide = "left" | "right";
export type CinematicHeroAlign = "left" | "center";

export interface CinematicHeroProps {
  /** Small uppercase label above the headline (e.g. "BLOG CATEGORY"). */
  eyebrow: string;

  /** Show the rotating-emerald diamond ornament under the eyebrow. */
  diamond?: boolean;

  /** Show drifting dust particles in the headline column background. */
  dust?: boolean;

  /**
   * Everything in the headline EXCEPT the last (accented) word. Optional —
   * a single-word headline can pass only `headlineTail` and the head will
   * render empty.
   */
  headlineHead?: string;

  /** The accented (emerald-gradient) part of the headline. Required. */
  headlineTail: string;

  /**
   * What assistive technology should read for the headline, when the visible
   * words are not enough on their own (the cart's headline is the number "2";
   * its meaning is in the line under it). Visual output is unchanged.
   */
  headlineLabel?: string;

  /** Body copy under the headline. String or any node (e.g. a paragraph + link). */
  subtitle?: ReactNode;

  /**
   * H1 size scale:
   *   xl = 56/68/80/88   (homepage — biggest)
   *   lg = 52/64/72      (canonical: catalog, cart, blog, authors, search)
   *   md = 48/58/64/72   (library, genres)
   *   sm = 44/56/62/68   (category, article — usually with-panel)
   * Default: "lg".
   */
  size?: CinematicHeroSize;

  /**
   * Layout shape:
   *   solo       = single centered column (used by homepage hero w/o art, blog index, etc.)
   *   with-panel = two-column with `panel` art on `panelSide`
   * Default: "solo".
   */
  variant?: CinematicHeroVariant;

  /** Which side the panel art sits on. Default: "left". Only honored when variant === "with-panel". */
  panelSide?: CinematicHeroPanelSide;

  /** Panel art content (a scene component). Required when variant === "with-panel". */
  panel?: ReactNode;

  /**
   * Text alignment:
   *   left    = default for with-panel
   *   center  = default for solo
   * Pass explicitly to override.
   */
  align?: CinematicHeroAlign;

  /** Slot for stats cards / CTA pills under the subtitle. */
  children?: ReactNode;

  /** Extra Tailwind classes applied to the outer section. */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal size-token map — keeps the JSX clean; one source of truth for
// every hero's H1 across the site.
// ────────────────────────────────────────────────────────────────────────────
const HEADLINE_SIZE_CLASSES: Record<CinematicHeroSize, string> = {
  xl: "text-[56px] sm:text-[68px] lg:text-[80px] xl:text-[88px]",
  lg: "text-[52px] sm:text-[64px] lg:text-[72px]",
  md: "text-[48px] sm:text-[58px] lg:text-[64px] xl:text-[72px]",
  sm: "text-[44px] sm:text-[56px] lg:text-[62px] xl:text-[68px]",
};

// Eight dust-particle positions — same recipe as the existing inline
// `<DustField>` in catalog-hero / cart-hero etc. The `--dust-x` CSS var
// drives the per-particle horizontal drift inside the `catalog-dust-drift`
// keyframe.
const DUST_PARTICLES: Array<{
  left: string;
  bottom: string;
  delay: string;
  dustX: string;
}> = [
  { left: "12%", bottom: "10%", delay: "0s", dustX: "30px" },
  { left: "28%", bottom: "18%", delay: "1.4s", dustX: "-20px" },
  { left: "44%", bottom: "6%", delay: "2.8s", dustX: "25px" },
  { left: "61%", bottom: "14%", delay: "4.2s", dustX: "-15px" },
  { left: "76%", bottom: "20%", delay: "5.6s", dustX: "30px" },
  { left: "18%", bottom: "28%", delay: "7s", dustX: "-25px" },
  { left: "52%", bottom: "22%", delay: "8.4s", dustX: "20px" },
  { left: "84%", bottom: "8%", delay: "9.8s", dustX: "-30px" },
];

export function CinematicHero({
  eyebrow,
  diamond = true,
  dust = false,
  headlineHead,
  headlineTail,
  headlineLabel,
  subtitle,
  size = "lg",
  variant = "solo",
  panelSide = "left",
  panel,
  align,
  children,
  className,
}: CinematicHeroProps) {
  // Sensible align defaults — with-panel reads left, solo reads center.
  const resolvedAlign: CinematicHeroAlign =
    align ?? (variant === "with-panel" ? "left" : "center");

  const headlineClasses = [
    "font-serif font-medium leading-[1.05] tracking-[-0.025em] text-[var(--home-text-hi,#e6e6e0)]",
    HEADLINE_SIZE_CLASSES[size],
  ].join(" ");

  const alignClasses =
    resolvedAlign === "center" ? "items-center text-center" : "items-start text-left";

  const contentBlock = (
    <div className={`relative flex flex-col ${alignClasses}`}>
      {/* Eyebrow */}
      <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
        {eyebrow}
      </p>

      {/* Diamond ornament */}
      {diamond && (
        <div
          className={`relative mt-4 flex h-6 w-6 items-center justify-center ${
            resolvedAlign === "center" ? "" : ""
          }`}
        >
          <div
            aria-hidden
            className="absolute h-6 w-6 rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(51, 240, 170, 0.7) 0%, transparent 70%)",
            }}
          />
          <span
            aria-hidden
            className="catalog-diamond block h-2 w-2 rounded-[1px] bg-[#33f0aa]"
            style={{ transform: "rotate(45deg)" }}
          />
        </div>
      )}

      {/* Headline */}
      <h1 className={`mt-6 ${headlineClasses}`} aria-label={headlineLabel}>
        {headlineHead && <>{headlineHead} </>}
        <span className="home-headline-accent">{headlineTail}</span>
      </h1>

      {/* Subtitle */}
      {subtitle && (
        <div
          className={`mt-5 max-w-md text-base leading-relaxed text-fg-mid sm:text-[17px] ${
            resolvedAlign === "center" ? "mx-auto" : ""
          }`}
        >
          {subtitle}
        </div>
      )}

      {/* Children slot — stats cards, CTA pills, etc. */}
      {children && <div className="mt-8 w-full">{children}</div>}

      {/* Drifting dust particles — pure decoration, behind the text */}
      {dust && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          {DUST_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="catalog-dust absolute h-1 w-1 rounded-full bg-[#33f0aa]"
              style={{
                left: p.left,
                bottom: p.bottom,
                animationDelay: p.delay,
                boxShadow: "0 0 6px rgba(51, 240, 170, 0.7)",
                ["--dust-x" as string]: p.dustX,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────
  // Solo variant — single centered column, no panel art.
  // ────────────────────────────────────────────────────────────────────────
  if (variant === "solo") {
    return (
      <section
        className={`relative mx-auto mt-6 max-w-[1320px] px-4 sm:mt-10 sm:px-6 ${className ?? ""}`}
      >
        {contentBlock}
      </section>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // With-panel variant — two-column composition with the scene art.
  // ────────────────────────────────────────────────────────────────────────
  const panelBlock = (
    <div className="relative aspect-[5/4] w-full lg:aspect-auto home-hero-frame">
      {/* Top emerald edge line — same accent every hero panel uses */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/40 to-transparent"
      />
      {panel}
    </div>
  );

  const gridClass =
    panelSide === "left"
      ? "lg:grid-cols-[minmax(0,_45%)_minmax(0,_1fr)]"
      : "lg:grid-cols-[minmax(0,_1fr)_minmax(0,_45%)]";

  return (
    <section
      className={`mx-auto mt-6 max-w-[1320px] px-4 sm:mt-10 sm:px-6 ${className ?? ""}`}
    >
      <div className={`grid items-stretch gap-8 ${gridClass} lg:gap-12`}>
        {panelSide === "left" ? (
          <>
            {panelBlock}
            {contentBlock}
          </>
        ) : (
          <>
            {contentBlock}
            {panelBlock}
          </>
        )}
      </div>
    </section>
  );
}
