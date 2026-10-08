import type { Metadata } from "next";
import Link from "next/link";

import { CampaignCountdown } from "@/components/campaign/campaign-countdown";
import { CatalogShell } from "@/components/catalog/catalog-shell";
import { toCatalogItems } from "@/components/catalog/catalog-item";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { listEbooks } from "@/lib/db/queries/catalog";
import { buildPageMetadata } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "Ebooks · PDF downloads and Kindle editions",
  description:
    "Every Valice Press ebook: watermarked PDFs sold here — buy once, download immediately, read on any device — and Kindle editions on Amazon. Each listing says which. No subscription, no device lock.",
  path: "/ebooks",
});

/**
 * `/ebooks` — every ebook a reader can obtain, said plainly two ways.
 *
 * Some ebooks are sold HERE: a watermarked PDF, delivered here, re-downloadable
 * from the reader's library. The rest are Kindle editions: bought and read on
 * Amazon, and in several cases in Kindle Unlimited, which forbids this site
 * from selling or giving the ebook away at all (KDP Select). Both belong on the
 * shelf a reader browses for "ebooks", so both are on it — and the page says in
 * its first paragraph that they differ, rather than leaving a Kindle Unlimited
 * novel to look like a download from this site. Each card and the quick view
 * repeat it (the Kindle chip reads "on Amazon", the button "Buy on Amazon").
 *
 * Print editions are never on this shelf as such: they are printed and shipped
 * by Amazon and appear on each book's own page.
 *
 * Kept `○ Static + ISR 1h`, same as `/books`: the query runs at build/regen
 * time and `<CatalogShell>` is a hydrating client island.
 */
export default async function EbooksPage() {
  const ebooks = toCatalogItems(await listEbooks());

  return (
    <div className="cinematic-root">
      <CinematicHeader active="ebooks" />

      <main id="main-content" className="relative z-10">
        <header className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-4 pt-16 sm:pt-24">
          <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
            Ebooks
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-[40px] font-medium leading-[1.08] tracking-[-0.025em] text-fg-hi sm:text-[56px]">
            Bought here, or on Kindle.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-mid">
            Some of our ebooks are sold here as a watermarked PDF — no device
            lock, no expiry, yours to download as often as you like. The rest
            are Kindle editions, bought and read on Amazon. Every card says
            which. Print editions are handled by Amazon too; you&apos;ll find
            them on each book&apos;s page.
          </p>
        </header>

        <CampaignCountdown />

        {ebooks.length === 0 ? (
          <EbooksEmpty />
        ) : (
          <CatalogShell books={ebooks} />
        )}
      </main>

      <HomeFooter />
    </div>
  );
}

/**
 * No ebook is on sale yet.
 *
 * This is the accurate state today: the Valice Press titles exist as
 * finished files but none has been released for sale. The page says that
 * rather than showing an empty grid with filters over nothing.
 */
function EbooksEmpty() {
  return (
    <section className="mx-auto mt-10 max-w-2xl px-4 sm:px-6 pb-24 text-center">
      <div className="home-glass rounded-[24px] px-8 py-14">
        <p className="font-serif text-xl text-fg-hi">
          No ebook is on sale yet.
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-soft">
          The first Valice Press editions are finished and in preparation.
          When one goes on sale it will appear here, and anyone on the list
          hears about it first.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#newsletter"
            className="home-cta-primary inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold"
          >
            Tell me when it ships
          </Link>
          <Link
            href="/books"
            className="home-cta-secondary inline-flex h-10 items-center rounded-full px-5 text-sm font-medium"
          >
            See the catalogue
          </Link>
        </div>
      </div>
    </section>
  );
}
