import type { Metadata } from "next";
import Link from "next/link";

import { BookStatusBadge } from "@/components/book-status-badge";
import { CinematicHero } from "@/components/cinematic/cinematic-hero";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { UnprovisionedNotice } from "@/components/unprovisioned-notice";
import { AdminAccessError, requireAdmin } from "@/lib/auth";
import {
  getDashboardMetrics,
  getRecentOrders,
  listAllBooksForAdmin,
  listCategoriesForAdmin,
  type AdminCategory,
  type BookAdminListItem,
  type DashboardMetrics,
  type OrderStatus,
  type RecentOrder,
} from "@/lib/db/queries/admin";
import { formatPrice } from "@/lib/format";

import { createBook } from "./actions";

/**
 * /admin — internal dashboard.
 *
 * Phase 3.B cinematic redesign (Internal Dashboard family — new family
 * for admin-only surfaces). Same shell as the rest of the cinematic
 * site, but layout is denser (table-heavy) because the audience is the
 * operator, not the customer.
 *
 * Reads Clerk session cookies and writes to the database — `ƒ Dynamic`
 * forced; never prerendered.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// ---------------------------------------------------------------------------
// Admin context loader — unchanged behavior, cinematic-ize the surface only.
// ---------------------------------------------------------------------------
interface AdminContextOk {
  ok: true;
  email: string;
  localUserId: string;
}
interface AdminContextBlocked {
  ok: false;
  title: string;
  body: string;
  missing: ReadonlyArray<string>;
}
type AdminContext = AdminContextOk | AdminContextBlocked;

function checkRequiredEnv(): string[] {
  const missing: string[] = [];
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY");
  }
  if (!process.env.DATABASE_URL) {
    missing.push("DATABASE_URL");
  }
  return missing;
}

function mapAdminAccessError(err: AdminAccessError): AdminContextBlocked {
  switch (err.kind) {
    case "unconfigured":
      return {
        ok: false,
        title: "Admin allowlist is empty",
        body: "Set ADMIN_EMAILS to a comma-separated list of admin email addresses, then redeploy.",
        missing: ["ADMIN_EMAILS"],
      };
    case "not_signed_in":
      return {
        ok: false,
        title: "Sign in required",
        body: "You need to be signed in with an admin account to use this page.",
        missing: [],
      };
    case "no_primary_email":
      return {
        ok: false,
        title: "Your Clerk account has no primary email",
        body: "Configure a primary email address on your Clerk account, then reload this page.",
        missing: [],
      };
    case "not_admin":
      return {
        ok: false,
        title: "Not authorized",
        body: "Your account is not on the admin allowlist. Ask another admin to add your email to ADMIN_EMAILS.",
        missing: [],
      };
  }
}

async function loadAdminContext(): Promise<AdminContext> {
  const missingEnv = checkRequiredEnv();
  if (missingEnv.length > 0) {
    return {
      ok: false,
      title: "Admin panel — configuration required",
      body: "The admin surface needs Clerk authentication and a database before it can load. Set the variables below and reload.",
      missing: missingEnv,
    };
  }

  try {
    const { email, localUserId } = await requireAdmin();
    return { ok: true, email, localUserId };
  } catch (err) {
    if (err instanceof AdminAccessError) return mapAdminAccessError(err);
    return {
      ok: false,
      title: "Admin panel — system unavailable",
      body:
        err instanceof Error
          ? `Setup failed: ${err.message}`
          : "Setup failed for an unknown reason — see the server logs.",
      missing: [],
    };
  }
}

// ===========================================================================
// Page
// ===========================================================================
export default async function AdminPage() {
  const ctx = await loadAdminContext();

  if (!ctx.ok) {
    return (
      <UnprovisionedNotice
        title={ctx.title}
        body={ctx.body}
        missing={ctx.missing}
      />
    );
  }

  const [metrics, recentOrders, catalog, allCategories] = await Promise.all([
    getDashboardMetrics(),
    getRecentOrders(10),
    listAllBooksForAdmin(),
    listCategoriesForAdmin(),
  ]);

  return (
    <div className="cinematic-root">
      <CinematicHeader />

      <main id="main-content" className="relative z-10">
        <CinematicHero
          eyebrow="Admin · Dashboard"
          headlineHead="Bookstore"
          headlineTail="at a glance"
          size="md"
          align="center"
          subtitle={
            <p>
              Signed in as <span className="text-fg-hi">{ctx.email}</span>{" "}
              · local user{" "}
              <code className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[12px] lg:text-[10px] text-emerald-bright">
                {ctx.localUserId}
              </code>
            </p>
          }
        />

        <div className="mx-auto mt-10 sm:mt-16 max-w-6xl space-y-16 px-4 sm:px-6">
          <MetricsRow metrics={metrics} />
          <RecentOrdersSection orders={recentOrders} />
          <CatalogManagementSection books={catalog} />
          <CreateBookSection allCategories={allCategories} />
        </div>

        <div className="h-20" />
      </main>

      <HomeFooter />
    </div>
  );
}

// ===========================================================================
// Metrics — 3 cards (revenue / books sold / users).
// ===========================================================================
function MetricsRow({ metrics }: { metrics: DashboardMetrics }) {
  const primary = metrics.revenueByCurrency[0];
  const others = metrics.revenueByCurrency.slice(1);

  const revenueValue = primary
    ? formatPrice(primary.netCents, primary.currency)
    : "—";
  const revenueSubline = primary
    ? `Gross ${formatPrice(primary.grossCents, primary.currency)} · ${primary.orderCount} paid ${primary.orderCount === 1 ? "order" : "orders"}`
    : "No paid orders yet";

  return (
    <section aria-labelledby="metrics-heading">
      <h2 id="metrics-heading" className="sr-only">
        Key metrics
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          label="Net revenue"
          value={revenueValue}
          sublabel={revenueSubline}
        />
        <StatCard
          label="Books sold"
          value={metrics.booksSold.toLocaleString("en-US")}
          sublabel="Across all paid orders"
        />
        <StatCard
          label="Total users"
          value={metrics.totalUsers.toLocaleString("en-US")}
          sublabel="Signed-in accounts (Clerk-synced)"
        />
      </div>

      {others.length > 0 && (
        <p className="mt-4 text-xs text-fg-soft">
          Additional currencies:{" "}
          {others
            .map(
              (c) =>
                `${formatPrice(c.netCents, c.currency)} (${c.orderCount} ${c.orderCount === 1 ? "order" : "orders"})`,
            )
            .join(" · ")}
        </p>
      )}
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="home-glass relative overflow-hidden rounded-[20px] p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/30 to-transparent"
      />
      <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
        {label}
      </p>
      <p className="mt-3 font-serif text-[32px] font-medium leading-tight tabular-nums text-fg-hi">
        {value}
      </p>
      {sublabel && (
        <p className="mt-2 text-xs text-fg-mid">{sublabel}</p>
      )}
    </div>
  );
}

// ===========================================================================
// Recent Orders table.
// ===========================================================================
function RecentOrdersSection({ orders }: { orders: RecentOrder[] }) {
  return (
    <section aria-labelledby="recent-orders-heading">
      <header className="flex items-baseline justify-between">
        <h2
          id="recent-orders-heading"
          className="font-serif text-[24px] font-medium text-fg-hi"
        >
          Recent orders
        </h2>
        <p className="text-[12px] lg:text-[11px] uppercase tracking-[0.2em] text-fg-soft">
          Newest {orders.length}
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="home-glass mt-6 rounded-[20px] px-6 py-12 text-center">
          <p className="text-sm text-fg-mid">
            No orders yet. Once a customer completes a checkout, it appears
            here.
          </p>
        </div>
      ) : (
        <div className="home-glass mt-6 overflow-x-auto rounded-[20px]">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[12px] lg:text-[10px] uppercase tracking-[0.12em] text-fg-soft">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Items
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Total
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {orders.map((o) => (
                <RecentOrderRow key={o.id} order={o} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentOrderRow({ order }: { order: RecentOrder }) {
  const firstTitle = order.items[0]?.bookTitle ?? "(empty order)";
  const moreCount = Math.max(0, order.items.length - 1);
  const itemSummary =
    moreCount > 0 ? `${firstTitle} +${moreCount} more` : firstTitle;

  return (
    <tr className="text-fg-hi transition-colors hover:bg-white/[0.02]">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-fg-soft">
        {formatOrderDate(order.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium">{order.customerName ?? "—"}</span>
          <span className="text-xs text-fg-soft">
            {order.customerEmail}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-fg-mid">
        {itemSummary}
        <span className="ml-2 text-fg-soft">
          ({order.items.length}{" "}
          {order.items.length === 1 ? "item" : "items"})
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
        {formatPrice(order.totalCents, order.currency)}
      </td>
      <td className="px-4 py-3">
        <OrderStatusBadge status={order.status} />
      </td>
    </tr>
  );
}

const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  paid: "border-emerald-bright/30 bg-emerald-bright/10 text-emerald-bright",
  pending: "border-white/[0.12] bg-white/[0.04] text-fg-mid",
  failed: "border-[#ff7a7a]/30 bg-[#ff7a7a]/8 text-[#ff9b9b]",
  refunded: "border-[#ffce63]/30 bg-[#ffce63]/8 text-[#ffce63]",
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] lg:text-[10px] font-semibold uppercase tracking-[0.12em] ${ORDER_STATUS_BADGE_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}

function formatOrderDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ===========================================================================
// Catalog Management table.
// ===========================================================================
function CatalogManagementSection({ books }: { books: BookAdminListItem[] }) {
  return (
    <section aria-labelledby="catalog-management-heading">
      <header className="flex items-baseline justify-between">
        <h2
          id="catalog-management-heading"
          className="font-serif text-[24px] font-medium text-fg-hi"
        >
          Catalog management
        </h2>
        <p className="text-[12px] lg:text-[11px] uppercase tracking-[0.2em] text-fg-soft">
          {books.length} {books.length === 1 ? "title" : "titles"}
        </p>
      </header>

      {books.length === 0 ? (
        <div className="home-glass mt-6 rounded-[20px] px-6 py-12 text-center">
          <p className="text-sm text-fg-mid">
            No books in the catalog yet. Use the &ldquo;Add a book&rdquo; form
            below to create the first draft.
          </p>
        </div>
      ) : (
        <div className="home-glass mt-6 overflow-x-auto rounded-[20px]">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[12px] lg:text-[10px] uppercase tracking-[0.12em] text-fg-soft">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Slug
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Price
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {books.map((book) => (
                <CatalogRow key={book.id} book={book} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CatalogRow({ book }: { book: BookAdminListItem }) {
  return (
    <tr className="text-fg-hi transition-colors hover:bg-white/[0.02]">
      <td className="px-4 py-3">
        {book.status === "published" ? (
          <Link
            href={`/books/${book.slug}`}
            className="font-medium underline-offset-2 hover:text-emerald-bright hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {book.title}
          </Link>
        ) : (
          <span className="font-medium">{book.title}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <code className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-xs text-fg-mid">
          {book.slug}
        </code>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
        {formatPrice(book.priceCents, book.currency)}
      </td>
      <td className="px-4 py-3">
        <BookStatusBadge status={book.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Link
          href={`/admin/books/${book.slug}/edit`}
          className="text-sm font-semibold text-emerald-bright underline-offset-2 hover:underline"
        >
          Edit →
        </Link>
      </td>
    </tr>
  );
}

// ===========================================================================
// Create Book form.
// ===========================================================================
function CreateBookSection({
  allCategories,
}: {
  allCategories: AdminCategory[];
}) {
  return (
    <section aria-labelledby="create-book-heading">
      <header>
        <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
          Catalog · Ingest
        </p>
        <h2
          id="create-book-heading"
          className="mt-2 font-serif text-[24px] font-medium text-fg-hi"
        >
          Add a book
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-mid">
          New titles land as{" "}
          <code className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-xs text-emerald-bright">
            draft
          </code>
          . Master, cover, and sample R2 keys can be filled in after upload; the
          publish flow (status →{" "}
          <code className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-xs text-emerald-bright">
            published
          </code>
          ) lands in a later SUB-PR.
        </p>

        <p className="mt-5 text-xs leading-relaxed text-fg-soft">
          Categories are declared in{" "}
          <code className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-xs text-emerald-bright">
            scripts/catalog/valice-catalog.mjs
          </code>{" "}
          and applied by the catalog loader, which also removes any category
          left with no books in it. There is deliberately no button here that
          creates a shelf before there is anything to put on it.
        </p>
      </header>

      <form
        action={createBook}
        className="home-glass relative mt-8 max-w-3xl space-y-6 overflow-hidden rounded-[24px] p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/30 to-transparent"
        />

        <FormField label="Title" name="title" required />
        <FormField
          label="Slug"
          name="slug"
          required
          help="URL-safe identifier (no spaces). Example: learning-rust."
        />
        <FormField label="Subtitle" name="subtitle" />
        <FormField label="Description" name="description" textarea />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            label="Price (cents)"
            name="priceCents"
            type="number"
            required
            help="Stored as integer cents. 1500 = $15.00."
          />
          <FormField label="Currency" name="currency" defaultValue="USD" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField label="Language" name="language" defaultValue="en" />
          <FormField label="Page count" name="pageCount" type="number" />
        </div>

        <FormField label="ISBN" name="isbn" />

        <FormField
          label="Authors"
          name="authorNames"
          help="Comma-separated. New names are created automatically. Example: Marcus Aurelius, Gregory Hays."
        />

        <fieldset className="space-y-3 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
          <legend className="px-2 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
            Collections / categories
          </legend>
          {allCategories.length === 0 ? (
            <p className="text-xs leading-relaxed text-fg-soft">
              No collections yet. Click{" "}
              <span className="text-fg-mid">Ensure core collections</span> above
              to seed the curated set, then reload this page.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {allCategories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-fg-mid transition-colors hover:border-emerald-bright/30 hover:text-fg-hi"
                >
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                    className="h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-bright"
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-6 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
          <legend className="px-2 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
            R2 object keys (optional now; required before publish)
          </legend>
          <FormField
            label="Cover key"
            name="coverKey"
            help="Path inside the ARTIFACTS bucket. Example: covers/learning-rust.jpg."
          />
          <FormField
            label="Sample key"
            name="sampleKey"
            help="HTML or PDF sample key in the ARTIFACTS bucket."
          />
          <FormField
            label="Master file key"
            name="masterFileKey"
            help="Path inside the MASTERS bucket. Required before publishing."
          />
        </fieldset>

        <fieldset className="space-y-6 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
          <legend className="px-2 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
            Merchant of Record (Lemon Squeezy) — required before checkout
          </legend>
          <FormField
            label="Lemon Squeezy variant ID"
            name="providerPriceId"
            help="The numeric variant id from the Lemon Squeezy dashboard (Products » the book » its variant). Example: 1043277. Without it the book shows no buy button and checkout refuses it."
          />
        </fieldset>

        <div className="pt-2">
          <button
            type="submit"
            className="home-cta-primary inline-flex h-11 items-center justify-center rounded-full px-7 text-sm font-semibold tracking-tight"
          >
            Create book (draft)
          </button>
        </div>
      </form>
    </section>
  );
}

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
  help?: string;
}

function FormField({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  textarea,
  help,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-soft"
      >
        {label}
        {required && <span className="text-[#ff9b9b]"> *</span>}
      </label>
      {help && <p className="mt-1.5 text-xs text-fg-mid">{help}</p>}
      {textarea ? (
        <textarea
          id={name}
          name={name}
          required={required}
          defaultValue={defaultValue}
          rows={4}
          className="mt-2 block w-full rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-fg-hi placeholder:text-fg-fade focus-visible:border-emerald-bright/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/20"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          className="mt-2 block h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-fg-hi placeholder:text-fg-fade focus-visible:border-emerald-bright/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/20"
        />
      )}
    </div>
  );
}
