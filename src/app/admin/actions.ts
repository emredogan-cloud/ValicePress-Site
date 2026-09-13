"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { AdminAccessError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  authors,
  bookAuthors,
  bookCategories,
  books,
  categories,
} from "@/lib/db/schema";
import { type BookStatus } from "@/lib/db/queries/admin";
import { logger } from "@/lib/logger";

// ===========================================================================
// Shared helpers
// ===========================================================================

/**
 * Translate `AdminAccessError.kind` into a user-facing string for the
 * structured return shape used by `updateBook` / `deleteBook`. The action
 * still returns a `{ok:false}` payload rather than throwing — Client
 * Components can display the message inline instead of bouncing to a
 * 500 / error boundary.
 *
 * `createBook` uses `requireAdmin()` directly and lets the throw propagate
 * because its form has no inline-error UI yet; the existing log-and-swallow
 * catch covers the unhappy path for that legacy entry point.
 */
function adminErrorMessage(err: AdminAccessError): string {
  switch (err.kind) {
    case "unconfigured":
      return "Admin allowlist is empty (ADMIN_EMAILS).";
    case "not_signed_in":
      return "Sign in required.";
    case "no_primary_email":
      return "Your account is missing a primary email.";
    case "not_admin":
      return "You are not on the admin allowlist.";
  }
}

/**
 * Bridge the dynamic admin write path back to the static storefront.
 *
 * Every catalog mutation MUST invalidate every surface that *could* show
 * the affected book — otherwise the admin sees their edit immediately
 * (the admin page is dynamic) but customers see stale ISR HTML for up
 * to an hour (the storefront is Static + ISR, per ADR-1).
 *
 * Surfaces touched:
 *   - `/books`             — catalog browse (was Static + 1h ISR)
 *   - `/books/<slug>`      — the specific book's detail page
 *   - `/books/<oldSlug>`   — when slug changed; old URL must be busted too
 *   - `/sitemap.xml`       — XML sitemap (Static + 1h ISR)
 *   - `/authors/[slug]`    — pattern revalidation; cheaper than enumerating
 *                            every author of the book and calling per-slug
 *   - `/categories/[slug]` — pattern revalidation; same reasoning
 *   - `/admin`             — refresh the catalog management table itself
 *
 * Pattern revalidation (`revalidatePath('/foo/[slug]', 'page')`) was
 * stabilized in Next.js 16; it invalidates every generated path matching
 * the dynamic segment. Cheaper and more correct than running a follow-up
 * SELECT to enumerate exactly which author / category pages reference
 * this book.
 */
function invalidateCatalogPaths(args: {
  newSlug: string;
  oldSlug?: string;
}): void {
  revalidatePath("/books");
  revalidatePath("/sitemap.xml");
  revalidatePath(`/books/${args.newSlug}`);
  if (args.oldSlug && args.oldSlug !== args.newSlug) {
    revalidatePath(`/books/${args.oldSlug}`);
  }
  revalidatePath("/authors/[slug]", "page");
  revalidatePath("/categories/[slug]", "page");
  revalidatePath("/admin");
}

// ===========================================================================
// Relational ingestion (Blocker #1 patch) — authors + categories.
// ===========================================================================

/** Slugify a display name for find-or-create (e.g. "Marcus Aurelius" →
 *  "marcus-aurelius"). ASCII-folded, lowercase, hyphenated, ≤200 chars to
 *  fit `authors.slug` / `categories.slug` varchar(200). */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

// The transaction handle Drizzle hands to `db.transaction(cb)` — same query
// surface as `db`, scoped to the open transaction.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically sync a book's M:N relations (authors + categories) to the given
 * sets using replace semantics (delete-all-then-insert), INSIDE `tx` so a
 * failure rolls back the whole write — never an authorless / partial state.
 *
 *   - Authors: find-or-create by slug (idempotent `onConflictDoNothing`),
 *     linked with `position` preserving the entered order.
 *   - Categories: validated against existing rows; unknown ids are dropped
 *     (the admin can only pick real checkboxes, so this is just belt-and-
 *     suspenders).
 */
async function syncBookRelations(
  tx: Tx,
  bookId: string,
  authorNames: string[],
  categoryIds: string[],
): Promise<void> {
  // ---- Authors ----
  const seen = new Set<string>();
  const wanted: Array<{ name: string; slug: string }> = [];
  for (const raw of authorNames) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    wanted.push({ name, slug });
  }

  if (wanted.length > 0) {
    await tx
      .insert(authors)
      .values(wanted.map((a) => ({ slug: a.slug, name: a.name })))
      .onConflictDoNothing({ target: authors.slug });
  }

  const slugs = wanted.map((a) => a.slug);
  const authorRows =
    slugs.length > 0
      ? await tx
          .select({ id: authors.id, slug: authors.slug })
          .from(authors)
          .where(inArray(authors.slug, slugs))
      : [];
  const idBySlug = new Map(authorRows.map((r) => [r.slug, r.id]));

  await tx.delete(bookAuthors).where(eq(bookAuthors.bookId, bookId));
  const authorLinks = wanted
    .map((a, i) => {
      const authorId = idBySlug.get(a.slug);
      return authorId ? { bookId, authorId, position: i } : null;
    })
    .filter((r): r is { bookId: string; authorId: string; position: number } => r !== null);
  if (authorLinks.length > 0) {
    await tx.insert(bookAuthors).values(authorLinks);
  }

  // ---- Categories / collections ----
  const uniqueCatIds = [...new Set(categoryIds.map((c) => c.trim()).filter(Boolean))];
  let validCatIds: string[] = [];
  if (uniqueCatIds.length > 0) {
    const catRows = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, uniqueCatIds));
    validCatIds = catRows.map((r) => r.id);
  }

  await tx.delete(bookCategories).where(eq(bookCategories.bookId, bookId));
  if (validCatIds.length > 0) {
    await tx
      .insert(bookCategories)
      .values(validCatIds.map((categoryId) => ({ bookId, categoryId })));
  }
}

/*
 * `ensureCoreCollections` has been removed along with the four collections it
 * seeded. Categories are declared in `scripts/catalog/valice-catalog.mjs` and
 * applied by the catalog loader, which also deletes categories that no longer
 * have a book in them — so a one-click button that creates empty shelves is
 * now working directly against the thing that keeps the navigation honest.
 */

// ===========================================================================
// createBook — unchanged shape, but `requireUserId` upgraded to
// `requireAdmin` (consistency fix; SUB-PR 4.1 added the strict gate to the
// page-level loader and to `updateBook` / `deleteBook` below, so leaving
// the create path on a weaker check would be incongruous).
// ===========================================================================

interface CreateBookInput {
  title: string;
  slug: string;
  subtitle?: string;
  description?: string;
  priceCents: number;
  currency: string;
  language: string;
  masterFileKey?: string;
  coverKey?: string;
  sampleKey?: string;
  isbn?: string;
  pageCount?: number;
  /**
   * The active provider's id for the digital edition — a Lemon Squeezy
   * **variant** id (numeric). Optional at create time — the book can land in
   * draft, get its variant provisioned in the Lemon Squeezy
   * dashboard, and have the id filled in via the edit flow before publish.
   * Checkout fails fast for any cart item lacking this value (SUB-PR 1.5).
   */
  providerPriceId?: string;
  /** Author display names (find-or-created by slug, linked in order). */
  authorNames: string[];
  /** Category/collection ids to link (validated against existing rows). */
  categoryIds: string[];
}

export async function createBook(formData: FormData): Promise<void> {
  try {
    await requireAdmin();
    const input = parseCreateBookFormData(formData);

    // Book row + relations in one transaction → no authorless/partial state.
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(books)
        .values({
          title: input.title,
          slug: input.slug,
          subtitle: input.subtitle ?? null,
          description: input.description ?? null,
          priceCents: input.priceCents,
          currency: input.currency,
          language: input.language,
          masterFileKey: input.masterFileKey ?? null,
          coverKey: input.coverKey ?? null,
          sampleKey: input.sampleKey ?? null,
          isbn: input.isbn ?? null,
          pageCount: input.pageCount ?? null,
          providerPriceId: input.providerPriceId ?? null,
          // status defaults to "draft"; publishedAt stays null until publish.
        })
        .returning({ id: books.id });

      await syncBookRelations(tx, row.id, input.authorNames, input.categoryIds);
    });

    invalidateCatalogPaths({ newSlug: input.slug });
  } catch (err) {
    // Log and swallow — this legacy entry point's form has no inline-error
    // UI. Failure path lives in logs + the admin page rendering an old
    // table. SUB-PR 4.4's edit form returns structured errors instead.
    // SUB-PR 4.5: route through `logger.error` so Sentry catches it too.
    logger.error("[admin] createBook failed", err);
  }
}

function parseCreateBookFormData(formData: FormData): CreateBookInput {
  const getString = (key: string): string | undefined => {
    const raw = formData.get(key);
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  const getRequiredString = (key: string): string => {
    const value = getString(key);
    if (!value) throw new Error(`Missing required field: ${key}`);
    return value;
  };

  const getNumber = (key: string): number | undefined => {
    const raw = getString(key);
    if (raw === undefined) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid number for field ${key}: ${raw}`);
    }
    return n;
  };

  const getRequiredNumber = (key: string): number => {
    const value = getNumber(key);
    if (value === undefined) {
      throw new Error(`Missing required field: ${key}`);
    }
    return value;
  };

  return {
    title: getRequiredString("title"),
    slug: getRequiredString("slug"),
    subtitle: getString("subtitle"),
    description: getString("description"),
    priceCents: getRequiredNumber("priceCents"),
    currency: getString("currency") ?? "USD",
    language: getString("language") ?? "en",
    masterFileKey: getString("masterFileKey"),
    coverKey: getString("coverKey"),
    sampleKey: getString("sampleKey"),
    isbn: getString("isbn"),
    pageCount: getNumber("pageCount"),
    providerPriceId: getString("providerPriceId"),
    authorNames: (getString("authorNames") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    categoryIds: formData
      .getAll("categoryIds")
      .filter((v): v is string => typeof v === "string"),
  };
}

// ===========================================================================
// updateBook — SUB-PR 4.4
// ===========================================================================

export interface UpdateBookInput {
  id: string;
  /**
   * The slug as it was when the admin LOADED the edit form. Used so the
   * action can invalidate the OLD slug's ISR cache when the user changes
   * the slug field during the edit.
   */
  originalSlug: string;

  // Editable fields
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  language: string;
  coverKey: string | null;
  sampleKey: string | null;
  masterFileKey: string | null;
  pageCount: number | null;
  isbn: string | null;
  providerPriceId: string | null;
  status: BookStatus;
  /** Author display names (find-or-created by slug, linked in order). */
  authorNames: string[];
  /** Category/collection ids to link (validated against existing rows). */
  categoryIds: string[];
}

export type UpdateBookResult = { ok: true } | { ok: false; error: string };

export async function updateBook(
  input: UpdateBookInput,
): Promise<UpdateBookResult> {
  // ---- 1. AuthZ gate ------------------------------------------------------
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAccessError) {
      return { ok: false, error: adminErrorMessage(err) };
    }
    throw err;
  }

  // ---- 2. Light validation -----------------------------------------------
  if (!input.id) return { ok: false, error: "Missing book id." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.slug.trim()) return { ok: false, error: "Slug is required." };
  if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
    return { ok: false, error: "Price (cents) must be a non-negative number." };
  }

  // ---- 3. Resolve `publishedAt` transition --------------------------------
  // The catalog orders published books by `publishedAt DESC`. When an admin
  // first transitions a draft → published, we must stamp the timestamp so
  // it ranks correctly. Re-publishing a previously-published book does NOT
  // reset the stamp (idempotent — admins can toggle status without changing
  // the apparent publish date).
  let publishedAtPatch: Date | undefined;
  try {
    const existing = await db.query.books.findFirst({
      where: (b, { eq: eqFn }) => eqFn(b.id, input.id),
      columns: { status: true, publishedAt: true },
    });
    if (!existing) {
      return { ok: false, error: "Book not found." };
    }
    if (
      input.status === "published" &&
      existing.status !== "published" &&
      existing.publishedAt === null
    ) {
      publishedAtPatch = new Date();
    }
  } catch (err) {
    logger.error("[admin] updateBook (existing fetch) failed", err, {
      bookId: input.id,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load book.",
    };
  }

  // ---- 4. Persist (book row + relations, atomically) ---------------------
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(books)
        .set({
          title: input.title.trim(),
          slug: input.slug.trim(),
          subtitle: input.subtitle?.trim() || null,
          description: input.description?.trim() || null,
          priceCents: input.priceCents,
          currency: input.currency.trim() || "USD",
          language: input.language.trim() || "en",
          coverKey: input.coverKey?.trim() || null,
          sampleKey: input.sampleKey?.trim() || null,
          masterFileKey: input.masterFileKey?.trim() || null,
          pageCount: input.pageCount,
          isbn: input.isbn?.trim() || null,
          providerPriceId: input.providerPriceId?.trim() || null,
          status: input.status,
          ...(publishedAtPatch ? { publishedAt: publishedAtPatch } : {}),
        })
        .where(eq(books.id, input.id));

      await syncBookRelations(
        tx,
        input.id,
        input.authorNames,
        input.categoryIds,
      );
    });
  } catch (err) {
    logger.error("[admin] updateBook failed", err, {
      bookId: input.id,
      slug: input.slug,
    });
    const message = err instanceof Error ? err.message : "Update failed.";
    // Duplicate slug is the only meaningful per-user error here (UNIQUE
    // constraint on `books_slug_uk`). Surface a clearer message.
    if (
      message.toLowerCase().includes("duplicate") ||
      message.toLowerCase().includes("books_slug_uk")
    ) {
      return {
        ok: false,
        error: `Slug "${input.slug}" is already in use by another book.`,
      };
    }
    return { ok: false, error: message };
  }

  // ---- 5. ISR invalidation ------------------------------------------------
  invalidateCatalogPaths({
    newSlug: input.slug,
    oldSlug: input.originalSlug,
  });

  return { ok: true };
}

// ===========================================================================
// deleteBook — SUB-PR 4.4
// ===========================================================================

export interface DeleteBookInput {
  id: string;
  /** Used for ISR invalidation of `/books/<slug>` after delete. */
  slug: string;
}

export type DeleteBookResult = { ok: true } | { ok: false; error: string };

export async function deleteBook(
  input: DeleteBookInput,
): Promise<DeleteBookResult> {
  // ---- 1. AuthZ gate ------------------------------------------------------
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAccessError) {
      return { ok: false, error: adminErrorMessage(err) };
    }
    throw err;
  }

  if (!input.id) return { ok: false, error: "Missing book id." };

  // ---- 2. Attempt hard delete --------------------------------------------
  // `entitlements.book_id` and `order_items.book_id` are both `onDelete:
  // 'restrict'` in the schema — a book that has ever been purchased
  // CANNOT be hard-deleted (this is correct: tax / order history must be
  // preserved per Roadmap §11). The catch below translates that FK error
  // into actionable guidance for the operator.
  try {
    await db.delete(books).where(eq(books.id, input.id));
  } catch (err) {
    logger.error("[admin] deleteBook failed", err, {
      bookId: input.id,
      slug: input.slug,
    });
    const message = err instanceof Error ? err.message : "Delete failed.";
    if (
      message.toLowerCase().includes("foreign key") ||
      message.toLowerCase().includes("violates")
    ) {
      return {
        ok: false,
        error:
          "Cannot delete: this book has order / entitlement history. Archive it instead by changing the status to 'archived' — it will disappear from the catalog while preserving the commercial record.",
      };
    }
    return { ok: false, error: message };
  }

  // ---- 3. ISR invalidation ------------------------------------------------
  invalidateCatalogPaths({ newSlug: input.slug });

  return { ok: true };
}
