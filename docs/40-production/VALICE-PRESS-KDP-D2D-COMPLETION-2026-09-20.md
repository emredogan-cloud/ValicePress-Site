# KDP + Draft2Digital completion — 2026-09-20

> Continues `VALICE-PRESS-KDP-D2D-INCIDENT-REMEDIATION-2026-09-20.md`. Where the
> two disagree, this one is later and measured.

---

## 1 · Gmail investigation

Swept `{kdp-no-reply@amazon.com, support@draft2digital.com, …} newer_than:21d`
— **94 messages across two pages**, every one classified. Not a sample: the
second page was fetched and contains no incident, only publication notices.

### Every incident-shaped message in the window

| Date (UTC) | Platform | Title / subject | Current state |
|---|---|---|---|
| 09-08 02:15 | KDP | Codex Enigmatica (9798170244751) — spine outside live graphics | **CLOSED** — paperback Live, submitted 09-18 |
| 09-09 03:37 | KDP | Seneca: Selected Dialogues (9798172687273) — barcode | **CLOSED** — Live, submitted 09-10 |
| 09-09 03:43 | KDP | Mythical Monsters Vol. One (9798172695872) — barcode | **CLOSED** — Live, submitted 09-10 |
| 09-14 12:59 | D2D | Greek Alphabet Workbook (4420624) blocked | **CLOSED** — Founder removed it 09-15 |
| 09-14 14:57 | D2D | **Content Warning — probationary hold** | **ANSWERED 09-15, replied to 09-19** |
| 09-14 15:16 | D2D | Codex Enigmatica (4421774) blocked | **CLOSED** — Founder removed it 09-15 |
| 09-16 06:12 | KDP | How the World Began hardcover (9798174550629) | **K-1/K-6 — fixed, uploaded, In review** |
| 09-16 10:17 | KDP | World Games hardcover (9798194081950) | **CLOSED** — Live, nothing pending |
| 09-16 10:35 | KDP | Codex Mythologica hardcover (9798191248714) | **K-4 — fixed, uploaded, Updates in review** |
| 09-16 11:22 | KDP | How the World Began large print (9798174682702) | **CLOSED** — Live since 09-18 |
| 09-18 04:31 | KDP | Codex Mythologica — repeat | as K-4 |
| 09-18 05:42 | KDP | Words from the Gods (9798174778559) | **K-5 — fixed, uploaded, In review** |
| 09-19 11:51 | KDP | Words from the Gods — repeat | as K-5 |
| 09-19 14:10 | KDP | Codex Mythologica — repeat (3rd) | as K-4 |
| 09-19 18:39 | D2D | Re: [#1129140] — **the policy answer** | **governs everything in §5** |
| 09-19 22:27 | D2D | Puzzle Book (4420613) blocked | **Delisting** on the platform |
| 09-20 03:25 | D2D | World Games (4421748) blocked from 12 channels | **still Published; block applies at the channels** |

Nothing arrived after 09-20 03:25. The remaining ~70 messages are publication
confirmations, A+ approvals, a closed support case (#51717343) and payment/tax
notices — listed so they are not re-triaged.

---

## 2 · KDP — every title record, read off the Bookshelf

Harvested all three pages: **17 title records**. Every format of every one is
`Live` except the three this session moved, which are in Amazon's review queue.

| Title · format | State read 2026-09-20 |
|---|---|
| How the World Began — **hardcover** (`J4CX65CDZWM`) | **In review**, last modified 2026-09-20, $27.99 |
| Codex Mythologica — **hardcover** (`AGT1SW4QA1N`) | **Live · Updates in review** |
| Words from the Gods LP — **paperback** (`PCAH9FD63MX`) | **In review** |
| How the World Began LP — paperback | Live, submitted 09-18, `B0HK7QRSKQ` |
| The Great Book of World Games — hardcover (`6XXXBP8KMGR`) | Live, nothing pending |
| the other 12 records · 30+ formats | Live |

### The transition, and what I can and cannot claim

All three were blocked this morning behind the owner's AI-content attestation,
with *Save and Continue* disabled — I did not tick it, on any of them. After the
corrected covers were uploaded and the Print Previewer **approved**, all three
moved out of Draft / "with unpublished changes" and into review.

**Three for three is evidence that approving the Previewer releases a title that
had already been submitted once — not proof.** The Founder may have ticked a box
in the interval. What is certain is the before/after: this morning "Draft …
Continue setup", now "In review" with the content page redirecting to the
Bookshelf, which is what KDP does when a title is no longer editable.

**Nothing here is published.** In review is Amazon's queue, not a live edition.

---

## 3 · KDP — the World Games hardcover, decided on measurement

The previous report left this "repaired locally, not uploaded" and gave
unpublished-changes risk as the reason. That was the wrong reason. Measured:

| | KDP holds | canonical on disk |
|---|---|---|
| interior | **160 pages** (Previewer page navigator) | **186 pages** |
| full cover | **18.624 × 12.417 in** (`coverWidthValue`) | 18.683 × 12.417 in |
| spine | **0.549 in** (`spineWidthValue`) | 0.608 in |
| `HasErrors` | false, no error panel | — |

The live cover is **not** wrong: it is the correct wrap for the 160-page block
KDP also holds. The two agree with each other. What is stale is the whole
**edition** — the 160-page file on disk is literally named
`GreatBookOfWorldGames_interior_paperback.pre-companion.pdf`, and the sibling
paperback was already brought forward (Previewer reports **182 pages**, cover
17.6599, spine 0.4099 — the canonical numbers exactly).

So the hardcover, alone of the three formats, still sells the pre-companion
block. **Uploading the corrected cover on its own would create a defect** — a
186-page spine wrapped round a 160-page book. The fix is an interior + cover
pair, and the interior is **17.3 MB against this automation's 10 MB upload
bridge**, so it cannot be sent from here. Left unchanged deliberately, evidence
above, and queued for the Founder in §9.

---

## 4 · Four most recently issued ISBNs — from the canonical registry

`ISBN-REGISTRY.md` §2026-09-17: four **electronic** ISBN applications, all four
**ONAYLANDI → 2026-09-18**. That is the most recent issuance event in the
register; nothing has been issued since.

| Application | Book | ISBN | Check digit | EPUB | EPUBCheck, run today | sha256 vs registry |
|---|---|---|---|---|---|---|
| 1458898 | **Words from the Gods** | 978-625-90964-7-6 | valid (6) | `ETY-01/READY/KINDLE/book.epub` | **0/0/0** | matched, then changed on purpose (§6) |
| 1458860 | **The Trickster's Table** | 978-625-90964-6-9 | valid (9) | `UES-02/READY/KINDLE/book.epub` | **0/0/0** | **matched** |
| 1458850 | **How the World Began** | 978-625-90964-5-2 | valid (2) | `UES-01/08_OUTPUT/UES-01.epub` | **0/0/0** | **matched** |
| 1458840 | **Pencil & Paper** | 978-625-90964-4-5 | valid (5) | `PLA-01/08_OUTPUT/KINDLE/PencilAndPaper.epub` | **0/0/0** | **matched** |

Every ISBN is embedded in its own OPF as `urn:isbn:…`; every `dc:title` matches
the register; all four files exist at the recorded path and all four are under
the 10 MB bridge. No manifest drift.

---

## 5 · Draft2Digital — what the account actually is

Read live, 2026-09-20. **Five books**, four of them from before today:

| Book | Ebook status |
|---|---|
| Codex Bestiarium | Publishing |
| Codex Mythologica: The Puzzle Book | **Delisting** |
| The Great Book of World Games | Published (blocked at 12 channels) |
| The Great Book of World Myths | Publishing |
| **Words from the Gods — Etymon #1** | **Draft — created today, §6** |

### Root cause, in D2D's own words — it is not a file defect

The 09-20 block on World Games states the reason verbatim:

> "**Rejected Content Guidelines**: … we kindly request that clients refrain
> from submitting **automatically generated low-content material** … Resubmitting
> this title may result in action being taken on your account."
> "Please note we also do not accept any **PLR, Public Domain, or Creative
> Commons material**."

The 09-14 Content Warning names the categories:

> "The most common rejections are topics covering any type of **guide books,
> cookbooks, interactive books, strategy books** etc. Any information that is
> **easily found via internet searches**…"

And the 09-19 reply settles the annotated-edition question the Founder asked:

> "We cannot publish any works that are **derivatives of public domain work** and
> that does include **translations or adaptations** of public domain titles."
> "Please ensure you have **delisted the public domain based works**."

The current content-guidelines page, fetched today, agrees: *"We do not accept
Public Domain works."* Puzzle/activity/game books appear under **oversaturated
subject matter**.

**There is no EPUB, metadata, cover or ISBN change that answers any of this.**
Re-uploading a corrected file would be answering a content decision with a
technical one.

### The standing instruction nobody has actioned

"Please ensure you have delisted the public domain based works" is one day old.
Of the four pre-existing D2D titles, **three are public-domain-derived
retellings** — Bestiarium, World Myths, World Games — and one is already
Delisting. Delisting removes live listings from sale, so it is the account
holder's decision, not mine; it is the first item in §9.

---

## 6 · The one book submitted, and how far it got

**Words from the Gods** is the only one of the four newest-ISBN books outside
every category D2D has named: original etymology scholarship, 145 entries under
a two-independent-sources rule, filed to the ISBN agency as *Historical and
Comparative Linguistics (Etymology)*. Not public domain, not a retelling, not a
guide or strategy book.

Created as **D2D book 4431885** and carried from nothing to **Step 3 of 4**,
every field from canonical records:

| Field | Value | Source |
|---|---|---|
| Title | Words from the Gods | `metadata.json` |
| Series / volume | Etymon, 1 | `metadata.json` `series` |
| Publisher | Valice Press | D2D's own registered publisher record |
| Author | Emre Doğan | account author record |
| Language | English | `language: "en"` |
| Search terms | the 7 canonical keywords, in order | `metadata.json` `keywords` |
| Audience | general — no content inappropriate for minors | — |
| BISAC | LANGUAGE ARTS & DISCIPLINES / Linguistics / Etymology; SOCIAL SCIENCE / Folklore & Mythology | `bisac: LAN012000, SOC011000` |
| Cover | 1600 × 2560 JPG | `READY/KINDLE/cover.jpg` |
| Description | the canonical 807-character text, verbatim | `metadata.json` `description` |
| Short description | one paragraph, 340 chars, built only from sentences of the above | — |
| Release date | 2026-09-20 | — |
| Ebook ISBN | **9786259096476**, own ISBN | ISBN registry |

### A real file defect, found by D2D and fixed at source

D2D's uploader answered the first EPUB with:

> "Warning — You have submitted an ePub3 that is missing an NCX file. This may
> prevent publication at certain digital stores."

EPUBCheck 5.1.0 says `0 fatals / 0 errors / 0 warnings / 0 infos` on that same
file, because **an NCX is optional in EPUB3**. Every gate in this house was
asking the specification; the customer is the shop. Measured across the four
newest titles: all four EPUB3, all four with a nav document, **none with an NCX,
none with `toc=` on the spine**.

`COMMON-AREA/epub/add_ncx.py` now derives one from the book's own nav document,
so it cannot say anything the book does not:

```
book.epub: NCX added — 181 nav entries, uid urn:isbn:9786259096476,
           every other archive entry byte-identical
EPUBCheck: 0 fatals / 0 errors / 0 warnings / 0 infos
<spine toc="ncx">   <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
```

The rebuilt file was re-uploaded and D2D's own page changed its verdict to
**"THAT'S A NICE EPUB3 YOU GOT THERE — Your epub3 has passed all our checks"**,
then at Step 3 **"Hey, Love the EPUB! — Your epub has passed all our checks."**

The canonical EPUB was replaced in place (`book.epub.bak-20260920-no-ncx` kept
beside it) and **`ISBN-REGISTRY.md`'s recorded sha256 was updated with the
reason**, so the register still matches the disk. The other three titles have the
same defect and were **not** touched: their live Kindle editions carry the old
file, and the registry now says so and gives the command.

### Where it stopped, and why

Step 3 carries one unticked control:

> ☐ **"I have reviewed this manuscript and approve it for release for
> distribution to any sales channels I select on the next step."**

That is the account holder's personal declaration that a human reviewed the
manuscript and approves it for sale. It is the same class of control as KDP's
AI-content confirmation, which I declined three times today. **Not ticked.**
Step 4 — channel selection and pricing — is behind it.

### The other three: not submitted, and the reason is the record

| Book | Position |
|---|---|
| **How the World Began** | Creation myths **retold** from public-domain sources; filed to the ISBN agency as *Classical Texts*. Inside "adaptations of public domain titles", 09-19. |
| **The Trickster's Table** | Same, verbatim. |
| **Pencil & Paper** | "60 Games … and **How to Win**" — a strategy/interactive book by the 09-14 letter's own list, and the sibling of the title D2D blocked from 12 channels 12 hours earlier. |

**No fourth upload was attempted.** One was submitted where three were asked
for, because eligibility is the constraint the daily limit sits inside: the
account is on probationary hold, and the one action that ends it is sending
back what has already been refused.

---

## 7 · Source fixes made this session

| File | Defect | Fix |
|---|---|---|
| `COMMON-AREA/epub/add_ncx.py` | **new** — EPUB3s shipped with no NCX; retailers read it, EPUBCheck does not require it | derives an NCX from the book's own nav, asserts every other entry byte-identical |
| `scripts/assets/build-cover-thumbs.mjs` | **new** — homepage thumbs were hand-made, so the two most recently added books had none | generates any missing width-432 thumb; dry run by default |
| `scripts/assets/asset-manifest.mjs` | the `thumb/` branch and its comment were **duplicated**; the second copy was unreachable | removed |
| `ISBN-REGISTRY.md` | would have drifted from the disk once the EPUB changed | hash updated with the reason, pre-fix file kept |

Carried in from earlier today and unchanged: `build_founder_wraps.py` (paperback
safe box), `apply_barcode_plates.py` (the one-way door), `COMMON-AREA/qa/panels.py`.

---

## 8 · Reconciliation

| System | State | Agreement |
|---|---|---|
| **KDP** | 17 records; 3 in review, the rest Live | ✓ reconciled to the Gmail inventory, §1 |
| **D2D** | 5 books; 1 Published, 2 Publishing, 1 Delisting, 1 Draft | ✓ reconciled to the block emails, §5 |
| **ISBN registry** | 4 newest verified: check digits, embedding, paths, hashes | ✓ 4/4, §4 |
| **Catalogue file** | 32 published, 29 with a direct available ebook | ✓ |
| **Production website** | `/ebooks` renders **28** of those 29 | ✗ **one row behind** |
| **R2** | every master resolves; 3 over 20 MB (known print-interior warnings) | ✓ |
| **Tests / lint / types / build** | 580 tests, eslint, tsc, `next build` | ✓ all green |
| **Deployment** | latest production deployment **● Ready**; `/`, `/books`, two book pages, one companion all 200 | ✓ |

### The one disagreement, named exactly

`validate-catalog --origin https://valicepress.com` → **126 pass · 6 warn · 1
error**. The error and two of the warnings are one cause:

* `/ebooks` lists 28 of 29 — the missing slug is **`words-from-the-gods`**, whose
  ebook was flipped `amazon` → `direct` in the catalogue on 2026-09-19;
* `puzzles-old-and-new` and `words-from-the-gods` both warn "direct price exists
  but no Offer in JSON-LD" — the provider price is not in the production row.

Both clear when the catalogue is loaded into the production database, which is
`scripts/db/founder-apply.sh --commit` — Founder-only, because `DATABASE_URL` is
a Vercel *Sensitive* variable and no API returns it. The other four warnings are
the three oversized R2 masters and a Lemon Squeezy key that sees 0 products
(a test-mode key), both previously recorded.

---

## 9 · Founder-only, in the order that unblocks the most

1. **D2D — delist the public-domain-derived works.** Asked for in writing 09-19,
   not yet done: Codex Bestiarium, The Great Book of World Myths, The Great Book
   of World Games. Removes live listings, so it is yours.
2. **D2D — Words from the Gods**, book 4431885, Step 3: tick *"I have reviewed
   this manuscript and approve it for release…"*, then Step 4 for channels and
   price. Everything before it is filled.
3. **KDP ×3** — if Amazon returns any of the three to Draft, the AI-content
   attestation is the only control left on each: `J4CX65CDZWM`,
   `AGT1SW4QA1N`, `PCAH9FD63MX`.
4. **`ENVFILE=… scripts/db/founder-apply.sh --commit`** — clears the one
   catalogue error and both JSON-LD warnings, and makes two books buyable.
5. **World Games hardcover** — decide whether to bring the live edition to the
   186-page block; it needs interior **and** cover together, and the interior is
   too large for this automation's upload bridge.
6. Optional: contest the World Games block — D2D's own email invites a reply.

---

## 10 · Adversarial review — what I tried to disprove

| Claim | How it was attacked | Result |
|---|---|---|
| "The four KDP notices are closed or fixed" | read all 17 Bookshelf records, not the 4 expected | held — and found 3 **older** notices (Enigmatica, Seneca, Mythical Monsters) that were never in the inventory. All three closed. |
| "K-2 and K-3 were already closed" | could be stale; checked for pending changes | held — LP Live 09-18; World Games hardcover Live, no pending change |
| "The World Games cover is obsolete" | read KDP's own geometry | **overturned** — the live cover matches the live 160-page interior. The edition is stale, not the cover; uploading the cover alone would have created a defect |
| "Approving the Previewer released the titles" | is it just the Founder ticking boxes? | **downgraded to evidence, not proof** — stated as such in §2 |
| "The D2D blocks are a file problem" | read the block emails in full and the live guidelines | **overturned** — they name content policy verbatim; but the file *did* have a real defect (no NCX) that D2D's uploader caught and EPUBCheck could not |
| "The four EPUBs are ready" | ran EPUBCheck live, hashed against the registry | held — 4/4 clean, 4/4 hashes matched |
| "Two shells were harmless" | inspected the processes | **overturned** — both were live, polling `vercel ls` every 15–20 s since yesterday, and could never terminate (§11) |
| "The catalogue is consistent with the site" | counted both sides | **found the one real gap** — 29 vs 28, named to the slug |
| "panels.py failures are defects" | looked at the pixels | 2 of its sweep rows are the Parthenon and painted book spines — the gate is documented as a diagnostic |

---

## 11 · The two background shells

Both were **still running**, not finished: `sleep 15` (pid 1201646, since
2026-09-19 16:27) and `sleep 20` (pid 1202030, since 2026-09-20 10:27), each
wrapping `npx vercel ls --prod` — roughly a day and six hours of polling, and
both output files empty because neither loop could ever exit.

The cause, found by looking at the bytes:

```
line 1  <claude-code-hint v="1" type="plugin" value="vercel@claude-plugins-official" />
line 7    Age  Project  Deployment  Status  Environment  Duration  Username
line 8    4h   …  ● Ready  Production  2m
```

The plugin hint is prepended to the CLI's output, so `sed -n '7p'` reads the
**header row**, which contains "Status" but never "Ready" or "Error". Both were
stopped, and the answer they were written to fetch was taken directly: latest
production deployment **● Ready**, and `/`, `/books`,
`/books/how-the-world-began`, `/books/words-from-the-gods`,
`/companion/under-every-sky` all return 200.

**A fixed line number into CLI output is not safe here.** Match the row by
content: `npx vercel ls --prod | grep -E "Ready|Error|Building|Queued"`.

---

## 12 · What this session did NOT do

* did not tick KDP's AI-content attestation on any of the three titles
* did not tick D2D's manuscript-release approval
* did not submit a fourth D2D upload, or any of the three ineligible books
* did not delete or resubmit a title D2D has rejected
* did not unpublish or delist anything
* did not upload the World Games hardcover cover without its interior
* did not send any email, and did not touch the ARC check-in
* did not weaken a test to obtain green

## 13 · Evidence

```
Gmail          {kdp, d2d} newer_than:21d → 94 messages, 2 pages, 17 incidents
KDP bookshelf  3 pages → 17 title records; J4CX65CDZWM "In review" 2026-09-20
KDP previewer  hidden fields read per title; World Games 18.624/0.549 @ 160pp
D2D            5 books; statuses from div.book-status title attributes
D2D policy     https://draft2digital.com/content-guidelines/ fetched 2026-09-20
EPUBCheck      4/4 → 0 fatals / 0 errors / 0 warnings / 0 infos
ISBN           4/4 check digits valid, 4/4 urn:isbn embedded, 4/4 sha256 matched
site QA        580 tests · eslint clean · tsc 0 · next build ok
catalogue      126 pass · 6 warn · 1 error (--env .env.local --origin production)
deployment     ● Ready; 5 production URLs 200
```
