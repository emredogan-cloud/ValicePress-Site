# Operator handbook — the 29 Lemon Squeezy product images

**Status: BLOCKED, with evidence. The assets are built, verified and mapped;
the upload is a hand action.** Fifteen minutes of dragging.

**Date:** 2026-09-20 · **Target platform:** Lemon Squeezy dashboard,
store `473583` (Valice Press) · **Assets:**
`public/images/commerce/lemonsqueezy/<slug>.jpg`, 29 files, 1600 × 1200

---

## Why this is a hand action and not an automated one

Two measured blockers, in the order they were hit.

**1. The dashboard session is gone.** `app.lemonsqueezy.com` now redirects to
`auth.lemonsqueezy.com/login` and asks for an email and password. Entering a
password is something this agent will not do, under any authorization — that
is an account-holder credential, not a routine operation.

**2. Even signed in, the media dropzone resists automation.** Measured
2026-09-19 while the session was alive. The Media control is a Vue component
whose handler is bound in JavaScript, and it ignores every programmatic route
into it:

| Attempt | Result |
|---|---|
| Set `input.files` via the browser's file-upload bridge | File lands on the element; component never reacts |
| Dispatch a synthetic `change` event (bubbling) | No reaction |
| Dispatch a synthetic `DragEvent` `drop` carrying a real `File` | No reaction |

The product record confirms the consequence from the **buyer's** side, which
is the side that matters — read today from the live checkout page with no
login at all:

```
/checkout/buy/37c68bb3-…  → product 1373111 "Valice Press — Puzzles Old and New"
                             status "published", test_mode false, thumb_url NULL
/checkout/buy/3e2c79b8-…  → product 1373115 "Valice Press — Words from the Gods"
                             status "published", test_mode false, thumb_url NULL
```

`thumb_url: null` is the gap this handbook closes. It is not a cosmetic one:
that image is what a buyer sees at checkout, in the receipt email, and in any
social unfurl of a checkout link.

---

## What is already done

- **29 images built and committed.** `scripts/commerce/build-product-images.mjs`
  composes each book's own cover onto a 1600 × 1200 plinth — the ratio Lemon
  Squeezy's own uploader asks for — without cropping, stretching or
  recolouring the artwork. Deep evergreen ground, a gold hairline so a dark
  cover still has an edge against a dark ground, a contact shadow, the imprint
  line.
- **Mapping verified.** Every one of the 29 rows below was cross-checked:
  the catalogue's `providerPriceId` agrees with the variant id recorded in
  `LEMON-SQUEEZY-PRODUCT-MASTER.md` on **29 of 29** rows, zero disagreements.
- **No cross-product assignment is possible if the table is followed**: the
  file is named for the book's slug, and the slug is the catalogue's key.

---

## The steps

For each row below:

1. Open `https://app.lemonsqueezy.com/products/<LS product>`.
2. Scroll to **Media** ("Drop your images here, or click to browse ·
   1600 × 1200 (4:3) recommended, up to 10MB each").
3. Drag in `public/images/commerce/lemonsqueezy/<file>` — or click to browse
   and pick it.
4. Wait for the thumbnail to appear in the Media strip.
5. **Save changes.**

---

## Verification — do not skip this

An upload is not verified by the dashboard showing a thumbnail. Check it the
way a customer would, with no login:

```bash
# Replace with the product's own Share/checkout link from the dashboard
curl -sL "https://valicepress.lemonsqueezy.com/checkout/buy/<uuid>" \
  | grep -o '"thumb_url":"[^"]*"' | head -1
```

`thumb_url` must now be a URL rather than `null`. Do that for a sample of
three; if those three are right, the mechanism is right.

---

## The 29

| # | Book | LS product | Variant | Image to drag in | KB |
|---:|---|---:|---:|---|---:|
| 1 | Meditations | 1370807 | 2142140 | `meditations.jpg` | 169 |
| 2 | Codex Bestiarium | 1370817 | 2142153 | `codex-bestiarium.jpg` | 254 |
| 3 | The Great Book of World Myths | 1370818 | 2142154 | `the-great-book-of-world-myths.jpg` | 290 |
| 4 | The Great Book of World Games | 1370820 | 2142158 | `the-great-book-of-world-games.jpg` | 285 |
| 5 | The Greek Alphabet Handwriting Workbook | 1370826 | 2142168 | `greek-alphabet-handwriting-workbook.jpg` | 257 |
| 6 | Codex Mythologica: The Puzzle Book | 1370830 | 2142177 | `codex-mythologica-the-puzzle-book.jpg` | 308 |
| 7 | The Puzzles of Henry Dudeney | 1370831 | 2142181 | `the-puzzles-of-henry-dudeney.jpg` | 227 |
| 8 | Epictetus: The Discourses and Enchiridion | 1370832 | 2142183 | `epictetus-discourses-and-enchiridion.jpg` | 225 |
| 9 | Seneca: Selected Dialogues | 1370836 | 2142187 | `seneca-selected-dialogues.jpg` | 263 |
| 10 | Myths and Legends of China | 1370838 | 2142190 | `myths-and-legends-of-china.jpg` | 252 |
| 11 | Indian Myth and Legend | 1370840 | 2142193 | `indian-myth-and-legend.jpg` | 249 |
| 12 | Puzzles Old and New | 1373111 | 2145449 | `puzzles-old-and-new.jpg` | 88 |
| 13 | Mythical Monsters | 1370842 | 2142197 | `mythical-monsters.jpg` | 266 |
| 14 | Games Ancient and Oriental: The Egyptian Games | 1370844 | 2142199 | `games-ancient-and-oriental.jpg` | 261 |
| 15 | Korean Games: The Games of Chance and Divination | 1370846 | 2142203 | `korean-games.jpg` | 223 |
| 16 | Kwaidan: Stories and Studies of Strange Things | 1370850 | 2142207 | `kwaidan.jpg` | 220 |
| 17 | The Fairy Mythology, Volume I | 1370854 | 2142216 | `fairy-mythology-vol-1.jpg` | 123 |
| 18 | The Fairy Mythology, Volume II | 1370856 | 2142217 | `fairy-mythology-vol-2.jpg` | 120 |
| 19 | British Goblins | 1370858 | 2142219 | `british-goblins.jpg` | 105 |
| 20 | The Book of Were-Wolves | 1370861 | 2142225 | `book-of-were-wolves.jpg` | 124 |
| 21 | Sea Monsters Unmasked, and Sea Fables Explained | 1370865 | 2142228 | `sea-monsters-unmasked.jpg` | 112 |
| 22 | The Singing Games of England, Scotland, and Ireland | 1370866 | 2142229 | `traditional-games.jpg` | 251 |
| 23 | Chess and Playing Cards: The Chess, Divination and Card Collections | 1370869 | 2142232 | `chess-and-playing-cards.jpg` | 246 |
| 24 | Mancala, the National Game of Africa | 1370870 | 2142233 | `mancala.jpg` | 239 |
| 25 | Codex Enigmatica | 1370874 | 2142237 | `codex-enigmatica.jpg` | 170 |
| 26 | Pencil & Paper | 1370876 | 2142239 | `pencil-and-paper.jpg` | 173 |
| 27 | How the World Began | 1370879 | 2142242 | `how-the-world-began.jpg` | 212 |
| 28 | The Trickster's Table | 1370881 | 2142244 | `the-tricksters-table.jpg` | 281 |
| 29 | Words from the Gods | 1373115 | 2145453 | `words-from-the-gods.jpg` | 233 |

---

## If Lemon Squeezy ships an API for this

`POST /v1/products` and `POST /v1/variants` both still answer **405** — the
API cannot create products, which is why these were made in the dashboard in
the first place. If an images or media endpoint appears, the mapping table
above is already the input it needs: product id, variant id, file.
