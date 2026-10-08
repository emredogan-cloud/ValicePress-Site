import { Mail, PenLine, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { SocialLinks } from "@/components/brand/social-links";
import { PUBLIC_EMAIL } from "@/lib/contact";

/**
 * "Who built it" — the human, transparent half of the page.
 *
 * Two-column, reference-faithful:
 *   LEFT  — editorial copy: an independent one-person project, built in the open; what the founder writes
 *           (his own approved biography, from the catalogue — never rewritten here); the press's
 *           editions of public-domain classics; and how a direct purchase works.
 *   RIGHT — a glass founder / contact card with a soft emerald glow: the initials mark (no photograph is
 *           presented), name + role, a real `mailto:` CTA to the press's own address, and the press's
 *           four networks (`@/lib/social`).
 *
 * No fabricated team, history, or fake photography — authenticity is the whole point of this section.
 * Pure Server Component.
 */
export function FounderCard({ founderBio = [] }: { founderBio?: string[] }) {
  return (
    <section aria-labelledby="who-built-it-heading">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_400px)] lg:gap-14">
        {/* LEFT — editorial copy */}
        <div>
          <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
            Transparency
          </p>
          <h2
            id="who-built-it-heading"
            className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-[-0.02em] text-fg-hi sm:text-[40px]"
          >
            Who built it
          </h2>

          <div className="mt-6 space-y-5 text-base leading-relaxed text-fg-mid sm:text-[17px]">
            <p>
              Valice Press is run by Emre Doğan as a sole proprietor — a
              serious one-person project, built in the open. Every
              architectural decision is documented in the{" "}
              <Link
                href="/blog/category/behind-the-scenes"
                className="font-medium text-emerald-bright underline decoration-emerald-bright/30 underline-offset-4 transition-colors hover:decoration-emerald-bright"
              >
                behind-the-scenes
              </Link>{" "}
              posts, and every editorial direction in the{" "}
              <Link
                href="/blog/category/reading-guides"
                className="font-medium text-emerald-bright underline decoration-emerald-bright/30 underline-offset-4 transition-colors hover:decoration-emerald-bright"
              >
                reading guides
              </Link>
              .
            </p>
            {/*
              The founder's biography is the catalogue's approved text, printed as it is (the first
              paragraphs only). It is not summarised or reworded here: it is the one biography of him this
              repository may print, and `/authors/emre-dogan` prints the rest.
            */}
            {founderBio.map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
            <p>
              The press also makes its own editions of public-domain classics.
              The typesetting, introductions, notes and indexes are ours; the
              historical texts themselves are in the public domain, and each
              book names its source and translator.
            </p>
            <p>
              Where we sell a download directly, checkout runs through Lemon
              Squeezy, our merchant of record — they process the card and
              handle the tax owed in your jurisdiction, so we never touch your
              payment details. The file is then added to your library: a plain
              PDF, yours to download or read in the browser.
            </p>
          </div>

          {/* Two small honesty pills */}
          <ul className="mt-7 flex flex-wrap gap-2.5">
            {HONESTY.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-fg-soft"
                >
                  <Icon
                    aria-hidden
                    className="h-3.5 w-3.5 text-emerald-bright"
                    strokeWidth={1.8}
                  />
                  {item.label}
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT — founder / contact card */}
        <article className="home-glass relative overflow-hidden rounded-[28px] p-7 shadow-[0_0_44px_-18px_rgba(51,240,170,0.4)] sm:p-8">
          {/* Top emerald edge */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-bright/45 to-transparent"
          />
          {/* Soft inner emerald glow, top-right */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(51, 240, 170, 0.14) 0%, transparent 70%)",
            }}
          />

          {/* Portrait area — initials placeholder (no stock photography) */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="home-avatar-gradient relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
                {/* The initials, deliberately. An AI-generated "portrait" of
                    the Founder used to render here with his name as its alt
                    text — a fabricated photograph of a real person. If a real
                    photograph is ever supplied, it belongs at
                    /images/authors/emre-dogan.webp, where the author pages
                    resolve it too; until then this card shows a mark. */}
                <span className="font-serif text-xl font-medium text-[#032015]">
                  ED
                </span>
              </span>
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0c1813]"
              >
                <ShieldCheck
                  aria-hidden
                  className="h-3.5 w-3.5 text-emerald-bright"
                  strokeWidth={2}
                />
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-serif text-[20px] font-medium leading-tight text-fg-hi">
                Emre Doğan
              </p>
              <p className="mt-0.5 text-sm text-fg-soft">
                Founder · Sole proprietor
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-fg-mid">
            Reach out about anything — book requests, a technical hiccup, or
            just to say hello. Every email gets a real reply, from a real
            person.
          </p>

          {/* Email CTA */}
          <a
            href={`mailto:${PUBLIC_EMAIL}`}
            className="home-cta-primary group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold tracking-tight"
          >
            <Mail aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            {PUBLIC_EMAIL}
          </a>

          {/* Social row — the press's four networks, from the one list in @/lib/social */}
          <div className="mt-5 flex items-center gap-3 border-t border-white/[0.06] pt-5">
            <span className="text-xs uppercase tracking-[0.18em] text-fg-soft">Find us</span>
            <SocialLinks className="ml-auto" iconClassName="h-4 w-4" />
          </div>
        </article>
      </div>
    </section>
  );
}

const HONESTY: ReadonlyArray<{ icon: typeof PenLine; label: string }> = [
  { icon: PenLine, label: "Built in the open" },
  { icon: ShieldCheck, label: "Documented decisions" },
];
