import { FacebookIcon, InstagramIcon, TikTokIcon, XIcon } from "@/components/brand-icons";
import { SOCIAL_LINKS, type SocialId } from "@/lib/social";

const ICONS: Record<SocialId, (p: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  x: XIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
};

/**
 * The press's four networks, from `@/lib/social` and nowhere else.
 *
 *   variant="icons"  a row of icon links (footer, mobile menu). Each is a 44px target and says,
 *                    to a screen reader, which network it is and that it opens in a new tab.
 *   variant="cards"  a list with the network, the handle and one line on what is there (About).
 */
export function SocialLinks({
  variant = "icons",
  className = "",
  iconClassName = "h-[18px] w-[18px]",
  itemClassName = "h-11 w-11",
}: {
  variant?: "icons" | "cards";
  className?: string;
  iconClassName?: string;
  /** Size of each icon link's tap target (44px by default; the phone drawer's rows are 48px). */
  itemClassName?: string;
}) {
  if (variant === "cards") {
    return (
      <ul className={`grid gap-3 sm:grid-cols-2 ${className}`}>
        {SOCIAL_LINKS.map((l) => {
          const Icon = ICONS[l.id];
          return (
            <li key={l.id}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="home-glass home-card-hover flex items-center gap-4 rounded-[16px] p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright"
              >
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] text-emerald-bright">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-[17px] text-fg-hi">{l.label}</span>
                  <span className="block truncate text-[13px] text-fg-mid">{l.handle}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-soft">{l.blurb}</span>
                  <span className="sr-only"> (opens {l.label} in a new tab)</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className={`flex items-center gap-1 ${className}`}>
      {SOCIAL_LINKS.map((l) => {
        const Icon = ICONS[l.id];
        return (
          <li key={l.id}>
            <a
              href={l.href}
              aria-label={`Valice Press on ${l.label} (opens in a new tab)`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex ${itemClassName} items-center justify-center rounded-full text-fg-soft transition-colors hover:bg-white/[0.06] hover:text-emerald-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright`}
            >
              <Icon className={iconClassName} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
