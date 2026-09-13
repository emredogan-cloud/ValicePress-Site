import {
  Cloud,
  CreditCard,
  Infinity as InfinityIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Order trust strip — 4-column reassurance row below the next-steps.
 *
 * Pillars chosen for the order context (different from settings'
 * trust strip): payment security + delivery speed + lifetime
 * ownership + cross-device access. Same chrome family as the settings
 * trust strip (audit'in next-iteration extraction work).
 *
 * Pure Server Component.
 */

interface TrustItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

const ITEMS: ReadonlyArray<TrustItem> = [
  {
    icon: CreditCard,
    title: "Secure payment",
    body: "Processed by Lemon Squeezy. We never see your card.",
  },
  {
    icon: Zap,
    title: "Instant access",
    body: "Books appear in your library within minutes.",
  },
  {
    icon: InfinityIcon,
    title: "Yours forever",
    body: "Buy once. Download anytime. Never locked.",
  },
  {
    icon: Cloud,
    title: "Read anywhere",
    body: "Standard PDF — any device, any reader.",
  },
];

export function OrderTrustStrip() {
  return (
    <section
      aria-label="What you get with every purchase"
      className="home-glass relative overflow-hidden rounded-[24px] p-6 sm:p-7"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-bright/40 to-transparent"
      />

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title} className="group flex items-start gap-3.5">
              <span className="home-icon-tile transition-all group-hover:bg-emerald-deep/15 group-hover:shadow-[0_0_14px_-2px_rgba(51,240,170,0.55)]">
                <Icon aria-hidden className="h-4 w-4" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[15px] font-medium leading-tight text-fg-hi transition-colors group-hover:text-emerald-bright">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-fg-mid">
                  {item.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
