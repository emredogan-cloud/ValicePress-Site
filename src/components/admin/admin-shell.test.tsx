import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { unavailable, type Stat } from "@/lib/admin/stat";

import { AdminBlocked } from "./admin-blocked";
import { ADMIN_TABS, AdminNav, isActiveTab } from "./admin-nav";
import { StatCard } from "./stat-card";

let pathname = "/admin";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => {
    void prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

afterEach(cleanup);

describe("the three states of a dashboard figure", () => {
  const render3 = (stat: Stat<number>) => render(<StatCard label="Orders" stat={stat} value={(n) => n.toLocaleString("en-US")} sub={() => "paid"} />);

  it("a figure that was read is shown — ZERO included", () => {
    const { container } = render3({ state: "ok", value: 0 });
    expect(container.querySelector("[data-stat='Orders']")?.getAttribute("data-state")).toBe("ok");
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("paid")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a missing source is 'Unavailable', in the reason's words — not a number", () => {
    const { container } = render3(unavailable("Sales data unavailable — no connected sales source"));
    expect(container.querySelector("[data-stat='Orders']")?.getAttribute("data-state")).toBe("unavailable");
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("Sales data unavailable — no connected sales source")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("a failed read is an announced ERROR, visibly different from 'unavailable' — and shows no number", () => {
    const { container } = render3({ state: "error", message: "Could not be read just now. The details are in the server log." });
    expect(container.querySelector("[data-stat='Orders']")?.getAttribute("data-state")).toBe("error");
    expect(screen.getByRole("alert").textContent).toBe("Couldn’t load");
    expect(screen.getByText(/Could not be read just now/)).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("a hint is always shown, whatever the state", () => {
    render(<StatCard label="Mailable" stat={{ state: "error", message: "x" }} value={(n: number) => n} hint="Opted in, not suppressed" />);
    expect(screen.getByText("Opted in, not suppressed")).toBeTruthy();
  });
});

describe("AdminBlocked", () => {
  it("says what it was given and nothing more", () => {
    render(<AdminBlocked ctx={{ ok: false, title: "Not authorized", body: "This area is for the site's administrators.", missing: [] }} />);
    expect(screen.getByRole("heading", { name: "Not authorized" })).toBeTruthy();
    expect(screen.getByText("This area is for the site's administrators.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("lists missing variables only when it is given some (never on production)", () => {
    render(<AdminBlocked ctx={{ ok: false, title: "Admin is not available", body: "…", missing: ["DATABASE_URL"] }} />);
    expect(screen.getByText("DATABASE_URL")).toBeTruthy();
  });
});

describe("the admin navigation", () => {
  it("has the six places, in order", () => {
    expect(ADMIN_TABS.map((t) => t.label)).toEqual(["Overview", "Books", "Email", "Free books", "Reader support", "Site data"]);
  });

  it("Overview is current only on /admin itself; the others are current on their sub-pages", () => {
    const overview = ADMIN_TABS[0];
    const email = ADMIN_TABS.find((t) => t.label === "Email")!;
    expect(isActiveTab("/admin", overview)).toBe(true);
    expect(isActiveTab("/admin/", overview)).toBe(true);
    expect(isActiveTab("/admin/email", overview)).toBe(false);
    expect(isActiveTab("/admin/email", email)).toBe(true);
    expect(isActiveTab("/admin/email/7a5d9f85", email)).toBe(true);
    expect(isActiveTab("/admin/emailing", email)).toBe(false); // a prefix is not a path
    expect(isActiveTab("/admin/books", email)).toBe(false);
  });

  it("marks exactly one tab as the current page, with aria-current", () => {
    pathname = "/admin/free-books";
    render(<AdminNav />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["Free books"]);
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeTruthy();
  });
});
