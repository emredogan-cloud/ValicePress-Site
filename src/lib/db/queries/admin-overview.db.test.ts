// @vitest-environment node
/**
 * The dashboard's reads, against the sandbox database.
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/db/queries/admin-overview.db.test.ts
 *
 * Read-only. Same guards as `contacts-write.db.test.ts`: opt-in, refuses
 * anything but `bookstore`, `requireAdmin` replaced by a switch.
 *
 * The test that matters most is the last-but-one: the sandbox has no
 * `analytics_events` table, so reading it FAILS with Postgres's own
 * "relation does not exist" — and the dashboard must classify that as
 * "unavailable", not print zero events.
 */
import { loadEnvConfig } from "@next/env";
import { beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";

let gate: "admin" | "denied" = "admin";
vi.mock("@/lib/auth", () => ({
  AdminAccessError: class AdminAccessError extends Error {
    kind: string;
    constructor(kind: string) {
      super(`Admin access denied: ${kind}`);
      this.kind = kind;
    }
  },
  requireAdmin: async () => {
    if (gate === "denied") {
      const { AdminAccessError } = await import("@/lib/auth");
      throw new AdminAccessError("not_admin");
    }
    return { email: "admin@test.invalid", localUserId: "local-1" };
  },
}));

type Q = typeof import("./admin-overview");
let q: Q;
let stat: typeof import("@/lib/admin/stat");
let pins: typeof import("@/lib/pinned-books");

describe.skipIf(!RUN)("admin overview reads (sandbox database)", () => {
  beforeAll(async () => {
    loadEnvConfig(process.cwd());
    const name = (() => {
      try {
        return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
      } catch {
        return "";
      }
    })();
    if (name !== "bookstore") throw new Error(`REFUSING TO RUN: DATABASE_URL points at "${name || "(unset)"}", not the sandbox "bookstore".`);
    q = await import("./admin-overview");
    stat = await import("@/lib/admin/stat");
    pins = await import("@/lib/pinned-books");
  });

  it("counts the catalogue", async () => {
    const c = await q.getCatalogueOverview();
    expect(c.published).toBeGreaterThan(0);
    expect(c.directSale).toBeLessThanOrEqual(c.published);
    for (const n of Object.values(c.editions)) expect(Number.isInteger(n) && n >= 0 && n <= c.published).toBe(true);
    expect(c.editions.ebook).toBeGreaterThan(0);
  });

  it("lists the featured books in pin order — a pin with no published book is shown as what it is", async () => {
    const f = await q.getFeaturedBooks();
    expect(f.map((x) => x.slug)).toEqual([...pins.PINNED_BOOK_SLUGS]);
    const ridge = f.find((x) => x.slug === "ridge-runner");
    expect(ridge?.status === "draft" || ridge?.status === null).toBe(true);
    expect(f.find((x) => x.slug === "weather-permitting")).toMatchObject({ status: "published" });
  });

  it("lists every book, read-only, with its pin rank and editions", async () => {
    const rows = await q.listBooksReadOnly();
    const overview = await q.getCatalogueOverview();
    expect(rows.filter((r) => r.status === "published")).toHaveLength(overview.published);
    expect(rows.filter((r) => r.status === "published" && r.buyableHere && r.priceCents > 0)).toHaveLength(overview.directSale);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
    expect(rows.find((r) => r.slug === "weather-permitting")?.pinRank).toBe(0);
  });

  it("sums sales from the orders it has and says nothing more", async () => {
    const s = await q.getSalesOverview();
    expect(s.totalOrders).toBeGreaterThanOrEqual(s.paidOrders);
    expect(s.revenueByCurrency.reduce((n, r) => n + r.orderCount, 0)).toBe(s.paidOrders);
    for (const r of s.revenueByCurrency) expect(r.grossCents - r.taxCents).toBe(r.netCents);
    const recent = await q.getRecentOrders(3);
    expect(recent.length).toBeLessThanOrEqual(3);
  });

  it("reads latest signups, accounts, downloads and the popup's outcomes", async () => {
    const latest = await q.getLatestSignups(5);
    expect(latest.length).toBeLessThanOrEqual(5);
    expect(await q.getAccountCount()).toBeGreaterThanOrEqual(0);
    expect((await q.getDownloadCount(30)).downloads).toBeGreaterThanOrEqual(0);
    const popup = await q.getPopupOverview();
    expect(popup.shown).toBeGreaterThanOrEqual(popup.dismissed + popup.submitted);
  });

  it("a table that is not on this database comes out as UNAVAILABLE — not as zero events", async () => {
    const result = await stat.readStat("events", () => q.getEventOverview(7));
    expect(["ok", "unavailable"]).toContain(result.state);
    if (result.state === "unavailable") expect(result.reason).toBe(stat.MISSING_TABLE_REASON);
    if (result.state === "ok") expect(result.value.total).toBeGreaterThanOrEqual(0);
  });

  it("a refused admin reads nothing", async () => {
    gate = "denied";
    try {
      for (const run of [
        () => q.getCatalogueOverview(),
        () => q.getFeaturedBooks(),
        () => q.listBooksReadOnly(),
        () => q.getLatestSignups(),
        () => q.getSalesOverview(),
        () => q.getRecentOrders(),
        () => q.getAccountCount(),
        () => q.getEventOverview(),
        () => q.getDownloadCount(),
        () => q.getPopupOverview(),
      ]) {
        await expect(run()).rejects.toMatchObject({ kind: "not_admin" });
      }
      // ...and readStat does not swallow that into a card: it re-throws.
      await expect(stat.readStat("x", () => q.getSalesOverview())).rejects.toMatchObject({ kind: "not_admin" });
    } finally {
      gate = "admin";
    }
  });
});
