import { BookMarked, Download, Gift, Tablet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * "How to read them" — the four ways a reader gets a Valice book, each with a real route.
 *
 * The direct-download card is DATA-DRIVEN. `directCount` is the number of published books a reader can
 * actually pay for here right now (`providerPriceId` set — see `BookCardData.buyableHere`); the codebase
 * records that between payment providers every book was "priced, deliverable and unbuyable" at once. If
 * that number is zero this card says downloads are not on sale, instead of promising them.
 */
export function AboutReaders({ directCount }: { directCount: number }) {
  const cards: Array<{ icon: ReactNode; title: string; body: ReactNode; href: string; cta: string }> = [
    {
      icon: <BookMarked className="h-5 w-5" strokeWidth={1.7} />,
      title: "In print",
      body: "Paperbacks, hardcovers and large-print editions are sold by Amazon. Each book's page links to the exact edition, so you never have to search for it.",
      href: "/books",
      cta: "Find a book",
    },
    {
      icon: <Tablet className="h-5 w-5" strokeWidth={1.7} />,
      title: "On Kindle",
      body: "Some titles — the romance novels among them — have Kindle editions, also sold by Amazon and linked from the book's page.",
      href: "/ebooks",
      cta: "See the ebooks",
    },
    {
      icon: <Download className="h-5 w-5" strokeWidth={1.7} />,
      title: "Direct download",
      body:
        directCount > 0
          ? `${directCount} titles are also sold here as DRM-free PDFs: buy once, download as often as you like, read it in your browser or on any device. Checkout is handled by Lemon Squeezy, our merchant of record, so we never see your card. Each file carries a small licence line in its footer — that is the only mark on it.`
          : "Direct downloads are not on sale at the moment. Print and Kindle editions are available from Amazon, and each book's page says which.",
      href: "/ebooks",
      cta: "Ebooks",
    },
    {
      icon: <Gift className="h-5 w-5" strokeWidth={1.7} />,
      title: "Free to read",
      body: "The romance series have free bonus scenes for readers: The Second Chair (Weather Permitting), The Ocean (The Long Way Back) and The First Frost (the Larkspur Lake novels).",
      href: "/bonus",
      cta: "Read a bonus scene",
    },
  ];

  return (
    <section aria-labelledby="readers-heading">
      <header className="max-w-2xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">Formats</p>
        <h2 id="readers-heading" className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-[-0.02em] text-fg-hi sm:text-[40px]">
          How to read them
        </h2>
      </header>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.title} className="home-glass home-card-hover relative flex flex-col overflow-hidden rounded-[28px] p-7">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-deep/30 bg-emerald-deep/10 text-emerald-bright">{c.icon}</span>
            <h3 className="mt-5 font-serif text-[20px] font-medium leading-tight text-fg-hi">{c.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-mid">{c.body}</p>
            <Link href={c.href} className="mt-5 text-sm font-medium text-emerald-bright underline decoration-emerald-bright/30 underline-offset-4 hover:decoration-emerald-bright">
              {c.cta}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
