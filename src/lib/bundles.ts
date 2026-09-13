/**
 * Reader bundles — a set of books that costs less bought together.
 *
 * STRUCTURALLY UNAVAILABLE SINCE THE LEMON SQUEEZY MIGRATION (2026-09-13).
 *
 * The whole design below assumed a multi-line transaction: the cart built ONE
 * Paddle transaction with a line per book and attached a discount restricted
 * to the member prices. Lemon Squeezy binds a checkout to a single variant,
 * so there is no transaction for a set-discount to sit on. `BUNDLES` is empty
 * and `matchBundle` therefore returns null for every cart, which is why no
 * discount line can appear over a total nobody could pay.
 *
 * WHAT BRINGING BUNDLES BACK WOULD TAKE, honestly: a Lemon Squeezy **product**
 * whose single variant is the set, priced at the bundle price, and fulfilment
 * that grants every member from that one variant id. That is a real feature —
 * a new catalogue entity, a second resolution path in the webhook, and new
 * entitlement semantics — not a discount id. It is not attempted here, and the
 * old restore condition ("Paddle confirms the public-domain model in writing")
 * is obsolete: Paddle is retired.
 *
 * The definition is kept because the editorial pairing is still right and the
 * press still wants to sell it.
 */

export interface Bundle {
  /** Stable id. */
  slug: string;
  name: string;
  /** Catalogue slugs that must ALL be in the cart for the bundle to apply. */
  bookSlugs: string[];
  /** Historical Paddle discount id. Retired provider; kept for the record. */
  discountId: string;
  /** What the set costs together, in cents, after the discount. */
  bundleCents: number;
  /** What the same books cost bought separately, in cents. */
  separatelyCents: number;
  blurb: string;
}

/**
 * SUSPENDED. Originally 2026-09-12 for the Paddle review; that reason lapsed
 * when the classics returned to the storefront on 2026-09-13, and a different
 * one replaced it the same day — Lemon Squeezy has no multi-item checkout for
 * a set discount to attach to (see the header).
 *
 * Both members are sellable again, so this is no longer a rights or compliance
 * matter: it is a missing product. `matchBundle` over an empty `BUNDLES`
 * returns null, so every consumer already behaves as though there is simply no
 * bundle today.
 */
export const SUSPENDED_BUNDLES: Bundle[] = [
  {
    slug: "stoic-library",
    name: "The Stoic Library",
    bookSlugs: ["meditations", "epictetus-discourses-and-enchiridion"],
    discountId: "dsc_01m1v1b5a1e0b3711gmj78brt3",
    bundleCents: 1499,
    separatelyCents: 1998,
    blurb:
      "Marcus Aurelius read Epictetus — he says so in the first book of the " +
      "Meditations, thanking Junius Rusticus for lending him a copy. Both " +
      "editions together, and the concordance in the Epictetus lists the four " +
      "passages where Long's two translations touch.",
  },
];

/** Bundles a cart can actually qualify for today. */
export const BUNDLES: Bundle[] = [];

/** Cents saved by buying the set together. */
export function bundleSaving(b: Bundle): number {
  return b.separatelyCents - b.bundleCents;
}

/**
 * The bundle a cart qualifies for, if any.
 *
 * A cart qualifies when it contains EVERY member. Always null today: `BUNDLES`
 * is empty for the reason in the header.
 */
export function matchBundle(slugsInCart: readonly string[]): Bundle | null {
  const have = new Set(slugsInCart);
  return (
    BUNDLES.find((b) => b.bookSlugs.every((s) => have.has(s))) ?? null
  );
}

/** The bundles a given book belongs to — for cross-sell on a product page. */
export function bundlesContaining(slug: string): Bundle[] {
  return BUNDLES.filter((b) => b.bookSlugs.includes(slug));
}
