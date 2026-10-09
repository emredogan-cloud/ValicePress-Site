import {
  BookOpen,
  EyeOff,
  Infinity as InfinityIcon,
  Unlock,
  type LucideIcon,
} from "lucide-react";

/**
 * "What we believe" — the belief system, as four glass cards.
 *
 * Reference treatment: a four-up row of luxury glass cards, each an
 * icon + title + supporting line. This is a *manifesto*, not a feature
 * list — the copy speaks in convictions, and the chrome (rounded-[30px]
 * glass + emerald hover bloom via `.home-card-hover`) makes each one feel
 * like a held principle. Rewritten in Phase 8 for the press as it is now
 * (ownership / no DRM / evidence / privacy): "We sell watermarked PDFs" became
 * what the file actually carries, and "Built for readers" moved into the
 * founder's own words.
 *
 * Pure Server Component.
 */

interface Belief {
  icon: LucideIcon;
  title: string;
  body: string;
}

const BELIEFS: ReadonlyArray<Belief> = [
  {
    icon: InfinityIcon,
    title: "You own what you buy",
    body: "A direct download belongs to you — open it on any device you own, read it offline, and still have it ten years from now, even if we're gone.",
  },
  {
    icon: Unlock,
    title: "No locks, one honest mark",
    body: "No DRM and no required app. Each download carries a small licence line in the page footer with your name and order, so a leaked copy can be traced. That is the only mark on it.",
  },
  {
    icon: BookOpen,
    title: "Evidence on the page",
    body: "Our reference books name their sources and show their evidence, so a reader can check a claim instead of taking our word for it.",
  },
  {
    icon: EyeOff,
    title: "Your privacy matters",
    body: "We don't track you across the web and we never sell your data. We collect what we need to deliver your books and, if you ask for them, our emails — nothing more.",
  },
];

export function BeliefGrid() {
  return (
    <section aria-labelledby="beliefs-heading">
      <header className="max-w-2xl">
        <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
          Our convictions
        </p>
        <h2
          id="beliefs-heading"
          className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-[-0.02em] text-fg-hi sm:text-[40px]"
        >
          What we believe
        </h2>
        <p className="mt-3 text-base leading-relaxed text-fg-mid sm:text-[17px]">
          Four ideas the press and its storefront are built to protect. Break
          any one of them and it stops being the thing it&apos;s supposed to be.
        </p>
      </header>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {BELIEFS.map((belief, i) => {
          const Icon = belief.icon;
          return (
            <li
              key={belief.title}
              className="home-glass home-card-hover group relative overflow-hidden rounded-[30px] p-7"
            >
              {/* Top emerald edge line */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-bright/35 to-transparent"
              />
              {/* Corner index — small, calm */}
              <span
                aria-hidden
                className="absolute right-5 top-5 font-serif text-sm text-fg-fade transition-colors group-hover:text-emerald-bright/70"
              >
                0{i + 1}
              </span>

              {/* Self-contained tile (layered utilities only) so the hover
                  bloom actually animates — the shared `.home-icon-tile` is
                  unlayered and would override utility hover states. */}
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-deep/30 bg-emerald-deep/10 text-emerald-bright shadow-[0_0_12px_-2px_rgba(51,240,170,0.45)] transition-all duration-300 group-hover:border-emerald-bright/50 group-hover:bg-emerald-deep/20 group-hover:shadow-[0_0_20px_-2px_rgba(51,240,170,0.65)]">
                <Icon aria-hidden className="h-5 w-5" strokeWidth={1.7} />
              </span>

              <h3 className="mt-6 font-serif text-[20px] font-medium leading-tight text-fg-hi transition-colors group-hover:text-emerald-bright">
                {belief.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fg-mid">
                {belief.body}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
