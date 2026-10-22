/**
 * Catalog hero — minimal-but-premium page header.
 *
 * Mirrors the reference image: eyebrow "CATALOG", a small glowing
 * diamond ornament beneath, the editorial "All books" headline, and a
 * one-line muted subtitle. Subtle dust drifts in the background; a wide
 * radial bloom sits behind everything.
 *
 * Pure Server Component — diamond glow + dust use CSS keyframes from
 * `globals.css` (`catalog-diamond-pulse`, `catalog-dust-drift`).
 *
 * On `/books` the spiral library above it holds the page's `<h1>`, so here the
 * headline is an `<h2>` introducing the full catalogue; a page has one `<h1>`.
 */
export function CatalogHero({
  heading = "h1",
  headingId,
  title = "All books",
  subtitle = "Explore our entire collection of digital books.",
}: {
  heading?: "h1" | "h2";
  headingId?: string;
  title?: string;
  subtitle?: string;
} = {}) {
  const Heading = heading;
  // Pre-computed dust particle positions + per-particle timing so the
  // motion looks organic without being deterministic-looking.
  const dust = [
    { left: "8%", delay: 0, xDrift: "30px" },
    { left: "17%", delay: 3.2, xDrift: "-25px" },
    { left: "28%", delay: 6.8, xDrift: "18px" },
    { left: "42%", delay: 1.6, xDrift: "-12px" },
    { left: "55%", delay: 4.4, xDrift: "20px" },
    { left: "63%", delay: 7.6, xDrift: "-30px" },
    { left: "72%", delay: 2.4, xDrift: "15px" },
    { left: "84%", delay: 5.2, xDrift: "-22px" },
    { left: "92%", delay: 8.0, xDrift: "10px" },
  ];

  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-12 text-center sm:pb-14 sm:pt-16">
      {/* Wide radial bloom behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[480px] w-[920px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(22, 199, 132, 0.18) 0%, rgba(22, 199, 132, 0.06) 40%, transparent 70%)",
        }}
      />

      {/* Hero dust — slow drifting particles */}
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

      <div className="mx-auto max-w-3xl">
        {/* Eyebrow */}
        <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
          Catalog
        </p>

        {/* Diamond ornament — pulses softly */}
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

        {/* Headline */}
        <Heading
          id={headingId}
          className="mt-7 font-serif text-[52px] font-medium leading-[1.05] tracking-[-0.025em] text-fg-hi sm:text-[64px] lg:text-[72px]"
        >
          {title}
        </Heading>

        {/* Subtitle */}
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-fg-mid sm:text-[17px]">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
