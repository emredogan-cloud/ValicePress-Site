import Image from "next/image";

import type { PortraitTheme } from "./author-card-data";

/**
 * Author portrait slot.
 *
 * Two states, and only two:
 *
 *   1. A real likeness at `/images/authors/<slug>.webp` — either a verified
 *      photograph the author supplied, or a public-domain image of a
 *      historical author with its source recorded in
 *      docs/execution/phase-4/ASSET_MAP.md. Rendered through next/image.
 *
 *   2. The designed identity mark: the author's initials set in the house
 *      serif inside an emerald ring on the dark ground. It is unmistakably a
 *      mark and not a photograph, which is the point. The site once carried
 *      an AI-generated "portrait" of the Founder and an AI-rendered bust for
 *      Marcus Aurelius; both were presented as likenesses and both were
 *      invented. A generic silhouette replaced them, and this mark replaces
 *      the silhouette — it is at least honest about being a design.
 */
export function AuthorPortrait({
  theme,
  imageSrc,
  imageAlt,
  name,
  caption = null,
  priority = false,
  sizes = "(min-width: 1024px) 16vw, 50vw",
}: {
  theme: PortraitTheme;
  /** Real portrait path or null. */
  imageSrc?: string | null;
  /** What the picture shows ("Photograph of Lafcadio Hearn, 1889"); defaults to "Portrait of <name>". */
  imageAlt?: string | null;
  /** The author's display name — the mark is built from its initials. */
  name: string;
  /** Printed on the identity mark only, and only when it is TRUE of this person ("Valice Press author"). */
  caption?: string | null;
  priority?: boolean;
  sizes?: string;
}) {
  if (imageSrc) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <Image
          src={imageSrc}
          alt={imageAlt ?? `Portrait of ${name}`}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 110%, rgba(0,0,0,0.55) 0%, transparent 65%)",
          }}
        />
      </div>
    );
  }

  return <AuthorIdentityMark theme={theme} name={name} caption={caption} />;
}

/** Initials: first letter of the first and last word ("Emre Doğan" → "ED"). */
export function initialsOf(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

export function AuthorIdentityMark({
  theme,
  name,
  caption = null,
}: {
  theme: PortraitTheme;
  name: string;
  /** Only ever a true statement. It used to be hard-wired to "Valice Press author", which is false for a reference author. */
  caption?: string | null;
}) {
  const initials = initialsOf(name);
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      role="img"
      aria-label={`${name} — author mark`}
      data-identity-mark=""
    >
      <div aria-hidden className="absolute inset-0" style={{ background: theme.background }} />
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-[140px] w-[140px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)`,
        }}
      />
      {/* Fine rules — the emblem sits on a printed page, not a photo */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0, transparent 22px, rgba(255,255,255,0.6) 22px, rgba(255,255,255,0.6) 23px)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, transparent 100%)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]">
        <svg viewBox="0 0 100 100" className="h-[58%] w-[58%]" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke={theme.rimLight} strokeOpacity="0.55" strokeWidth="0.9" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={theme.rimLight} strokeOpacity="0.25" strokeWidth="0.5" strokeDasharray="1.5 2.5" />
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-serif), Georgia, serif"
            fontSize={initials.length > 1 ? 30 : 38}
            fontWeight="500"
            fill="#e9f7ef"
            letterSpacing="1"
          >
            {initials}
          </text>
        </svg>
      </div>
      {caption && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-center pb-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.28em] text-white/45 lg:text-[9px]">{caption}</span>
        </div>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 110%, rgba(0,0,0,0.5) 0%, transparent 65%)",
        }}
      />
    </div>
  );
}
