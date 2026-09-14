import { BookOpen, Clock, Highlighter, Library } from "lucide-react";

/**
 * Four library stats — Books Owned · Bookmarks · Hours Read · Highlights.
 *
 * Per the brief: each card uses **horizontal flex** layout — emerald
 * icon LEFT, then a 3-layer vertical text stack RIGHT (big number,
 * main label, sub-label). Explicitly NOT single-line.
 *
 * Pure Server Component. Every number it shows must be a real count of a real
 * thing: a card that reads "0 Bookmarks" to a reader who has just saved one is
 * worse than no card, because it is the storefront contradicting the reader
 * about that reader's own data.
 *
 * `booksOwned` and `bookmarks` are counted. `Hours read` and `Highlights` are
 * features that do not exist — they are shown as an em dash rather than a zero,
 * because zero is a measurement and these have not been measured.
 */
export function LibraryStats({
  booksOwned,
  bookmarks,
}: {
  booksOwned: number;
  bookmarks: number;
}) {
  const stats: {
    icon: typeof Library;
    number: number | string;
    mainLabel: string;
    subLabel: string;
  }[] = [
    {
      icon: Library,
      number: booksOwned,
      mainLabel: "Books",
      subLabel: "Owned",
    },
    {
      icon: BookOpen,
      number: bookmarks,
      mainLabel: "Bookmarks",
      subLabel: "Saved",
    },
    {
      icon: Clock,
      number: "—",
      mainLabel: "Hours",
      subLabel: "Read",
    },
    {
      icon: Highlighter,
      number: "—",
      mainLabel: "Highlights",
      subLabel: "Made",
    },
  ];

  return (
    <section
      aria-label="Library statistics"
      className="mx-auto mt-12 max-w-[1320px] px-4 sm:mt-14 sm:px-6"
    >
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.mainLabel}
              className="home-glass home-card-hover relative overflow-hidden rounded-[22px] p-5"
            >
              {/* Top emerald edge line */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/30 to-transparent"
              />

              {/* Horizontal flex per brief — icon LEFT, vertical text stack RIGHT */}
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-deep/30 bg-emerald-deep/10 text-emerald-bright shadow-[0_0_14px_-2px_rgba(51,240,170,0.4)]">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.6} />
                </span>

                {/* 3-layer vertical stack */}
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-[28px] font-medium leading-none tabular-nums text-fg-hi sm:text-[32px]">
                    {stat.number}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-fg-hi">
                    {stat.mainLabel}
                  </p>
                  <p className="mt-0.5 text-[12px] lg:text-[11px] uppercase tracking-[0.12em] text-fg-soft">
                    {stat.subLabel}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
