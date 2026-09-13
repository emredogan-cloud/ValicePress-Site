/**
 * Canonical route list for the mobile QA harness.
 *
 * `device: true`  — measurable on the physical Redmi without auth or a live ID.
 * `device: false` — source-only at audit time (auth-gated, or needs a real ID).
 *                   Phase 9 re-attempts these; see MOBILE_CURRENT_STATE_AUDIT.md §5.
 *
 * `minNodes` is a render-failure floor, not a target. A route that renders
 * fewer DOM nodes than this did not actually render — see device.mjs
 * `assertRendered`. Floors are set well below observed values so normal
 * content changes never trip them.
 */
export const ROUTES = [
  { path: "/",                                    name: "home",             device: true,  minNodes: 200 },
  { path: "/books",                               name: "catalog",          device: true,  minNodes: 200 },
  { path: "/ebooks",                              name: "ebooks",           device: true,  minNodes: 150 },
  { path: "/books/meditations",                   name: "book-detail",      device: true,  minNodes: 200 },
  { path: "/books/the-great-book-of-world-games", name: "book-detail-2",    device: true,  minNodes: 200 },
  { path: "/books/codex-enigmatica",              name: "book-detail-3",    device: true,  minNodes: 200 },
  { path: "/categories",                          name: "categories",       device: true,  minNodes: 200 },
  { path: "/categories/games-and-play",           name: "category-detail",  device: true,  minNodes: 120 },
  { path: "/categories/classics-and-philosophy",  name: "category-detail-2",device: true,  minNodes: 120 },
  { path: "/authors",                             name: "authors",          device: true,  minNodes: 120 },
  { path: "/authors/marcus-aurelius",             name: "author-detail",    device: true,  minNodes: 100 },
  { path: "/authors/emre-dogan",                  name: "author-detail-2",  device: true,  minNodes: 100 },
  { path: "/blog",                                name: "blog",             device: true,  minNodes: 150 },
  { path: "/blog/hangul-stroke-order",            name: "blog-article",     device: true,  minNodes: 150 },
  { path: "/blog/why-we-built-valice-press",      name: "blog-article-2",   device: true,  minNodes: 150 },
  { path: "/blog/category/reading-guides",        name: "blog-category",    device: true,  minNodes: 100 },
  { path: "/search",                              name: "search",           device: true,  minNodes: 150 },
  { path: "/search?q=games",                      name: "search-results",   device: true,  minNodes: 120 },
  { path: "/cart",                                name: "cart",             device: true,  minNodes: 120 },
  /* Companion routes. Eight of twenty-nine, chosen to cover the shapes the
     canonical template has to survive rather than to be a sample: two, three,
     four and five resources (an odd count promotes the last card to full
     width), a title with an ampersand and one with an apostrophe, the one
     companion whose interactive answer-checker sits between the grid and the
     email card, and the one whose book has no cover asset at all and must
     fall back to the typographic stand-in. */
  { path: "/companion/world-games",               name: "companion",        device: true,  minNodes: 100 },
  { path: "/companion/hangul",                    name: "companion-hangul", device: true,  minNodes: 100 },
  { path: "/companion/world-myths",               name: "companion-myths",  device: true,  minNodes: 100 },
  { path: "/companion/codex-bestiarium",          name: "companion-bestiary",device: true, minNodes: 100 },
  { path: "/companion/kwaidan",                   name: "companion-kwaidan",device: true,  minNodes: 100 },
  { path: "/companion/play-anywhere",             name: "companion-pencil", device: true,  minNodes: 100 },
  { path: "/companion/dudeney",                   name: "companion-dudeney",device: true,  minNodes: 100 },
  { path: "/companion/codex-puzzles",             name: "companion-puzzles",device: true,  minNodes: 100 },
  { path: "/companion/etymon",                    name: "companion-etymon", device: true,  minNodes: 100 },
  { path: "/about",                               name: "about",            device: true,  minNodes: 150 },
  { path: "/account/library",                     name: "library",          device: true,  minNodes: 100 },
  { path: "/account/orders",                      name: "orders",           device: true,  minNodes: 100 },
  { path: "/account/settings",                    name: "settings",         device: true,  minNodes: 100 },
  { path: "/terms",                               name: "legal-terms",      device: true,  minNodes: 100 },
  { path: "/privacy",                             name: "legal-privacy",    device: true,  minNodes: 100 },
  { path: "/refund",                              name: "legal-refund",     device: true,  minNodes: 100 },
  { path: "/kvkk",                                name: "legal-kvkk",       device: true,  minNodes: 100 },
  { path: "/unsubscribe",                         name: "legal-unsub",      device: true,  minNodes: 100 },

  // Source-only at audit time. Phase 9 re-attempts each and records the outcome.
  /* Phase 6 re-attempted every source-only route on the device. These two
     render fully without auth and are now measured every phase. */
  { path: "/codex-enigmatica/verify",             name: "codex-verify",     device: true,  minNodes: 150 },
  { path: "/blog/tag/reading-habits",             name: "blog-tag",         device: true,  minNodes: 150 },
  /* These four answer HTTP 200 on the device but render UnprovisionedNotice:
     Clerk and the database are not configured in this environment, so the real
     admin / order / reader UI cannot be exercised here. Verified on device in
     Phase 6 — the shell renders, no overflow, the mobile menu is present. */
  { path: "/admin",                               name: "admin",            device: false, minNodes: 50 },
  { path: "/order/1",                             name: "order-detail",     device: false, minNodes: 50 },
  { path: "/read/meditations",                    name: "reader",           device: false, minNodes: 50 },
];

/** The 9 routes the desktop regression gate diffs on every phase. */
export const DESKTOP_BASELINE = [
  "/", "/books", "/ebooks", "/categories", "/authors",
  "/blog", "/books/meditations", "/cart", "/account/library",
];

/** Widths swept in Phase 9 (and available to any phase via --widths). */
export const WIDTH_MATRIX = [320, 360, 392, 430, 600, 768, 1024];

export const deviceRoutes = () => ROUTES.filter((r) => r.device);
export const byName = (n) => ROUTES.find((r) => r.name === n);
