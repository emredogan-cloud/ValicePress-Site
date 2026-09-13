import "server-only";

import {
  getPublishedBookBySlug,
  getCartBooks,
  listAllCategories,
  listPublishedBooks,
  searchBooks as searchBooksQuery,
} from "@/lib/db/queries/catalog";
import { campaignEndMs, campaignState } from "@/lib/campaign";
import { readCart } from "@/lib/cart";
import { getCompanionForBook, listCompanions } from "@/lib/companions";
import { formatCatalogPrice } from "@/lib/format";

/**
 * What the assistant is allowed to know, and where it comes from.
 *
 * THERE IS NO SECOND CATALOG HERE. Every function below is a thin wrapper over
 * the exact queries the storefront itself renders from — `listPublishedBooks`,
 * `searchBooks`, `getPublishedBookBySlug`, `listAllCategories`, `readCart`,
 * `getCompanionForBook`, `campaignState`. That is deliberate and it is the
 * whole design: a hand-maintained copy of the catalog in a prompt would drift
 * the first time a price changed, and the assistant would then be confidently
 * wrong about the one thing it exists to be right about.
 *
 * WHAT IS DELIBERATELY NOT EXPOSED
 *   - `masterFileKey` / `epubFileKey` — the private R2 keys. The assistant can
 *     say a book HAS a PDF; it can never be steered into naming the object.
 *   - anything from `free_book_requests`. Another visitor's email, message or
 *     queue position is not the assistant's business, and there is no function
 *     here that could return one.
 *   - `books.status` other than `published`. A draft is not a book yet.
 *
 * `priceCents === 0` is carried through honestly: this catalog uses it to mean
 * "not sold here" (see `formatCatalogPrice`), never "free". The shaping below
 * hands the model a `soldHere` boolean so it cannot misread a zero.
 */

export interface AiBook {
  slug: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  category: string | null;
  /** Human price, or "Not sold here" when this store does not sell it. */
  price: string;
  /** False when `price_cents = 0` — the edition is fulfilled by Amazon. */
  soldHere: boolean;
  /** Whether this title can be requested during the free campaign. */
  freeDuringCampaign: boolean;
  /** Set only when it cannot — a sentence safe to say to a customer verbatim. */
  unavailableReason: string | null;
  url: string;
  companionUrl: string | null;
}

function shape(b: {
  slug: string;
  title: string;
  subtitle: string | null;
  priceCents: number;
  deliverableFree?: boolean;
  buyableHere?: boolean;
  currency: string;
  authors: ReadonlyArray<{ slug: string; name: string }>;
  primaryCategory?: string | null;
}): AiBook {
  const companion = getCompanionForBook(b.slug);
  /**
   * THREE QUESTIONS, AND THE ASSISTANT MUST NOT CONFLATE ANY TWO OF THEM.
   *
   * `soldHere` — can a reader pay us for it TODAY? `giveableHere` — do we hold
   * a file we can hand over? All three collapsed into `priceCents > 0` once,
   * and the storefront has since separated them twice.
   *
   * Measured, the first time this shipped conflated: the assistant was asked
   * "Can I buy Meditations from you?" and answered "it is not part of our
   * free-ebook promotion and cannot be requested as a PDF from us" — which was
   * false, and false in the direction that turns a reader away from a book we
   * would have given them.
   *
   * `buyableHere` is the strict answer — the book is wired to a live checkout
   * at the active provider. The price test remains the fallback for surfaces
   * that do not carry the flag. During a provider migration the two disagree
   * for every title, and the strict one is the honest one: telling a reader
   * they can buy a book whose page shows no buy button sends them to a dead
   * end, which is the same defect as the Meditations answer pointing the other
   * way.
   */
  const soldHere = b.buyableHere ?? b.priceCents > 0;
  const giveableHere = b.deliverableFree ?? b.priceCents > 0;
  return {
    slug: b.slug,
    title: b.title,
    subtitle: b.subtitle,
    authors: b.authors.map((a) => a.name),
    category: b.primaryCategory ?? null,
    price: formatCatalogPrice(b.priceCents, b.currency || "USD"),
    soldHere,
    // The same predicate the gift box and the API use: do we hold the file?
    freeDuringCampaign: giveableHere,
    /**
     * WHY THIS IS A SENTENCE AND NOT A FLAG.
     *
     * A `false` invites the model to explain it, and the first time it tried
     * it said Codex Mythologica *was* free — the campaign was open, the model
     * reasoned from that, and never looked at the book. So the refusal ships
     * as prose the model can only repeat.
     *
     * It says what is true for a customer and stops there. All three affected
     * titles have no ebook to give from here; that one of them is under a KDP
     * Select exclusivity agreement is our contractual problem, not a fact a
     * reader needs, and naming a business arrangement is not the assistant's
     * job.
     */
    unavailableReason: giveableHere
      ? soldHere
        ? null
        : // Not for sale here, but ours to give. Saying only the first half is
          // what made the assistant turn a reader away from a free book.
          "valicepress.com is not selling a digital edition of this title through " +
          "its own checkout at the moment, but it IS free to request during the " +
          "promotion while that is running. Any printed edition it has is listed " +
          "on the book's page."
      : "valicepress.com does not sell a digital edition of this title, so it is not " +
        "part of the free-ebook promotion and cannot be requested here. The editions " +
        "that do exist, and where each one is bought, are listed on the book's page.",
    url: `/books/${b.slug}`,
    companionUrl: companion ? `/companion/${companion.slug}` : null,
  };
}

/** Every published title, shaped for the model. Small enough to hand over whole. */
export async function allBooks(): Promise<AiBook[]> {
  const rows = await listPublishedBooks();
  return rows.map(shape);
}

export async function findBooks(query: string, limit = 8): Promise<AiBook[]> {
  const q = query.trim();
  if (!q) return [];
  // Postgres full-text first — it is what the site's own search box uses, so
  // the assistant and the search results agree.
  const hits = await searchBooksQuery(q);
  if (hits.length > 0) return hits.slice(0, limit).map(shape);

  // Fall back to a substring sweep over titles, subtitles, authors and
  // categories. FTS misses partial words ("myth" vs "mythology") and a
  // shopper's question is full of partial words.
  const needle = q.toLowerCase();
  const all = await listPublishedBooks();
  return all
    .filter((b) =>
      [b.title, b.subtitle ?? "", b.primaryCategory ?? "", ...b.authors.map((a) => a.name)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    )
    .slice(0, limit)
    .map(shape);
}

export interface AiBookDetail extends AiBook {
  description: string | null;
  pageCount: number | null;
  isbn: string | null;
  /** Editions and where each one is actually bought. */
  formats: Array<{ format: string; availability: string; price: string | null; buyAt: string }>;
  /** True when a deliverable PDF master exists. The key itself never leaves. */
  hasDownloadablePdf: boolean;
}

export async function bookDetail(slug: string): Promise<AiBookDetail | null> {
  const b = await getPublishedBookBySlug(slug);
  if (!b) return null;
  const base = shape(b);
  return {
    ...base,
    description: b.description ?? null,
    pageCount: b.pageCount ?? null,
    isbn: b.isbn ?? null,
    formats: (b.formats ?? []).map((f) => ({
      format: f.format,
      availability: f.availability,
      price: f.priceCents !== null ? formatCatalogPrice(f.priceCents, f.currency || "USD") : null,
      buyAt: f.fulfillment === "amazon" ? "Amazon" : "valicepress.com",
    })),
    // A boolean, never a key. The assistant may say "yes, this one has a PDF";
    // no prompt can make it name an R2 object, because it never receives one.
    // `soldHere` is the honest proxy the storefront already uses: a title this
    // store sells is a title it holds a master for.
    hasDownloadablePdf: base.soldHere,
  };
}

export async function categories(): Promise<Array<{ name: string; slug: string; count: number }>> {
  const rows = await listAllCategories();
  return rows.map((c) => ({ name: c.name, slug: c.slug, count: c.bookCount }));
}

export interface AiCampaign {
  state: "scheduled" | "active" | "expiring" | "ended";
  offerOpen: boolean;
  endsAtIso: string;
  howToRequest: string;
}

/**
 * The campaign, from the SAME clock the storefront uses.
 *
 * Not a second timer, not a cached string in a prompt: `campaignState()` is the
 * one canonical source, so the assistant physically cannot tell a visitor the
 * books are free after the banner has stopped saying so.
 */
export function campaign(): AiCampaign {
  const state = campaignState();
  return {
    state,
    offerOpen: state === "active" || state === "expiring",
    endsAtIso: new Date(campaignEndMs()).toISOString(),
    howToRequest:
      "Open any ebook's page or the /ebooks shelf, press the gold FREE gift box beside the " +
      "price, enter an email address and optionally a short message, and submit. The request " +
      "joins a queue and the PDF is emailed within 24 hours. No review, rating or purchase is " +
      "required at any point.",
  };
}

export interface AiCart {
  itemCount: number;
  items: Array<{ title: string; price: string; url: string }>;
  total: string;
  checkoutNote: string;
}

/**
 * The CURRENT visitor's cart, read from their own cookie on the server.
 *
 * This is the only per-visitor thing the assistant can see, it is scoped to the
 * request that asked, and it contains no identity — the cart cookie holds book
 * ids and timestamps, nothing about a person. There is no code path here that
 * can read anybody else's cart, because the only input is the caller's own
 * request.
 */
export async function cart(): Promise<AiCart> {
  const c = await readCart();
  if (c.items.length === 0) {
    return { itemCount: 0, items: [], total: "$0.00", checkoutNote: "The cart is empty." };
  }
  const books = await getCartBooks(c.items.map((i) => i.bookId));
  const cents = books.reduce((sum, b) => sum + b.priceCents, 0);
  return {
    itemCount: books.length,
    items: books.map((b) => ({
      title: b.title,
      price: formatCatalogPrice(b.priceCents, b.currency || "USD"),
      url: `/books/${b.slug}`,
    })),
    total: formatCatalogPrice(cents, books[0]?.currency || "USD"),
    checkoutNote:
      "Card checkout is still being set up, so payment is not available yet. Every ebook can " +
      "be requested free during the current promotion instead.",
  };
}

export function companions(): Array<{ title: string; url: string; bookSlug: string | null }> {
  return listCompanions().map((c) => ({
    title: c.bookTitle,
    url: `/companion/${c.slug}`,
    bookSlug: c.bookSlug ?? null,
  }));
}
