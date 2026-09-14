# The reference reader, read closely

**What this is.** A working audit of the Mendîran Vakayinâmesi web book, done on
2026-09-14 against both the live deployment and the source in
`~/Downloads/MY-DİGİTAL-BOOK/BACKUP/mendiran-vakayinamesi`. It exists to answer
one question — *what makes that thing feel like a book?* — in enough detail
that the answer can be rebuilt rather than copied.

**What it is not.** A specification for cloning it. Mendîran is a Turkish dark
fantasy codex with its own identity: gold leaf on black, a seven-pointed sigil,
Fraktur display type, ambient ash drifting across the stage. None of that
belongs to Valice Press and none of it was taken. What was taken is mechanism.

---

## 1. What the reference actually is

A **single static HTML page**, 301 lines, with no build step and no framework:

| | |
|---|---|
| Entry | `index.html` |
| Styles | `themes.css`, `main.css` (57 KB), `animations.css`, `cover.css` |
| Engine | `book.js` (34 KB) — pagination + spread model + turn |
| Orchestration | `app.js` (28 KB) — input, drawers, chrome, fullscreen |
| Content | eleven `data-*.js` files (≈380 KB) + `content-adapter.js` |
| Persistence | `storage.js` — `localStorage`, 3 KB |
| Assets | one cover, `.jpg` + `.webp` |

The whole book ships to the browser on first load. That is viable for a
38,000-word novel with one image. It is not viable for a 435-page illustrated
bestiary, and that difference drives most of the divergence in section 8.

Measured on the live deployment:

| Property | Value |
|---|---|
| Page-turn duration | `900ms` |
| Page-turn easing | `cubic-bezier(0.6, 0.05, 0.3, 1)` |
| Stage perspective | `2400px` |
| Cover-gate perspective | `2000px` |
| Book aspect (desktop) | `1100 / 720` |
| Book aspect (≤760px) | `9 / 14` |
| Spreads in the live build | 15 |
| Perf mode chosen on a desktop | `rich` |

---

## 2. Opening the book

The single most important interaction, and the one most readers will remember.

The page does **not** open into the reader. It opens into a **closed volume**
(`#cover-gate`), and the codex is built behind it, invisibly, while the reader
looks at a book. Four layered elements make a flat cover image into an object:

```
.book3d__inside    the page block — stacked box-shadows fake individual leaves
.book3d__page      the flyleaf, hinged at left, turns on a delay
.book3d__leaf      the front cover, hinged at left, carries the cover image
.book3d__ribbon    a silk marker hanging past the foot of the block
.book3d__peel      a curled corner, bottom right
```

The thickness is the detail worth stealing. It is not an image — it is a
stack of offset box-shadows on one element:

```css
box-shadow:
  3px 0 0 -1px #cdc1a4,  6px 0 0 -1px #c0b395,
  9px 0 0 -1px #b3a687, 12px 0 0 -1px #a69979,
  14px 2px 0 -2px #8f8264,
  0 30px 55px -18px rgba(0,0,0,.78);
```

Five hairlines of descending value, plus one large soft ground shadow. Cheap,
and it reads as a physical text block at any size.

**The opening sequence is staged, not simultaneous:**

| t | what moves |
|---|---|
| 0ms | cover begins `rotateY(0 → -84deg)`, 820ms |
| 200ms | light begins bleeding in from the spine (`opacity 0 → .9`, 760ms) |
| 300ms | flyleaf begins `rotateY(0 → -76deg)`, 720ms |
| 660ms | the gate itself begins to fade |

The flyleaf lags the cover, and the gate fades **last**. Reversing that order —
clearing the gate first — is what makes a cover animation read as a loading
screen being dismissed rather than a book being opened.

**The invitation is wordless.** A small open-book glyph below the volume, no
copy. The same five books in that series share it.

---

## 3. The page turn

`BookEngine._turn(direction)` in `book.js:703`. The mechanism in full:

1. Guard on `isAnimating`; refuse re-entry.
2. If `prefers-reduced-motion`, write the new spread and return. **No
   animation at all** — not a faster one.
3. Pick the source leaf: the right leaf going forward, the left coming back.
4. Create a `<div class="page page--right page--turning">` and copy the source
   leaf's `innerHTML` into it. Set `will-change: transform, opacity`.
5. Append the clone, then **write the new spread into the real leaves
   underneath it**.
6. Wait two `requestAnimationFrame`s.
7. Add the trigger class. CSS does the rest.
8. Await `transitionend`, with a 1300ms `setTimeout` fallback.
9. Remove the clone, clear `will-change`, clear `isAnimating`.

The CSS is four rules:

```css
[data-perf="rich"] .page--right.page--turning { transform-origin: left center; }
[data-perf="rich"] .page--right.page--turning.page--turn-forward  { transform: rotateY(-180deg); }
[data-perf="rich"] .page--left.page--turning.page--turn-backward  { transform: rotateY( 180deg); }
```

**The trick that makes it work with one face.** `.page` carries
`backface-visibility: hidden`. Past 90° the turning leaf's back faces the
reader and simply stops being drawn — revealing the page already written
underneath. No second face, no flipped duplicate content, no z-index dance.

**The curl** is a left-to-right dark gradient over the whole leaf at
`opacity: 0`, transitioned to `1` over 45% of the turn. It is the shadow a
lifted page casts across itself. Animating opacity rather than the gradient
keeps it on the compositor.

**A multi-spread jump does not animate.** `goToSpread` turns only when the
distance is exactly one; anything further is a short opacity dip and a write.
Nobody flips eighty leaves to reach a chapter.

---

## 4. The two-tier motion budget

The most transferable idea in the whole reference, and it runs **before first
paint** — an inline script in `<head>` that sets `document.documentElement.dataset.perf`:

```js
mode = (cores <= 4 || mem <= 4 || (coarse && smallish) || reduce) ? 'lite' : 'rich';
```

In `lite`: no `feTurbulence`, no ambient drift, no `backdrop-filter`, and the
page turn becomes a 405ms opacity-and-translate crossfade instead of a 3D flip.

The reasoning is sound and worth restating: a `rotateY` across a half-screen
layer is a compositor job, but on a four-core phone it is a compositor job that
drops frames — and a stuttering 3D flip reads as cheapness, where a fast
crossfade reads as intent.

Setting it before first paint matters: chosen later, the first frame renders
with the wrong palette and animation set.

---

## 5. Interior and typography

- Four families: Cinzel (display), Cormorant Garamond, EB Garamond (body),
  UnifrakturMaguntia (title only). Loaded with `display=swap` and preconnect.
- Body text at **16px** inside the leaf, with a five-step user size control.
- Paper is not flat. Three stacked layers: a base colour, two soft radial
  blooms (`::before`), and a fine 45°/-45° repeating-linear-gradient tooth
  (`::after`). At about 1.8% opacity it reads as laid paper, not as texture.
- The gutter is a 32px absolutely-positioned gradient at `left: 50%`,
  `z-index: 50`, dark at the centre and transparent at both edges.
- Each leaf carries an inner shadow along its spine edge only.
- A folio and a `.page__curl` are appended to every leaf, always.

**Pagination.** The reference measures: it fills a hidden frame and binary-
searches the break point, with orphan/widow control. Chapter openings are
in-flow elements, not forced page breaks — an earlier version forced each
chapter onto a recto and produced sixteen half-empty pages.

This is exactly the part Valice does **not** need, because Valice's books are
already typeset. See section 8.

---

## 6. The controls

Top bar: contents, bookmark, bookmarks list, theme, type size, perf mode,
fullscreen, ambient sound, showcase mode, PDF export. **Ten buttons.**

Bottom bar: previous, chapter label, progress bar, folio range, next.

Off-canvas: a contents drawer (left) with section filters and a live search, a
bookmarks drawer (right).

Keyboard: `← →` turn, `PageUp/Down` and `Space` turn, `Home/End` jump, then
single letters — `T` contents, `B` bookmark, `M` bookmarks, `F` fullscreen,
`V` theme, `A` type size, `P` print, `X` perf, `S` sound, `W` showcase,
`Esc` closes.

Touch: a swipe on the stage, `>60px` horizontal and `>1.4×` the vertical
component.

Pointer: a 14%-wide invisible zone down each edge of the book, with an arrow
that fades in on hover and scales 1.3×.

**Judgement.** The edge zones, the drawers, the keyboard map and the swipe
threshold are all worth taking. Ten buttons in the top bar is not — ambient
sound, showcase mode and a PDF export belong to a promotional artefact, not to
a purchased edition. Section 21 of the directive says *do not overload the
interface*, and the reference is the cautionary example.

---

## 7. Persistence

`localStorage`, five keys under one `mendiran-vakayinamesi:v1:` namespace:
reading position (by spread index), bookmarks, theme, type size, first-seen.
Every read and write is wrapped in try/catch with a fallback.

The namespacing and the defensive wrapping are right. **Storing a purchased
book's reading position in `localStorage` is not** — see section 8.

---

## 8. What Valice must do differently, and why

| | Reference | Valice Press |
|---|---|---|
| **Content** | JS data files, paginated at runtime | Typeset PDF, already paginated |
| **Delivery** | Whole book on first load | HTTP ranges, per page, on demand |
| **Access** | Public | Session + entitlement, checked per request |
| **Progress** | `localStorage`, per browser | Postgres, per `(user, book)` |
| **Bookmarks** | `localStorage` | Postgres, per `(user, book, page)` |
| **Scale** | One book, one codebase | One engine, 27 books |
| **Identity** | Gold on black, sigil, Fraktur | Emerald void, the storefront's tokens |

Four of those deserve the argument spelled out.

**Pagination is not our problem, and that is a gift.** Mendîran's hardest code
is its measure-and-break loop. Valice's books arrive from a typesetting
pipeline with page boundaries already decided by a compositor. The reader does
not get to choose where a page ends — and *must not*, because a customer
comparing the web reader against their paperback has to find the same words on
page 214. What the reference does with a binary search, Valice does with
`buildSpreads(pageCount)`.

**The recto rule.** Page 1 of a printed book is a right-hand page. Valice's
spread model therefore opens `[null, 1]`, then `[2,3]`, `[4,5]`. Pairing
`(1,2)` would look wrong to anyone who has held a book and would put every
later opening out of phase with the printed edition.

**Persistence must be server-side.** A bookmark that lives in one browser is
lost when the customer opens the book on their phone. The reference is a free
public artefact where that is an acceptable trade; a purchased edition where
the buyer marked a page and lost it is a support ticket.

**The whole book must never be in the browser.** Not only because a 435-page
book is 109 MB, but because "the entire purchased file now sits in this tab"
is the thing the access controls exist to prevent.

---

## 9. Taken, adapted, declined

**Taken outright**
- Perspective on the stage, never on the book.
- Clone the outgoing leaf, animate the clone, write the new spread beneath it.
- `backface-visibility: hidden` instead of a second face.
- Curl as an opacity-only gradient.
- `will-change` applied for the turn's duration and removed after.
- Two-tier motion budget from device hints, with `prefers-reduced-motion`
  overriding hardware.
- Staged cover opening: cover, then flyleaf, then light, then the gate clears.
- Page-block thickness as stacked box-shadows.
- Gutter as a centred gradient above the leaves.
- Edge zones with hover-revealed arrows.
- Swipe threshold with a vertical-dominance guard.
- `transitionend` with a timeout fallback.
- Multi-spread jumps cut rather than turn.

**Adapted**
- Turn duration 900ms → **760ms**. Mendîran is read a spread at a time with
  long pauses. These are reference works someone pages through hunting an
  entry, and a turn you wait for stops being atmosphere.
- Contents drawer: kept, but populated from the **PDF's own outline** rather
  than a hand-authored structure.
- Themes: kept, but as a filter on the page canvas (`paper`/`sepia`/`night`),
  since a PDF page cannot be recoloured by CSS variables.
- Progress and bookmarks: same UX, moved to the database.

**Declined**
- Ambient sound, showcase mode, PDF export, ambient ash and nebula layers.
- The whole pagination engine.
- `localStorage` for anything but presentation preference.
- Ten buttons in the top bar.
- Every element of the visual identity.

---

## 10. Two defects worth recording

Both found while auditing, both instructive.

**The live cover flashes as an empty block.** The `<img>` inside
`.book3d__leaf` has no reserved aspect ratio in the layout, so for the first
few hundred milliseconds the volume renders as a bare cream page block with a
ribbon across it. The image loads fine (`naturalWidth: 1024`). Valice's volume
sets explicit `width`/`height` on the cover image and constrains it with
`max-block-size`/`max-inline-size`, so the leaf reserves its box before the
bytes arrive.

**Fifteen spreads.** The live build reports `page-total: 15` and the folio
reads `—`, which for a 22-chapter, 38,000-word novel means the content adapter
is not producing the book the data files describe. Not Valice's problem, but a
reminder of what the directive's §51 is for: the reader can be perfect and
still be showing the wrong book, and only a per-title check catches it.

---

## 11. Sources

- `https://mendiran-vakayinamesi.vercel.app/` — inspected 2026-09-14;
  computed styles and runtime state read from the live page.
- `~/Downloads/MY-DİGİTAL-BOOK/BACKUP/mendiran-vakayinamesi` — commit as
  vendored; `index.html`, `styles/*.css`, `scripts/{book,app,storage}.js`
  read in full.

Line references are to that working copy.
