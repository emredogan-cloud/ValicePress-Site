import { describe, expect, it } from "vitest";

import { byNewest } from "./shelf-order";

const b = (slug: string, iso: string | null) => ({ slug, publishedAt: iso ? new Date(iso) : null });
const order = (rows: ReturnType<typeof b>[]) => [...rows].sort(byNewest).map((r) => r.slug);

describe("byNewest", () => {
  it("puts the newest first", () => {
    expect(order([b("old", "2026-08-01"), b("new", "2026-10-01"), b("mid", "2026-09-01")])).toEqual(["new", "mid", "old"]);
  });

  // Postgres sorts NULLs FIRST on a descending key; this is the order the SQL
  // `desc nulls last` and every JS-sorted shelf must agree on.
  it("puts undated books LAST, never first", () => {
    expect(order([b("undated", null), b("dated", "2026-09-01")])).toEqual(["dated", "undated"]);
  });

  it("breaks ties by slug, so the order is the same in every database and after every reseed", () => {
    expect(order([b("zebra", "2026-09-08"), b("apple", "2026-09-08"), b("mango", "2026-09-08")])).toEqual(["apple", "mango", "zebra"]);
    expect(order([b("zebra", null), b("apple", null)])).toEqual(["apple", "zebra"]);
  });

  it("is a total order: the result does not depend on the input order", () => {
    const rows = [b("c", "2026-09-08"), b("a", "2026-09-08"), b("e", null), b("d", "2026-10-01"), b("b", null)];
    const expected = order(rows);
    for (let i = 0; i < 20; i++) {
      const shuffled = [...rows].sort(() => Math.random() - 0.5);
      expect(order(shuffled)).toEqual(expected);
    }
  });
});
