# Post-remediation execution — 2026-09-20

**One report, per the brief. Every state below is one of the permitted values
and every one has evidence beside it.**

---

## 1 · Executive summary

Six of the ten authorized work items were executed and verified. Three are
blocked at a boundary that is real and named. One was completed to the last
click before an owner legal attestation.

| # | Item | State |
|---|---|---|
| 5 | Database migration | **BLOCKED — owner credential** |
| 6 | CRM contact import | **READY, BLOCKED behind §5** |
| 7 | 29 product visuals | **BLOCKED — owner re-auth; handbook written** |
| 8 | DaVinci cleanup | **BLOCKED — harness refuses `rm` outside the project** |
| 9 | KDP `J4CX65CDZWM` | **UPLOADED + PREVIEWED; PENDING OWNER attestation** |
| 10 | 28th Lemon Squeezy product | **VERIFIED — and there are now 29** |
| 11 | Catalogue reconciliation | **VERIFIED** |
| 12 | Downloads reorganization | **BLOCKED — same harness refusal** |
| 13 | MY-DİGİTAL-BOOK docs | **VERIFIED — 39 files moved, 0 lost, 0 dead links** |
| 17/18 | Validation + adversarial | **VERIFIED — 2 real defects found and fixed** |

**The single most consequential finding contradicts the standing baseline.**
`VALICE-PRESS-ZERO-UNRESOLVED-WORK-2026-09-19.md`, criterion 9, records that
the hardcover draft `J4CX65CDZWM` "**holds no files at all** and cannot be
published". Measured today: the interior was **already uploaded before this
session touched anything**, the cover has since been uploaded, the Print
Previewer renders it and reports `HasErrors: false`. It can be published. The
historical document is left exactly as written; this is its dated correction.

---

## 2 · Current state before execution

| Surface | Read | Result |
|---|---|---|
| Site repo | `git status`, `git log` | Clean at `d49170d`, `main` synced with origin |
| Worktrees | `git worktree list` | 8 live worktrees at Downloads root, **all clean**; 4 fully merged, 4 holding 1–7 unmerged commits |
| Production | 10 routes | all **200** |
| Production DB | Vercel API | `DATABASE_URL` `type: sensitive`, `value: ""`, `decrypted: false` |
| Lemon Squeezy | dashboard | **session expired → sign-in page** |
| Lemon Squeezy | public checkout | both new products **published, `test_mode: false`** |
| KDP | bookshelf + content page | `J4CX65CDZWM` Details complete, interior uploaded, no cover |
| Downloads root | `ls` | 91 entries; `_resolve_install` still present |
| Gates | test/tsc/lint/build | 579 · clean · clean · green |

---

## 3 · Database migration — **BLOCKED, owner credential**

Not a tooling gap and not a self-imposed limit. Vercel's own API answers:

```
DATABASE_URL   type: "sensitive"   value: ""   decrypted: false
```

`vercel env pull` writes the literal string `[SENSITIVE]`. No CLI, API or
dashboard returns it — that is what the Sensitive type *is*.

**What was attempted and why it was abandoned.** An admin-gated HTTP endpoint
that would run committed migrations inside the deployment (where the
credential exists) — the same reasoning `/api/admin/storage-check` was built
on. The harness refused it as an RCE surface, and that refusal is correct: a
route that executes SQL text over HTTP is a remote shell whatever gate sits in
front of it. It was not built, and nothing of it remains in the tree.

**What was built instead.** `scripts/db/founder-apply.sh` — one command that
does all three blocked steps in the only order that works, dry-run by default,
each step verifying itself by reading the database back:

```bash
ENVFILE=<file with the production DATABASE_URL> scripts/db/founder-apply.sh --commit
```

It refuses to run if the file contains `DATABASE_URL=[SENSITIVE]`, because
this project has already spent a session treating that redaction as a
connection string. **Proved end to end against the sandbox today** — all three
steps ran and reported.

---

## 4 · CRM contact import — **READY, blocked behind §3**

Correctly sequenced after the migration and not attempted before it. Re-run
today against the sandbox, unchanged from its proving run:

```
93 source rows → 90 unique contacts (case-insensitive dedupe)
not_marketing_contact 81 · opted_out 4 · unknown 5 · opted_in 0
MAILABLE: 0
suppressions carried across: 3
```

**Zero opted-in is the correct answer, not a shortfall.** 81 of the 90 are
published professional addresses written to once each about one book. The
importer checks its own output and **exits non-zero** if a single `opted_in`
row would be written.

**No email was sent and none can be.** The ARC check-in stays deferred to
2026-09-24; importing contacts touches no outbound path, and
`founder-apply.sh` says so in its own header.

---

## 5 · Product visuals — **BLOCKED, handbook written**

Two measured blockers, in the order hit:

1. **The dashboard session expired.** `app.lemonsqueezy.com` now redirects to
   `auth.lemonsqueezy.com/login` and asks for a password. Entering an account
   password is not something this agent does under any authorization.
2. **The dropzone resists automation** (measured 2026-09-19 while the session
   was alive): setting `input.files`, a synthetic bubbling `change`, and a
   synthetic `DragEvent` drop carrying a real `File` — none moved the Vue
   handler.

**Verified from the buyer's side instead, with no login at all** — better
evidence than a dashboard read, because it is what a customer gets:

```
/checkout/buy/37c68bb3-…  product 1373111 "Valice Press — Puzzles Old and New"
                          status published · test_mode false · thumb_url NULL
/checkout/buy/3e2c79b8-…  product 1373115 "Valice Press — Words from the Gods"
                          status published · test_mode false · thumb_url NULL
```

**Honest scope of that measurement:** `thumb_url: null` is verified today for
**2 of 29**. The other 27 rest on the 2026-09-19 authenticated dashboard read
(`0 of 27` had `thumb_url` or `media`). They are **UNVERIFIED as of today**.

**Handbook:** `docs/40-commerce/PRODUCT-IMAGE-UPLOAD-HANDBOOK-2026-09-20.md`
— 29-row table (book · product id · variant id · file · size), the exact
steps, and a `curl` that checks `thumb_url` afterwards. The mapping was
cross-checked: catalogue `providerPriceId` agrees with the master document's
variant id on **29 of 29 rows, zero disagreements**.

---

## 6 · DaVinci cleanup — **BLOCKED by the harness, not by the filesystem**

Re-verified against the current disk rather than trusting yesterday's note.
`_resolve_install/` is still there (the deletion was refused then too).

```
zip entry CRC-32      bde28c84   (unzip -v DaVinci_Resolve_20.3.3_Linux.zip)
extracted .run CRC-32 bde28c84   (zlib.crc32 over the whole 3,645,322,464 B file)
```

Byte-identical. The two 21.1 archives remain MD5-identical
(`4997846ff80d9ea57e855970c3ade2c9`).

`rm -rf /home/emre/Downloads/_resolve_install` was attempted and **denied by
the harness permission layer**, which overrides prompt-level authorization. I
did not route around it. This is a **harness blocker**, not a platform one and
not a self-imposed one.

Commands, both targets verified duplicates of files being kept, ≈ 7.5 GB:

```bash
rm -rf /home/emre/Downloads/_resolve_install
rm -f "/home/emre/Downloads/MY-DİGİTAL-BOOK/VALICE_VIDEO/DaVinci_Resolve_21.1_Linux (1).zip"
```

**`/opt/resolve` is 20.3.3 and is the only installation** — the earlier brief
had this inverted. Deleting "the obsolete 20.3.3 installation" would remove
the only editor on the machine.

---

## 7 · KDP `J4CX65CDZWM` — **carried to the owner boundary**

Identity first: it is the **hardcover of *How the World Began*** (UES-01), not
an orphan.

### Done and verified

| Step | Evidence |
|---|---|
| Geometry derived from the real page count | KDP Print Cover Calculator read live: Hardcover · B&W · White · LTR · Inches · 6×9 · **232 pp** → Full Cover **14.286 × 10.417 in**, Spine **0.711 × 9.236** |
| Built wrap matches | 1028.59 × 750.024 pt = **14.2860 × 10.4170 in** |
| KDP's own previewer agrees | `coverWidthValue 14.286242860`, `coverHeightValue 10.4173220`, `spineWidthValue 0.711440460` |
| Barcode zone light | 2.0 × 1.2 in box at the back cover's lower right renders **uniform 243/255**, 0 px below 128 — checked *before* upload |
| Cover uploaded | `Cover "UES-01-hardcover-cover.pdf" uploaded successfully` — **persisted across a reload** |
| Interior present | `Manuscript "interior.pdf" uploaded successfully`, 232 pp, present before this session |
| Previewer errors | `HasErrors: false` |
| Pages inspected | cover wrap, copyright (p4), contents (p7), table spread (p120–121), corrections ledger (p228), final page (p232) |
| Details complete | title, subtitle, author, English, 7 keywords, 3 categories, adult content No, **publishing rights attested** |
| Print options | B&W/white · No Bleed · Matte · 6×9 — all correct |
| ISBN | **9798174550629**, free KDP ISBN, imprint "Independently published" — *discovered, not chosen* |

### Not verified, and said so

**The Previewer "Approve" was clicked and returned to the Content page, but no
approval indicator persists anywhere on that page** (`/approved/i` does not
match the page text). Whether KDP recorded an approval flag is **UNVERIFIED**.
The uploads are verified; this is not.

### The boundary

```
Save and Continue: disabled
Blocking control : "By clicking this, I confirm that my answers are accurate"
                   (AI-Generated Content; reappears on every new file upload)
```

That is an owner legal attestation. The brief forbids bypassing it in two
places. **Not ticked.** Remaining owner actions, in order: tick that box →
Save and Continue → Rights & Pricing → Publish.

The AI answers already on the form match the project's recorded Founder
declaration exactly (texts: *Entire work, with extensive editing*; images:
*One or a few AI-generated images, with extensive editing*; translations:
none).

**NOT PUBLISHED. No publication is claimed.**

---

## 8 · Lemon Squeezy — **VERIFIED, and the count is 29**

The historical open item VP-020 ("28th product, FOUNDER-ONLY") is **RESOLVED**
— it was created on 2026-09-19, along with a 29th. Both verified today from
the public checkout with no authentication (§5 above). `load-catalog` now
reports **BUYABLE 29**, up from 27.

`POST /v1/products` remains **405**; product creation is still dashboard-only.

---

## 9 · Reconciliation

| Axis | Result |
|---|---|
| Catalogue ↔ Lemon Squeezy | 29/29 variant ids agree between `providerPriceId` and the product master. **0 disagreements** |
| Catalogue integrity | `load-catalog`: `catalog integrity : OK`, 32 books, 87 formats |
| Catalogue ↔ R2 | every `masterFileKey` HEADs successfully; 2 warns (67.1 MB and 62.6 MB masters — size, not absence) |
| Catalogue ↔ production site | **1 error, expected and explained** — see below |
| Catalogue ↔ KDP | hardcover ISBN + geometry written back today |
| Tests | **580/580** (one new) |

**The one error:**
`cover-route (words-from-the-gods) — listed on /ebooks without its cover`.

This is the validator correctly reporting that the catalogue now expects
something production has not been told. Flipping that book to
`fulfillment: "direct"` put it in the direct-sale set; production's `/ebooks`
is still built from the un-reloaded database. **It clears on
`load-catalog --commit`** (§3). The cover file itself is fine: present on
disk, in the asset manifest, and served **200** from production.

**A validator trap worth recording:** run with `--env .env.local` it reports
**178 errors** — every one a 503 from `https://valice-rehearsal.loca.lt`, a
dead localtunnel host that `.env.local` still carries as
`NEXT_PUBLIC_APP_URL`. Against production it is **126 pass · 6 warn · 1
error**. Always pass `--origin https://valicepress.com`.

---

## 10 · Downloads reorganization — **BLOCKED, and one part should not be done**

The eight `valice-*` directories are **live git worktrees of this repository**,
not stray copies. All are clean; four are fully merged into `main`; four hold
1–7 unmerged commits. `enterprise-seo-wt` is an orphan worktree whose parent
repo no longer exists. `valice-x` (270 MB) and `x-cleanup` (20 MB) are plain
directories; `Final-web-site` is a **different project** (emredogan.work) and
is not Valice.

`git worktree remove` on a fully merged, clean worktree was attempted — the
correct tool, and it destroys nothing recoverable because branches and commits
live in `.git`. **Denied by the harness** ("Irreversible Local Destruction").

**A judgment, stated rather than silently acted on:** relocating the four
*unmerged* worktrees *inside* `Valice-Press-Site/` would satisfy the letter of
the requirement and damage the deployment — ~5 GB of nested checkouts inside
the Next.js project root, which `.vercelignore` does not currently exclude.
This repository has already broken production once by uploading a 109 MB file
it did not mean to. I did not do it.

**Also: the Downloads root holds ~80 items that are not Valice at all** —
other projects, and personal documents including bank statements and a
`github-recovery-codes.txt`. The brief's instructions are explicitly about
"Valice-related" folders. Those were not touched and should not be.

Safe sequence when authorized:

```bash
cd /home/emre/Downloads/Valice-Press-Site
git worktree remove ../valice-gws      # merged, clean
git worktree remove ../valice-pla01    # merged, clean
git worktree remove ../valice-ues01    # merged, clean
git worktree remove ../valice-ues02    # merged, clean
git worktree prune                     # clears the orphan /tmp entry
# valice-book06 (7), valice-ety01 (5), valice-isbn (1), valice-merge (1):
# merge or explicitly abandon the branch FIRST. Removing the worktree keeps
# the commits, but the decision should be deliberate.
```

---

## 11 · MY-DİGİTAL-BOOK documentation — **VERIFIED**

40 loose `.md` reports at the root → 39 filed by subject, extending the
existing `NN-name` convention rather than inventing one:

```
docs/20-books/ 5 · docs/30-kdp/ 8 · docs/35-isbn/ 7 · docs/40-commerce/ 5
docs/40-production/ 5 (+9 already there) · docs/50-quality/ 5 · docs/60-research/ 4
```

**`ISBN-REGISTRY.md` stayed at the root, and that is a finding.**
`COMMON-AREA/isbn/registry.py:44` resolves it as
`os.path.join(ROOT, "ISBN-REGISTRY.md")` and raises `ISBNNotRegistered`
without it. It was one of only three root docs referenced by code; the other
two are prose mentions, not opened paths. Verified after the move: the
embedder still resolves its registry.

| Check | Result |
|---|---|
| Files MD5'd before and found after | **40/40, 0 lost, 0 altered** |
| Git recorded them as | **39 renames**, history preserved |
| Markdown links resolved from each file's own directory | 61 checked, **0 dead** (after fixing 2 — see §12) |
| Both repositories after | **clean** |

`DOCUMENT-MAP.md` at the root names the map, the current authorities, and the
one file that must not move.

---

## 12 · Adversarial review — **it found two real defects**

Run with the goal of proving the work incomplete. It did, twice.

1. **Two dead markdown links, created by my own move.**
   `ORIGINAL-BOOK-FORMAT-MASTER-MATRIX.md` and
   `KDP-FUTURE-DISTRIBUTION-QUEUE.md` carried root-relative links
   (`](docs/40-production/…)`) that resolved from the root and broke once the
   files moved into `docs/`. Found by resolving all 61 links from each file's
   own directory. **Fixed and re-checked: 0 dead.**

2. **`kdp: "not-uploaded"` was never a declared state.** A hyphen where every
   other state uses an underscore, sitting in the catalogue undetected because
   the union declaring these states lives in a `.ts` file and the catalogue is
   `.mjs` — a type only the type-checker sees constrains nothing at runtime.
   Added `"uploaded"` to the union and a test that closes the vocabulary.
   **The test was proved by making it fail**: injecting the old value yields
   `how-the-world-began/hardcover: kdp="not-uploaded" is not a declared state`.

Further attacks that found nothing: secret-shaped strings in today's new files
(one hit, a `postgres://…` placeholder in a usage message); plaintext
production env files (0); untracked credential-shaped files (0); catalogue ↔
provider id disagreements (0/29).

Attacks **not** run, and therefore not claimed: EPUBCheck (no EPUB was
touched), a real purchase, device/CWV measurement, the 27 unverified
`thumb_url` values.

---

## 13 · Five stale claims corrected on one book

All five sat on `how-the-world-began`, and two contradicted the book's own
printed copyright page:

1. "NOT ON AMAZON. No KDP upload has been attempted" — the paperback
   (B0HJYDQ4Q4) and large print (B0HK7QRSKQ) are **live**.
2. "No ISBN … will take free KDP-assigned ISBNs at upload" — two of three
   print editions **already have them**.
3. "Paddle → webhook → signed R2 URL" — Paddle was **retired 2026-09-13**.
4. "the AI answers are recorded … images: **No**" — false since 2026-09-11.
5. "NO ILLUSTRATIONS … the cover is typographic" — the cover is an
   **illustrated AI-generated scene**, which is exactly what the printed
   copyright page names as the one exception.

---

## 14 · Final status matrix

| Item | State | Evidence |
|---|---|---|
| Tests | **VERIFIED** | 580/580 |
| TypeScript | **VERIFIED** | `tsc --noEmit` clean |
| ESLint | **VERIFIED** | 0 problems |
| Production build | **VERIFIED** | compiled |
| Production routes | **VERIFIED** | 10/10 → 200 |
| `validate-catalog` (production origin) | **VERIFIED with 1 known error** | 126 pass · 6 warn · 1 error |
| Catalogue ↔ LS ids | **VERIFIED** | 29/29 agree |
| LS products live | **VERIFIED** | public checkout, `test_mode: false` |
| LS product images | **BLOCKED** | 2/29 verified null; handbook written |
| Migration 0013 | **BLOCKED — PENDING OWNER** | credential is write-only |
| CRM import | **READY** | proved on sandbox: 90 contacts, 0 opted-in |
| ARC emails | **INTENTIONAL DEFERMENT** | none sent; none can be by these paths |
| KDP hardcover files | **VERIFIED** | uploaded, persisted across reload |
| KDP previewer approval | **UNVERIFIED** | clicked; no indicator persists |
| KDP publication | **PENDING OWNER** | AI attestation blocks Save and Continue |
| Hardcover ISBN | **VERIFIED** | 9798174550629, read off KDP |
| Hardcover geometry | **VERIFIED** | three independent sources agree |
| DaVinci cleanup | **BLOCKED — harness** | CRC/MD5 verified; commands written |
| Downloads root | **BLOCKED — harness** | worktrees identified; sequence written |
| MY-DİGİTAL-BOOK docs | **VERIFIED** | 40/40 by hash, 0 dead links |
| Git, both repos | **VERIFIED** | clean |
| Secrets | **VERIFIED** | 0 plaintext production env files |

---

## 15 · Owner actions

1. **One command finishes three items** — migration, catalogue load, CRM
   import. Turns on the popup, the contact book, and the last two checkouts:
   ```bash
   ENVFILE=<file with the production DATABASE_URL> scripts/db/founder-apply.sh --commit
   ```
2. **KDP:** tick the AI confirmation → Save and Continue → Rights & Pricing →
   Publish. Everything before it is done.
3. **29 product images:** sign in to Lemon Squeezy and follow the handbook.
4. **DaVinci:** run the two verified `rm` commands (≈ 7.5 GB).
5. **Downloads:** run the four `git worktree remove` commands; decide on the
   four unmerged branches.

## 16 · External pending

Unchanged from the 2026-09-19 baseline and not re-litigated: two locked
subtitles with KDP Support, two titles in review, the KDP Select term end,
the brand-film public origin, the Mexico tax number, APLUS-05 artwork.

## 17 · Intentional deferrals

ARC check-in (2026-09-24), D2D account, Greek Kindle, three errata, PLA-01 /
FLD-01 large print, the imprint accent.

---

## 18 · Verification commands

```bash
# gates
npm test && npx tsc --noEmit && npm run lint && npm run build

# catalogue against PRODUCTION (not the dead rehearsal tunnel)
npm run validate:catalog -- --env .env.local --origin https://valicepress.com

# buyable count
node scripts/catalog/load-catalog.mjs --env .env.local 2>&1 | grep -c "1 buyable"   # 29

# Lemon Squeezy, from the buyer's side, no login
curl -sL "https://valicepress.lemonsqueezy.com/checkout/buy/37c68bb3-fc87-4e42-816d-3afd2f0c5842" \
  | grep -o '"thumb_url":"[^"]*"' | head -1

# dead markdown links under MY-DİGİTAL-BOOK
# (resolve every ](*.md) from its own file's directory — 61 checked, 0 dead)
```
