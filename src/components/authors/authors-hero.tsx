/**
 * Authors discovery hero — centered, atmospheric.
 *
 * Per the brief: NOT two-column. The hero is a single centered block
 * whose backdrop IS a large atmospheric vignette (reader silhouette in
 * a glowing emerald arch). The backdrop fades smoothly into the page
 * background via radial + linear masks — no boxed image.
 *
 * Composition (back to front):
 *   1. Wide ambient bloom
 *   2. Portal arch backdrop (glowing emerald) with reader silhouette
 *   3. Atmospheric dust drift
 *   4. Centered content (eyebrow + diamond + headline + subtitle)
 *
 * Reuses the same `catalog-diamond-pulse` + `catalog-dust-drift` CSS
 * keyframes other heroes use.
 */
import { AssetImage } from "@/components/cinematic/asset-image";

export function AuthorsHero() {
  const dust = [
    { left: "12%", delay: 0, xDrift: "28px" },
    { left: "22%", delay: 3.0, xDrift: "-22px" },
    { left: "34%", delay: 6.4, xDrift: "16px" },
    { left: "46%", delay: 1.4, xDrift: "-14px" },
    { left: "58%", delay: 4.2, xDrift: "22px" },
    { left: "70%", delay: 7.4, xDrift: "-26px" },
    { left: "82%", delay: 2.2, xDrift: "14px" },
    { left: "92%", delay: 5.0, xDrift: "-18px" },
  ];

  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-20 text-center sm:pb-16 sm:pt-28">
      {/* Wide ambient bloom (back layer) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[40%] -z-10 h-[520px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(22, 199, 132, 0.16) 0%, rgba(22, 199, 132, 0.05) 45%, transparent 70%)",
        }}
      />

      {/* Portal arch backdrop with reader silhouette (fallback) */}
      <PortalArchBackdrop />

      {/* Optional real hero atmosphere — layered over the portal, same
          masked fade. Missing → nothing renders → portal shows. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
        style={{
          maskImage:
            "radial-gradient(ellipse 70% 90% at 50% 60%, black 30%, transparent 95%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 90% at 50% 60%, black 30%, transparent 95%)",
        }}
      >
        <AssetImage
          src="/images/authors/authors_hero_atmosphere.webp"
          alt=""
          fallback={null}
          sizes="100vw"
          // The largest thing painted above the fold, so the browser should hear about it first. It is
          // aria-hidden atmosphere behind the heading, not content — but it is what LCP measures.
          priority
        />
      </div>

      {/* Drifting dust particles */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {dust.map((d, i) => (
          <span
            key={i}
            className="catalog-dust absolute bottom-0 block h-[3px] w-[3px] rounded-full bg-[#33f0aa]"
            style={
              {
                left: d.left,
                animationDelay: `${d.delay}s`,
                ["--dust-x" as string]: d.xDrift,
                boxShadow: "0 0 6px rgba(51, 240, 170, 0.7)",
                opacity: 0,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-3xl">
        {/* Eyebrow */}
        <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
          Authors
        </p>

        {/* Diamond ornament — shared primitive */}
        <div className="relative mx-auto mt-5 flex h-6 w-6 items-center justify-center">
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

        {/* Headline with emerald-gradient "inspire" */}
        <h1 className="mt-7 font-serif text-[52px] font-medium leading-[1.05] tracking-[-0.025em] text-fg-hi sm:text-[64px] lg:text-[72px]">
          Voices that{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, #33f0aa 0%, #1ddf8f 60%, #16c784 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            inspire
          </span>
        </h1>

        {/* Two-line muted subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fg-hi/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_22px_rgba(0,0,0,0.85)] sm:text-[17px]">
          The writers on the Valice list, and the writers around it — folklore and philosophy,
          puzzles and games, and a century of sapphic love stories.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Portal arch backdrop — emerald glowing doorway with a reader silhouette.   */
/* Edges fade into the page bg via radial + linear masks.                     */
/* -------------------------------------------------------------------------- */

function PortalArchBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      style={{
        // Soft edge mask so the scene fades into the page on all sides
        maskImage:
          "radial-gradient(ellipse 70% 90% at 50% 60%, black 30%, transparent 95%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 90% at 50% 60%, black 30%, transparent 95%)",
      }}
    >
      {/* Faint vertical column lines (bookshelf rim suggestion) */}
      <div
        className="absolute inset-y-0 left-1/2 h-full w-[820px] -translate-x-1/2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0, transparent 8px, rgba(180, 140, 90, 0.10) 8px, rgba(180, 140, 90, 0.10) 10px, transparent 10px, transparent 32px)",
          maskImage:
            "linear-gradient(180deg, transparent 0%, black 25%, black 70%, transparent 100%)",
        }}
      />

      {/* The arch — emerald glowing portal centered below the headline area */}
      <div
        className="absolute left-1/2 top-[55%] h-[280px] w-[180px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "linear-gradient(180deg, rgba(51, 240, 170, 0.55) 0%, rgba(22, 199, 132, 0.4) 65%, rgba(8, 60, 38, 0.2) 100%)",
          borderRadius: "50% 50% 8px 8px / 28% 28% 8px 8px",
          boxShadow:
            "0 0 80px 16px rgba(51, 240, 170, 0.4), inset 0 -20px 40px rgba(0,0,0,0.3)",
          opacity: 0.85,
        }}
      />

      {/* Reader silhouette — bottom-center, in front of the arch */}
      <svg
        viewBox="0 0 60 80"
        preserveAspectRatio="xMidYMax meet"
        className="absolute left-1/2 top-[55%] h-[180px] w-[120px] -translate-x-1/2 -translate-y-[20%]"
      >
        {/* Standing silhouette — head + shoulders + torso */}
        <path
          d="M 22,80 L 22,40 C 22,32 26,28 30,28 C 34,28 38,32 38,40 L 38,80 Z"
          fill="rgba(0, 0, 0, 0.85)"
        />
        <circle cx="30" cy="22" r="6" fill="rgba(0, 0, 0, 0.85)" />
        {/* Rim light from the portal — subtle emerald edge */}
        <path
          d="M 38,80 L 38,40 C 38,32 34,28 30,28"
          fill="none"
          stroke="rgba(51, 240, 170, 0.5)"
          strokeWidth="0.6"
        />
      </svg>

      {/* Floor reflection of the portal */}
      <div
        className="absolute left-1/2 top-[88%] h-[40px] w-[280px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse, rgba(51, 240, 170, 0.32) 0%, transparent 70%)",
          filter: "blur(10px)",
        }}
      />
    </div>
  );
}
