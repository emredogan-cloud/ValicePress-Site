import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileNav } from "./mobile-nav";

/**
 * The drawer's accessibility contract, on the one thing a unit test can see: where focus is.
 *
 * On the phone the earlier mobile program asserted, on every route, that opening the drawer MOVES FOCUS INTO IT
 * ("focus moved into panel") and that closing it gives focus back to the hamburger. When the drawer moved onto the
 * shared overlay hook the first half silently stopped being true: the hook focuses the panel, and a <div> ignores
 * `.focus()` without a tabindex, so keyboard and screen-reader users were left on the page behind the dialog.
 * The device suite caught it; this keeps it caught where it is cheap.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => {
    void prefetch; // a router option, not an attribute: keep it off the <a>
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

const ITEMS = [
  { key: "books", label: "All books", href: "/books" },
  { key: "authors", label: "Authors", href: "/authors" },
] as const;

afterEach(() => cleanup());

describe("<MobileNav> — the drawer", () => {
  it("moves focus into the panel on open, and gives it back to the menu button on close", () => {
    render(<MobileNav items={ITEMS as never} />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(trigger);
    const panel = screen.getByRole("dialog");
    expect(document.activeElement, "focus is inside the dialog").toBe(panel);

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement, "focus is back on the hamburger").toBe(trigger);
  });

  it("is a labelled modal dialog that the hamburger controls", () => {
    render(<MobileNav items={ITEMS as never} />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    const panel = screen.getByRole("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { name: "Browse" })).toBeTruthy();
  });

  it("offers the press's four networks as rows a thumb can hit (48px)", () => {
    render(<MobileNav items={ITEMS as never} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const social = screen.getAllByRole("link", { name: /Valice Press on/ });
    expect(social).toHaveLength(4);
    for (const a of social) expect(a.className, a.getAttribute("aria-label") ?? "").toMatch(/\bh-12\b.*\bw-12\b/);
  });
});
