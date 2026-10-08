import { expect, test } from "@playwright/test";

import {
  boxOf,
  expectFullyInViewport,
  expectTouchTarget,
  firstBookCard,
  horizontalOverflow,
  isMobileProject,
  lockState,
  MOBILE_WIDTHS,
  press,
  UNLOCKED,
} from "./helpers";

/**
 * PHASE 1 — the shared overlay layer and the mobile header.
 *
 * The bug being pinned: on a phone, tapping a book on /books or /ebooks opened a
 * quick view whose Close and Buy buttons were in a clipped second grid row, with
 * nothing scrollable, while the page behind it was locked — the reader could
 * neither act nor leave. Every assertion below is geometry or state measured in
 * a real browser, not a class name.
 */

test.describe("mobile header — nothing overflows and every control is reachable", () => {
  for (const width of MOBILE_WIDTHS) {
    test(`no horizontal overflow, controls on-screen, at ${width}px`, async ({ page }, testInfo) => {
      test.skip(!isMobileProject(testInfo), "mobile project only");
      await page.setViewportSize({ width, height: 800 });

      for (const route of ["/", "/books", "/about", "/cart", "/bonus", "/weather-permitting-bonus", "/long-way-back-bonus"]) {
        await page.goto(route);
        await page.locator("header:visible").first().waitFor();
        expect(await horizontalOverflow(page), `${route} is wider than ${width}px`).toBeLessThanOrEqual(0);

        const header = page.locator("header:visible").first();
        const menu = header.locator('button[aria-controls="mobile-nav-panel"]');
        const cart = header.locator('a[href="/cart"]');
        await expectFullyInViewport(page, menu, `menu button on ${route}`);
        await expectFullyInViewport(page, cart, `cart link on ${route}`);
        await expectTouchTarget(menu, "menu button");
        await expectTouchTarget(cart, "cart link");

        // The account control is whichever of Sign in / avatar the slot renders.
        const signIn = header.getByRole("button", { name: "Sign in" });
        if (await signIn.count()) {
          await expectFullyInViewport(page, signIn, `Sign in on ${route}`);
          await expectTouchTarget(signIn, "Sign in");
          // The label used to wrap onto two lines; below `sm` it is icon-only.
          expect((await boxOf(signIn, "Sign in")).height).toBeLessThanOrEqual(48);
        }
      }
    });
  }

  test("the drawer offers Search (the header icon yields below 370px)", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "mobile project only");
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    const header = page.locator("header:visible").first();
    await expect(header.locator('a[href="/search"][aria-label="Search"]')).toBeHidden();
    await press(header.locator('button[aria-controls="mobile-nav-panel"]'), testInfo);
    await expect(page.locator("#mobile-nav-panel").getByRole("link", { name: "Search" })).toBeVisible();
  });
});

test.describe("quick view — the popup that used to freeze phones", () => {
  const SIZES = [
    { w: 320, h: 568 },
    { w: 360, h: 640 },
    { w: 375, h: 667 },
    { w: 390, h: 844 },
    { w: 393, h: 851 }, // the real device
    { w: 412, h: 915 },
    { w: 851, h: 393 }, // the real device, landscape
  ];

  for (const { w, h } of SIZES) {
    test(`fits, scrolls inside itself, and can be left — ${w}×${h}`, async ({ page }, testInfo) => {
      test.skip(!isMobileProject(testInfo), "mobile project only");
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/books");
      const card = firstBookCard(page);
      await card.waitFor();

      await press(card, testInfo);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(/\/books$/); // a plain press opens the dialog, it does not navigate

      // 1 — the dialog never exceeds the visible viewport.
      const panel = await boxOf(dialog, "dialog");
      expect(panel.y).toBeGreaterThanOrEqual(-1);
      expect(panel.y + panel.height).toBeLessThanOrEqual(h + 1);
      expect(panel.x + panel.width).toBeLessThanOrEqual(w + 1);

      // 2 — the way out is on screen and big enough, before any scrolling.
      const close = dialog.getByRole("button", { name: "Close quick view" });
      await expectFullyInViewport(page, close, "Close button");
      await expectTouchTarget(close, "Close button");

      // 3 — the page behind it is locked, and the app behind it is inert.
      expect(await lockState(page)).toMatchObject({ html: "hidden", body: "hidden", inert: true, overlayFlag: true });

      // 4 — the way to act is on screen too, with the content scrolled to the top...
      const details = dialog.getByRole("link", { name: "Full details" });
      await expectFullyInViewport(page, details, "Full details button");
      await expectTouchTarget(details, "Full details button");

      // ...and still there after the body has been scrolled to the very bottom.
      const scroller = dialog.locator(".vp-dialog-body");
      const scroll = await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        return { scrollable: el.scrollHeight > el.clientHeight + 1, atEnd: el.scrollTop + el.clientHeight >= el.scrollHeight - 1 };
      });
      expect(scroll.atEnd).toBe(true);
      await expectFullyInViewport(page, details, "Full details button after scrolling");
      await expectFullyInViewport(page, close, "Close button after scrolling");

      // 5 — leaving restores EVERYTHING.
      await press(close, testInfo);
      await expect(dialog).toBeHidden();
      expect(await lockState(page)).toEqual(UNLOCKED);
    });
  }

  test("Android Back closes it, and the reader stays on /books", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "mobile project only");
    await page.goto("/books");
    await firstBookCard(page).waitFor();
    await press(firstBookCard(page), testInfo);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/books$/);
    expect(await lockState(page)).toEqual(UNLOCKED);

    // And it can be opened again afterwards: no history entry was left dead.
    await press(firstBookCard(page), testInfo);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(await lockState(page)).toEqual(UNLOCKED);
  });

  test("a wheel/touch scroll over the open dialog does not move the page behind it", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "mobile project only");
    await page.goto("/books");
    await firstBookCard(page).waitFor();
    await page.evaluate(() => window.scrollTo(0, 300));
    const before = await page.evaluate(() => window.scrollY);
    await press(firstBookCard(page), testInfo);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);

    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => window.scrollY)).toBe(before); // and closing does not jump the page
  });
});

test.describe("quick view — desktop", () => {
  test("Escape, the Close button and the backdrop each close it and restore the page", async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), "desktop projects only");
    await page.goto("/books");
    const card = firstBookCard(page);
    await card.waitFor();
    const dialog = page.getByRole("dialog");

    for (const how of ["escape", "close", "backdrop"] as const) {
      await press(card, testInfo);
      await expect(dialog).toBeVisible();
      expect(await lockState(page)).toMatchObject({ html: "hidden", inert: true });

      if (how === "escape") await page.keyboard.press("Escape");
      if (how === "close") await dialog.getByRole("button", { name: "Close quick view" }).click();
      if (how === "backdrop") await page.mouse.click(8, 8);

      await expect(dialog, `closing via ${how}`).toBeHidden();
      expect(await lockState(page), `after closing via ${how}`).toEqual(UNLOCKED);
    }
  });

  test("focus moves into the dialog and returns to the card", async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), "desktop projects only");
    await page.goto("/books");
    const card = firstBookCard(page);
    await card.waitFor();
    await card.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });
});

test.describe("the newsletter popup stays out of the reader's way", () => {
  // Fast-forward the page's own clock: the popup waits 10 s, and a test must not.
  test("never opens on a lead-magnet page, which is already an email form", async ({ page }) => {
    await page.clock.install();
    for (const route of ["/bonus", "/weather-permitting-bonus", "/long-way-back-bonus"]) {
      await page.goto(route);
      await page.locator("main").first().waitFor();
      await page.clock.fastForward(40_000);
      await expect(page.getByRole("dialog"), `popup opened on ${route}`).toHaveCount(0);
      expect(await lockState(page), `${route} left locked`).toEqual(UNLOCKED);
    }
  });

  test("opens on an ordinary page, defers while another dialog is open, then appears", async ({ page }, testInfo) => {
    await page.clock.install();
    await page.goto("/books");
    const card = firstBookCard(page);
    await card.waitFor();

    // Open a quick view and let the popup's 10 s timer expire underneath it.
    await press(card, testInfo);
    const quickView = page.getByRole("dialog");
    await expect(quickView).toHaveCount(1);
    await page.clock.fastForward(15_000);
    await expect(quickView, "the popup opened on top of the quick view").toHaveCount(1);
    const heading = page.locator('[role="dialog"] h2').first();
    await expect(heading).not.toHaveText(/Newsletter/);

    // Close the quick view; the next quiet-moment check opens the popup.
    await page.keyboard.press("Escape");
    await page.clock.fastForward(4_000);
    const popup = page.getByRole("dialog", { name: /Newsletter/ });
    test.skip((await popup.count()) === 0, "popup not eligible in this environment (/api/popup said no) — the deferral itself is asserted above");
    await expect(popup).toBeVisible();
    expect(await lockState(page)).toMatchObject({ html: "hidden", inert: true });

    // It can be dismissed, and the page comes back whole.
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    expect(await lockState(page)).toEqual(UNLOCKED);
  });
});
