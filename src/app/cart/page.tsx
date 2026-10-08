import type { Metadata } from "next";

import { CartHero } from "@/components/cart/cart-hero";
import { CartLine } from "@/components/cart/cart-line";
import { CartSummary } from "@/components/cart/cart-summary";
import { bundleSaving, bundlesContaining, matchBundle } from "@/lib/bundles";
import { EmptyCartCard } from "@/components/cart/empty-cart-card";
import { RecommendationShelf } from "@/components/cart/recommendation-shelf";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { getCurrentLocalUserIdReadOnly } from "@/lib/account";
import { readCart } from "@/lib/cart";
import { getOwnedBookIds } from "@/lib/db/queries/account";
import { getCartBooks, listPublishedBooks } from "@/lib/db/queries/catalog";
import { toCatalogItems } from "@/components/catalog/catalog-item";
import { pickRecommendations } from "@/lib/recommendations";
import { isAddable } from "@/lib/sellable";

// `/cart` reads the per-request cart cookie, so it is intentionally dynamic.
// The classification stays `ƒ Dynamic`; only the visual language changed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

/**
 * Cinematic cart page — dark luxury aesthetic shared with homepage / catalog / blog.
 *
 * Two states, both inside `.cinematic-root`:
 *   - **Empty** (cookie has no items): hero ("Your cart is empty") + glass
 *     empty-card with circular cart-icon ring + CTA to /books + the
 *     "You might like" recommendation shelf below.
 *   - **With items**: hero ("N books in your cart") + a two-column body
 *     (`<CartLine>` items LEFT, `<CartSummary>` panel RIGHT) + the same
 *     recommendation shelf at the bottom so users can keep browsing.
 *
 * Both states render the shared `<CinematicHeader>` and `<HomeFooter>`,
 * so the visual continuity from the homepage / catalog / blog is total.
 */
export default async function CartPage() {
  const cart = await readCart();

  // Everything the page needs that does not depend on anything else, at once.
  // These ran one after another, which on a database a few round trips away
  // made the cart the slowest page on the site.
  const [books, published, localUserId] = await Promise.all([
    cart.items.length > 0
      ? getCartBooks(cart.items.map((i) => i.bookId))
      : Promise.resolve([]),
    listPublishedBooks(),
    getCurrentLocalUserIdReadOnly(),
  ]);

  // Preserve cookie order; drop unpublished/missing books defensively.
  const booksById = new Map(books.map((b) => [b.id, b]));
  const orderedBooks = cart.items
    .map((item) => booksById.get(item.bookId))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);

  // Mark books the signed-in visitor already owns (so they don't re-buy), and
  // find out which of the books we are about to RECOMMEND they own too — the
  // check used to cover only the cart's own lines, so it could never match a
  // recommendation and filtered nothing. One query for both.
  // Anonymous visitors resolve to null → own nothing → no markers.
  const addableIds = published.filter(isAddable).map((b) => b.id);
  const ownedIds = localUserId
    ? await getOwnedBookIds(localUserId, [...new Set([...orderedBooks.map((b) => b.id), ...addableIds])])
    : new Set<string>();

  // A line is PAYABLE when this store still sells it and the reader does not
  // already own it. Only payable lines are added up: an owned book is refused
  // at checkout, and a title demoted to Amazon-only has no price to charge. A
  // total that counted them would promise a number nothing could charge.
  const lines = orderedBooks.map((book) => {
    const owned = ownedIds.has(book.id);
    const sellable = isAddable(book);
    return { book, owned, sellable, payable: sellable && !owned };
  });
  const payable = lines.filter((l) => l.payable).map((l) => l.book);

  const subtotalCents = payable.reduce((s, b) => s + b.priceCents, 0);
  // A cart holding every member of a bundle is charged the bundle price at
  // checkout (src/app/cart/actions.ts attaches the Paddle discount). The
  // summary has to say so: a cart that totals $19.98 and then charges $14.99
  // is a cart the reader cannot trust, even when the surprise is in their
  // favour — and a saving nobody is told about persuades nobody.
  const bundle = matchBundle(payable.map((b) => b.slug));
  const bundleDiscountCents = bundle ? bundleSaving(bundle) : 0;
  const totalCents = subtotalCents - bundleDiscountCents;
  const currency = payable[0]?.currency ?? orderedBooks[0]?.currency ?? "USD";
  const isEmpty = orderedBooks.length === 0;

  // Real recommendations, drawn from the published catalog: only titles the
  // cart will accept, none already in the cart or owned (the cart blocks
  // re-buying an owned book, so recommending one leads straight to a dead end),
  // and the ones most related to what is in the cart first.
  const inCartIds = new Set(orderedBooks.map((b) => b.id));
  const seeds = orderedBooks
    .map((line) => published.find((p) => p.id === line.id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const recommendations = toCatalogItems(
    pickRecommendations({
      all: published,
      exclude: new Set([...inCartIds, ...ownedIds]),
      seeds,
      bundledWith: (slug) => bundlesContaining(slug).flatMap((b) => b.bookSlugs),
    }),
  );

  return (
    <div className="cinematic-root">
      <CinematicHeader />

      <main id="main-content" className="relative z-10">
        <CartHero
          variant={isEmpty ? "empty" : "with-items"}
          itemCount={orderedBooks.length}
        />

        {isEmpty ? (
          <EmptyCartCard />
        ) : (
          <section aria-label="Your cart" className="mx-auto mt-10 max-w-5xl px-4 sm:mt-12 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
              {/* Items list */}
              <div className="space-y-3">
                {lines.map(({ book, owned, sellable }) => (
                  <CartLine
                    key={book.id}
                    book={book}
                    owned={owned}
                    sellable={sellable}
                  />
                ))}
              </div>

              {/* Summary + checkout */}
              <CartSummary
                totalCents={totalCents}
                subtotalCents={subtotalCents}
                bundleName={bundle?.name ?? null}
                bundleDiscountCents={bundleDiscountCents}
                currency={currency}
                itemCount={payable.length}
                otherCount={lines.length - payable.length}
              />
            </div>
          </section>
        )}

        {/* Recommendation shelf — visible in BOTH states, but only when
            there is something real to recommend. Books already in the cart
            are excluded; suggesting what someone is about to buy is noise. */}
        <RecommendationShelf picks={recommendations} />

        {/* Bottom breathing space before footer */}
        <div className="h-24" />
      </main>

      <HomeFooter />
    </div>
  );
}
