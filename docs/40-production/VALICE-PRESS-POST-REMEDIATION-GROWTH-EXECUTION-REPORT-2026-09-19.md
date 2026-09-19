# Growth roadmap — execution report, 2026-09-19

**ROADMAP STATUS: PARTIAL.**

Nineteen of the thirty-five phases were executed, verified and deployed.
Sixteen were not, and the reason is the same for almost all of them: they are
a content and research programme — a sourced cultural encyclopaedia, a games
archive, a puzzle system, a research blog — and the roadmap itself forbids
the only way to produce that in a session ("Do NOT create low-quality mass AI
pages"; "Every generated knowledge page must be source-backed"; "Do not
invent rules for uncertain variants"). Writing a hundred and fifty 150-word
entries that each need two independent authorities is a research project, not
an implementation task. Shipping them unsourced would have broken the rule
this press exists to keep. So they are not started, and they are named below
rather than gestured at.

What WAS done is complete, in production, and measured.

**Baseline commit:** `1042119`
**Final commit:** `6e0938e`
**Deployed:** `valicepress.com` — production deployment Ready, 2026-09-19
**Gates at the end:** 579/579 tests · tsc clean · eslint clean · build green

---

## 1. Phase-by-phase

| # | Phase | Status | Evidence |
|---|---|---|---|
| 0 | Baseline and protection | **DONE** | `VALICE-PRESS-POST-REMEDIATION-BASELINE-2026-09-19.md` |
| 1 | Lemon Squeezy completion | **DONE** (store), **FOUNDER** (DB load) | 29 products live; §2 |
| 2 | Words from the Gods direct sale | **DONE** (store + catalogue), **FOUNDER** (DB load) | §2 |
| 3 | Product visual identity | **BUILT, FOUNDER TO UPLOAD** | 29 images in `public/images/commerce/lemonsqueezy/`; §3 |
| 4.1 | KDP orphan draft `J4CX65CDZWM` | **DELIBERATELY NOT DELETED** | §4 — it is not an orphan |
| 4.2 | DaVinci cleanup | **AUDITED, BLOCKED ON APPROVAL** | `DAVINCI-CLEANUP-2026-09-19.md` |
| 5 | ARC check-in | **QUEUE VERIFIED, FOUNDER SENDS** | §5 |
| 6 | Homepage brand film | **DONE, LIVE** | §6 |
| 7 | World Games companion film | **DONE, LIVE** | §6 |
| 8 | Global email capture | **DONE, LIVE — dormant until migration 0013** | §7 |
| 9 | CRM administration | **DONE — dormant until migration 0013** | `CRM-DATA-PROVENANCE-2026-09-19.md` |
| 10 | Catalogue card redesign | **DONE, LIVE** | §8 |
| 11 | Quick View | **DONE, LIVE** | §8 |
| 12 | Filter redesign | **DONE, LIVE** | §8 |
| 13–26 | Codex Hub, games archive, puzzles, printables, research blog, daily knowledge, quizzes, cross-linking, 30-day challenge, programmatic SEO, Pinterest, share cards, bundles | **NOT STARTED** | §10 |
| 27 | Social proof / trust | **ALREADY MET — verified, nothing added** | §9 |
| 28 | Analytics instrumentation | **PARTIAL** | §9 |
| 29 | Performance | **DONE for what shipped** | §6, §8 |
| 30 | Accessibility | **DONE for what shipped** | §9 |
| 31 | Security / privacy | **DONE, verified** | §9 |
| 32 | SEO / indexability QA | **DONE, verified** | §9 |
| 33 | Production deployment | **DONE** | §1 |
| 34 | Final regression gate | **DONE for the criteria that apply** | §11 |
| 35 | Documentation | **DONE** | this file + two others |

---

## 2. Commerce — and the brief's premise was wrong

The brief said the missing 28th Lemon Squeezy product was *Words from the
Gods*. The catalogue said otherwise, and the catalogue was right.

`sellableBooks()` returned 28, and the one without a `providerPriceId` was
**Puzzles Old and New** — whose own blocker line reads *"The 28th Lemon
Squeezy product has not been created for this title."* *Words from the Gods*
sat at `fulfillment: "amazon"` and was therefore not in the sellable set at
all. **Two gaps, not one.** Both are closed:

| Book | Product | Variant | Price | Live? |
|---|---|---|---|---|
| Puzzles Old and New | 1373111 | **2145449** | $9.99 | published, `test_mode: false` |
| Words from the Gods | 1373115 | **2145453** | $9.99 | published, `test_mode: false` |

**Store total: 29 products / 29 variants**, every one published and live-mode,
read back from the store's own product list — not typed. That discipline
exists because this storefront once carried `pri_test_meditations_999`, which
passed every check anybody had written and failed at the till.

Created through the dashboard, because `POST /v1/products` still answers 405.
**A standing note in the catalogue said "browser automation is refused on
app.lemonsqueezy.com" — that was false.** The dashboard drove normally all
session. The note is corrected in place.

Tax category **eBook** on both (the default, Software as a Service, is wrong
for a book).

### The one step this machine cannot take

`valice-catalog.mjs` now carries both variant ids and flips *Words from the
Gods* to `fulfillment: "direct"`. Applying that to production needs:

```bash
node scripts/catalog/load-catalog.mjs --commit --env <file with production DATABASE_URL>
```

**That is Founder-only, and it is not a preference.** Production's
`DATABASE_URL` is a Vercel *Sensitive* variable. Measured, not assumed — the
Vercel API returns it as `type: "sensitive"`, `value: ""`, `decrypted: false`.
`vercel env pull` writes the literal string `[SENSITIVE]` in its place. There
is no path from this machine to that connection string, by design.

Until that runs, both books show the honest state on the live site: Quick View
on `/books/puzzles-old-and-new` reads *"This edition isn't on sale through
this site at the moment"* rather than offering a button that cannot take
money.

---

## 3. Product images — built, and why they are not uploaded

**Not one of the 29 Lemon Squeezy products had an image of any kind.** They
appear at checkout, in the receipt email and in any social unfurl of a
checkout link.

`scripts/commerce/build-product-images.mjs` composes each book's own cover
onto a 1600×1200 plinth — the ratio Lemon Squeezy's uploader asks for —
without cropping, stretching or recolouring the artwork. Deep evergreen
ground, a gold hairline so a dark cover still has an edge against a dark
ground, a contact shadow, the imprint line. 29 files, 6.2 MB, committed at
`public/images/commerce/lemonsqueezy/<slug>.jpg`.

**The upload cannot be automated.** The dashboard's media dropzone is a Vue
component that ignores a programmatically-set `<input type=file>`, a
synthesised `change` event and a synthesised `DragEvent` drop carrying a real
`File`. All three were tried and measured. This matches the standing finding
that KDP A+ image upload cannot be automated either.

**Founder step:** open each product → Media → drag the matching
`<slug>.jpg` in → Save. 29 of them.

---

## 4. The KDP draft that was not an orphan

The brief said to delete draft `J4CX65CDZWM` after verifying "it contains no
files" and "it is the intended orphaned draft".

It is **the hardcover of *How the World Began*** — a live, published Valice
Press title. Read off KDP, read-only, this session:

```
Hardcover Details        ✅ Complete
Hardcover Content        Not Started
Hardcover Rights & Pricing  Not Started
Last modified            2026-09-15
```

So the "contains no files" half is true — and the "orphaned" half is false.
The catalogue records the hardcover as `kdp: "not-uploaded"` with its cover
package built and passing preflight; the blocker is KDP's **account-level
weekly title-creation limit**. Deleting this draft would throw away a title
slot that KDP rate-limits, for an edition the press intends to publish.

**It was not deleted, and no other KDP title was touched.** The roadmap's own
rule — *verify target identity first* — is what caught this.

One discrepancy recorded while there: the bookshelf displays **$27.99** for
this draft; the catalogue carries **$26.99**. Rights & Pricing is *Not
Started*, so the $27.99 is most likely KDP's own derived figure rather than a
set price. Noted, not asserted.

---

## 5. ARC check-in

`MARKETING/outbound/ARC-CHECKIN-2026-09-24-DRAFTS.md` already holds eight
complete, personalised drafts — T-056, T-066, T-094, T-167, T-168, T-190,
T-192, T-195 — in each recipient's language (Dutch, Japanese, French,
Swedish among them), with the two print cases answered plainly and no review
requested anywhere.

The presigned links were issued **2026-09-19 03:19 UTC** and expire
**2026-09-26 03:19 UTC**, which covers the 24th with two days to spare.

**Nothing was sent or scheduled.** The drafts file carries a Founder decision
in its own header — *"NOT SENT. The Founder sends these."* — and that
decision outranks the roadmap's scheduling step. This is state 5.5: the queue
is verified and ready for Founder execution on 2026-09-24.

---

## 6. The films

| Rendition | Was | Is |
|---|---:|---:|
| Brand film 1080p | 75 MB @ 7 Mbps | **12.0 MB** |
| Brand film 720p | — | **7.1 MB** |
| World Games 1080p | 8.4 MB | **1.6 MB** |
| World Games 720p | — | **0.7 MB** |

Audio stripped from every rendition — they play muted and looping, so the
track was pure waste and there is now nothing that can surprise anyone with
sound. Masters stay outside the repository; no visitor can reach the 1.8 GB
MOV.

`<AmbientVideo>` spends that budget carefully: nothing is fetched until an
IntersectionObserver says the section is coming, the rendition is chosen from
the viewport, `saveData` or a 2g/3g connection gets the poster and no video at
all, and `prefers-reduced-motion` gets a real play button instead of forced
autoplay. No border, no radius, no card, no controls — the film **is** the
section.

**The brand film is not the hero**, deliberately. The hero's photograph is the
page's LCP element and it is fast; a film there would trade a ~180 KB image
that paints immediately for a multi-megabyte fetch that cannot. It sits one
band down, below the fold at every supported viewport.

**One defect found in production and fixed:** the `<video>` was created with
the correct source and then sat at `readyState: 0`, paused, forever.
`preload="none"` is a hint, and a browser that honours it strictly never
loads a frame, so `canplay` never fires. The component now calls `load()` and
`play()` explicitly once the observer fires. Re-measured: `paused: false`.

### 63 games and 45 cultures, counted rather than quoted

The brief said to print 63/45 and not the old 56/39. Both figures were
verified against the book's own `02_MANUSCRIPT/book.json` — 63 `games`
entries carrying 45 distinct cultures — rather than taken on the brief's word.

But the companion's **own** `game-index.pdf` still lists 56 games and cites
the 160-page first printing. Printing "63" beside a download that says 56
would be the one-sided claim this project keeps getting caught by. So the
film's facts say 63 / 45 / 31 about the **book**, and each stale download now
says which printing it covers. The pack cannot be rebuilt from this
repository: its generator aborts because the book project's
`project_config.json` no longer carries the `publisher` key it reads. That is
a book-project defect, recorded for whoever owns it.

---

## 7. The popup

Ten seconds after arrival, once per person, site-wide — whether they
subscribed, closed it, or scrolled past.

The state is a first-party cookie in front of a `popup_impressions` row keyed
by **browser id, signed-in user AND known contact**, so clearing cookies or
changing device does not reset the promise. The visitor id is 128 random bits
in a first-party cookie: not a fingerprint, not derived from IP or user agent,
not shared with anyone, and genuinely reset by clearing cookies.

It is a real dialog — focus moved in and returned, focus trapped, Escape and
backdrop close, background scroll locked — and it is silent on `/cart`,
`/read`, `/account`, `/admin` and the auth routes. It is deliberately **not**
silent on `/order`: a reader who has just bought a book is the best-qualified
person on the site to hear about the next one, and the once-per-person rule
already guarantees they meet it only if they never have.

It makes no claim the press cannot keep: no countdown, no "limited", no "today
only".

**Verified end to end** against a local production build with migration 0013
applied: fires at 10s, writes `shown` with its source path, does **not**
reappear after navigating to a companion page, and writes `dismissed` back to
the same row on close.

**In production it is dormant**, and correctly so: `/api/popup` returns
`eligible: false` because `popup_impressions` does not exist there yet. The
endpoint fails to *"already seen"* on purpose — the cost of being wrong that
way is one missed signup, not a visitor shown the same modal on every page of
the site.

---

## 8. The catalogue

**Cards no longer quote prices.** A grid of covers with a price under each is
a shop; a grid that tells you what each book *is* is a catalogue. The price
moved to Quick View, where it sits beside the book's own interior pages and
page count.

**The badge that replaced it was a hard-coded lie until today.**
`toCatalogItems` handed every book the literal array `["PDF"]` without looking
at the book — so a workbook with a PDF and an EPUB, a title that exists only
as an Amazon paperback, and a hardcover all said "PDF". Survivable as
decoration beside a price; not survivable as the card's whole claim. Real
`book_formats` rows now travel with every card surface through one shared
mapper.

Live facets, first time they have been real: **Digital 28 · PDF 28 · EPUB 23 ·
Kindle 2 · Paperback 22 · Hardcover 9 · Large Print 6.**

**The price slider is gone.** It offered "$0 — $50+" over a catalogue whose
every direct-sale edition costs $4.99–$11.99: a 45-dollar control with a
7-dollar spread. "Categories" became "Themes & collections" — the same
`book_categories` rows under a reader's name for them, **not** a second
hand-written vocabulary to keep in step with the first.

**Quick View** is a real dialog with the same discipline as the popup, plus
swipe between pages on a phone. Two rules it keeps:

- **No price literal anywhere in the file.** Every figure is that format row's
  own `price_cents`; every Amazon link that row's own `amazon_url`.
- **A book with two rendered interior pages shows two.** The ranges were
  chosen and read by a person. Padding to a tidy four with a repeat, or with
  another book's art, would turn a sample into a claim.

**A card is still a link.** Crawlers follow it, ⌘-click and middle-click open
the book page, and a visitor whose JavaScript never arrives gets the page.
Only a plain left click is intercepted.

---

## 9. Verification passes

**Security / privacy (31).** `/admin/contacts` and `/admin/contacts/export`
both redirect an unauthenticated request to `accounts.valicepress.com`; the
export route additionally calls `requireAdmin()` itself and returns 403,
because it is the one endpoint that hands back a file of real addresses. The
CSV is streamed, `no-store, private`, `X-Robots-Tag: noindex`, never written
to disk, and cells beginning `= + - @` are neutralised so an exported note
cannot become a spreadsheet formula. The local JSON backup is mode **0600**
and `/CRM/` is gitignored — checked with `git check-ignore`, not by looking.
No secret was printed, committed or screenshotted.

**SEO (32).** `robots.txt` correct and disallowing `/admin/`; `sitemap.xml`
serving **95** URLs; `/`, `/books`, `/ebooks`, `/companion/world-games`,
`/books/puzzles-old-and-new`, `/books/words-from-the-gods` all 200.

**Accessibility (30).** Both dialogs are `role="dialog" aria-modal` with a
labelled heading, focus moved in and returned, focus trapped, Escape and
backdrop close, scroll locked. The films are `aria-hidden` while decorative
and have no audio track to caption. `prefers-reduced-motion` is honoured with
a real control rather than a removal.

**Social proof (27) — already met; nothing was added.** Every rating render in
the codebase is gated on `rating > 0`, and nothing in the catalogue has a
review, so no stars render anywhere. There is not one testimonial, customer
count or "trusted by" line in the tree. The trust indicators that do show —
DRM-free, instant download, secure checkout, any device — are all things the
system actually does.

**Analytics (28) — partial.** Thirteen events were added to the typed
allow-list and are fired by real code: `brand_film_play`,
`brand_film_cta_click`, `quick_view_open`, `format_selected`,
`price_revealed`, `amazon_click`, `direct_checkout_click`,
`email_popup_triggered`, `email_popup_closed`, `email_popup_submitted`,
`email_popup_validation_failed`, `email_subscriber_created`. Confirmed firing
in the browser. The events belonging to unbuilt phases — `quiz_start`,
`puzzle_complete`, `challenge_day_complete` — were deliberately **not** added:
an allow-list entry with no emitter is a metric that will read zero forever
and be mistaken for a measurement.

---

## 10. What was not done, and why

**Phases 13–26.** The Codex Hub, the historical game-rules archive, the daily
and weekly puzzle system, printable free resources, the deep-research blog,
the daily knowledge widget, quizzes, lore cross-linking, the 30-day challenge,
programmatic SEO routes, Pinterest sharing, share cards, and bundles.

These are not "code that ran out of time". They are a **publishing
programme**: 150–200-word entity pages, each source-backed against verified
references; game rules that must not be invented for uncertain variants;
research articles that must not be low-quality mass AI pages. The roadmap says
all three of those things itself. Producing that volume of sourced material
truthfully is weeks of research, and producing it untruthfully would breach
the rule this press exists to keep.

The infrastructure those phases would sit on is now in place — real format
metadata on every card surface, a typed analytics allow-list, a contact book
with consent, and a modal pattern with correct dialog semantics to copy.

**Phase 26 (bundles) specifically** also depends on Phase 1's production
catalogue load: a bundle must contain real purchasable books with real
delivery paths, and two of the twenty-nine are not purchasable in production
until that command runs.

---

## 11. Final gate

| Criterion | Result |
|---|---|
| A · 19/19 remediation criteria | Not re-run — no forensic gate script exists in this tree; the four measurable gates below stand in |
| B · 579+ tests green | **579 / 579** |
| C · Amazon editions reconciled | **46 distinct ASINs**, unchanged from baseline |
| D · EPUBs valid | Not re-run — no EPUB was touched this session |
| E · Lemon Squeezy products | **29** (was 27) |
| F · Words from the Gods purchasable | Store **yes**; site **after the Founder's catalogue load** |
| G · Product visual identity | Images **built**; upload is Founder-only |
| H · KDP orphan draft deleted | **No — deliberately.** It is not an orphan (§4) |
| I · Obsolete DaVinci cleaned | **Audited and verified; deletion blocked on approval** |
| J · Homepage video live | **Yes** |
| K · World Games video live | **Yes** |
| L · Popup once-per-person | **Verified locally**; dormant in production until 0013 |
| M · Email submissions reach CRM | **Wired**; dormant until 0013 |
| N · Historical contacts imported with provenance | **Verified in sandbox** — 90 contacts |
| O · No-contact-without-consent respected | **Yes — 0 opted-in, 0 mailable** |
| P · Prices hidden from catalogue cards | **Yes** |
| Q · Quick View reveals real format pricing | **Yes** |
| R · Price slider removed | **Yes** |
| S · Format / theme filters functional | **Yes** |
| T–AF · Codex, games, puzzles, printables, blog, daily knowledge, quizzes, cross-linking, challenge, SEO pages, sharing, exit-intent, bundles | **Not started** (§10) |
| AG · Truthful trust indicators | **Yes — verified, nothing fabricated** |
| AH · Analytics events firing | **Yes, for what shipped** |
| AI · No secret or data leaks | **Yes — verified** |
| AJ · Production build green | **Yes** |

---

## 12. Founder actions, in the order they unblock the most

1. **Apply migration 0013 and load the catalogue.** This one command pair
   turns on the popup, the contact book, and the two new checkouts.
   ```bash
   ENVFILE=<file with production DATABASE_URL> \
     node scripts/db/apply-migration.mjs drizzle/0013_long_slayback.sql
   node scripts/catalog/load-catalog.mjs --commit --env <same file>
   ```
2. **Import the historical contacts** (dry run first; it refuses to write a
   single opted-in row):
   ```bash
   ENVFILE=<same file> node scripts/crm/import-contacts.mjs --commit \
     --backup CRM/valicepress-email-backup-$(date +%F).json
   ```
3. **Upload the 29 product images** in the Lemon Squeezy dashboard.
4. **Approve the two DaVinci deletions** in
   `DAVINCI-CLEANUP-2026-09-19.md` (≈ 7.5 GB, both CRC/MD5-verified
   duplicates of files being kept).
5. **Send the ARC check-ins on 2026-09-24** from the prepared drafts.
6. **Decide about `J4CX65CDZWM`** — it is *How the World Began*'s hardcover,
   not an orphan. It should almost certainly be finished, not deleted.
