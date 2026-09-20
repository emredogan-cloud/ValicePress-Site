# KDP + Draft2Digital incident remediation — 2026-09-20

---

## 1 · Executive summary

Gmail carried two unrelated incident classes. One is a **file defect with a
root cause in our own source**, and it is fixed, rebuilt, re-uploaded and
re-verified in KDP's own Previewer. The other is a **distributor policy
decision**, and it cannot be fixed by repairing a file — it changes what this
press may send to Draft2Digital at all.

| # | Incident | Platform | State |
|---|---|---|---|
| K-1 | *How the World Began* hardcover — front-cover text past the trim line | KDP | **FIXED, then re-fixed — see K-6; corrected file uploaded and approved** |
| K-2 | *How the World Began* large print — spine text too close to edges | KDP | **CLOSED — was already fixed on 09-17; the edition went Live on 09-18** |
| K-3 | *The Great Book of World Games* — front cover past the trim line | KDP | **CLOSED on KDP — hardcover is Live with nothing pending; a separate on-disk defect was repaired** |
| K-4 | *Codex Mythologica* — front cover past the trim line (3 notices) | KDP | **REPAIRED — correct cover uploaded, previewer approved; awaiting Founder attestation** |
| K-5 | *Words from the Gods* LARGE PRINT — cover text too close to edges (2 notices) | KDP | **REPAIRED at source — rebuilt, uploaded, previewer approved; awaiting Founder attestation** |
| K-6 | *How the World Began* hardcover — the K-1 fix broke the back panel's head | KDP | **SELF-INFLICTED, FOUND AND FIXED — v3 uploaded and approved** |
| D-1 | Account **probationary hold** + content warning | D2D | **EXTERNAL PENDING — Founder answered 2026-09-15; D2D replied 2026-09-19** |
| D-2 | *The Greek Alphabet Handwriting Workbook* blocked | D2D | **RESOLVED BEFORE THIS RUN — Founder removed it** |
| D-3 | *Codex Enigmatica* blocked | D2D | **RESOLVED BEFORE THIS RUN — Founder removed it** |
| D-4 | *Codex Mythologica: The Puzzle Book* blocked | D2D | **ACTIVE — now "Delisting" on the platform** |
| D-5 | *The Great Book of World Games* blocked from all 12 channels | D2D | **ACTIVE — still "Published", block takes effect** |

### The headline, and it is not what the brief expected

**The three D2D uploads asked for today were NOT performed, deliberately.**

On **2026-09-19 at 18:39** Draft2Digital answered the Founder's question in
case **#1129140**:

> "We cannot publish any works that are **derivatives of public domain work**
> and that **does include translations or adaptations** of public domain
> titles… Please ensure you have **delisted the public domain based works** as
> those are not permitted."

All four of the most recently issued ISBN books fall inside what D2D has just
prohibited — three as public-domain retellings, one as the games/strategy
category they named explicitly. The account is on a **probationary hold**
whose notice ends: *"Deleting and resubmitting any of your titles that have
been rejected for content can and will result in immediate termination."*

Uploading three of those titles today would have been submitting, one day
after that instruction, precisely the material they refused — to an account
they have threatened to close. **Every other preparation step was completed**,
so the decision is the Founder's and nothing else is outstanding.

---

## 2 · Gmail investigation

Searched `(KDP OR "Kindle Direct" OR Draft2Digital) newer_than:14d` — 55
threads, all from verified senders (`kdp-no-reply@amazon.com`,
`support@draft2digital.com`, `support@kdp-support.amazon.com`). Marketing and
unrelated platform mail was excluded.

### KDP "Attention needed" (5 titles, 8 notices)

| Date (UTC) | Title | ISBN | Warning |
|---|---|---|---|
| 2026-09-16 06:12 | How the World Began | 9798174550629 | front cover past trim line |
| 2026-09-16 10:17 | The Great Book of World Games | 9798194081950 | front cover past trim line |
| 2026-09-16 10:35 | Codex Mythologica | 9798191248714 | front cover past trim line |
| 2026-09-16 11:22 | How the World Began (large print) | 9798174682702 | **spine** text too close to edges |
| 2026-09-18 04:31 | Codex Mythologica | 9798191248714 | repeat |
| 2026-09-18 05:42 | Words from the Gods | 9798174778559 | cover text too close to edges |
| 2026-09-19 11:51 | Words from the Gods | 9798174778559 | repeat |
| 2026-09-19 14:10 | Codex Mythologica | 9798191248714 | repeat |

### Draft2Digital

| Date (UTC) | Subject | Book | Meaning |
|---|---|---|---|
| 2026-09-14 12:59 | Attention: …blocked | Greek Alphabet Workbook (4420624) | content block |
| 2026-09-14 14:57 | **Content Warning** | — account — | **probationary hold**, 7 business days to respond |
| 2026-09-14 15:16 | Attention: …blocked | Codex Enigmatica (4421774) | content block |
| 2026-09-15 02:01 | *(sent by Founder)* | — | removal confirmed, guidance requested |
| 2026-09-19 18:39 | Re: [#1129140] Content Warning | — account — | **the policy answer** (quoted above) |
| 2026-09-19 22:27 | Attention: …blocked | Puzzle Book (4420613) | content block |
| 2026-09-20 03:25 | Attention: …blocked | World Games (4421748) | blocked from **12 channels** |

Not incidents (recorded so they are not re-triaged): ~20 "published"
confirmations from both platforms, KDP A+ approvals, Lemon Squeezy onboarding,
Payoneer, and KDP Case #51717343, which Support closed as **resolved** on
2026-09-16.

---

## 3 · KDP incident K-1 — resolved end to end

**Email → platform → artefact → rule → root cause → correction → confirmation.**

The rejection email's Previewer link carried id `8PH7Z8X35HH` — **the same
record this house uploaded a cover to on 2026-09-19**. So the previous session
re-sent the cover KDP had already refused. That is the finding that made this
incident worth chasing rather than clicking past.

### The rule, quoted from the notice

> "…all elements intended to be viewable appear at least **0.716in
> (18.175mm)** away from the outside edges. All front cover text must also
> stop at least 0.4in (10mm) away from the edge of the spine."

### The measurement

Rendered the built wrap at 150 dpi and measured against the geometry KDP's own
Cover Calculator returned for this book (Hardcover · B&W · White · 6×9 ·
232 pp → Full 14.286 × 10.417 in, spine 0.711):

```
lowest front-panel type   y = 9.793 in of 10.417   →  0.624 in clear
KDP requires                                          0.716 in clear
deficit                                               0.092 in
```

Visual confirmation: the keep-out line runs **through the words "Vâliçe
Press"**. The back panel was clear at both ends; the front panel's top hits
were bright artwork, which is intended to bleed.

### The root cause — in our source, not on the platform

`04_BUILD/covers_founder.py` composes the Founder's single artwork comp into
each binding. After an **earlier** KDP rejection it was taught to keep the
**spine** type clear of both ends (`SPINE_END_SAFE_IN = 0.375`). The **panels**
never got the same treatment: they are scaled to exactly the sheet height, so
the comp's own foot margin — almost nothing — is carried straight through, and
the imprint burned into the artwork lands on the fold. The same mistake, one
level out.

### The correction

The hardcover panels are now **lifted 0.117 in**, and the strip they vacate at
the foot repeats the panel's own bottom row. That strip lies inside the
**0.591 in wrap**, which this file itself describes as the margin that "folds
around the board and is never seen" — so nothing visible is invented, the type
keeps its size and its position relative to the artwork, and only its distance
from the fold changes.

**Hardcover only.** Proved rather than asserted: the paperback was rebuilt from
the patched source and from the pre-patch source and the two renders are
**pixel-identical (max difference 0)**. The live paperback edition is
untouched.

### The fix is on disk but UNVERSIONED where it lives

`MY-DİGİTAL-BOOK/.gitignore` line 20 is `BOOK-SERIES/*`, so the whole book-series
tree — including this cover builder — is deliberately outside version control
in that repository. The change therefore exists **on disk only**, with
`covers_founder.py.bak-20260920` beside it for reversal.

Because a fix nobody can diff is a fix nobody can trust, the exact patch is
committed *here*, in the versioned repository:
`docs/40-production/patches/UES-01-hardcover-cover-keepout-2026-09-20.patch.md`.

### One trap caught on the way

The barcode-safe stamper reads `KDP-PACKAGE/HARDCOVER/cover.pdf`, not the
`08_OUTPUT` wrap the rebuild writes. Run naively it re-stamped the **old,
defective** cover. The package stage was refreshed first and the stamper
re-run.

### Verification

| Check | Result |
|---|---|
| Geometry | 1028.59 × 750.024 pt = **14.286 × 10.417 in** |
| Front foot keep-out | **0.744 in clear** (needs ≥ 0.716) — **PASS** |
| Barcode zone | mean **243/255**, 0.00 % below 128 — **PASS** |
| KDP Previewer | **`HasErrors: false`** — see the caveat below |
| Previewer guides | imprint sits **above** the guide line (was crossing it) |
| Approval persisted | **"Please preview and approve these changes" cleared** |
| Survives reload | cover `v2` and the approval both persist |

> **`HasErrors: false` is weaker evidence than this row first made it look.**
> The second pass opened KDP's own view-only QA page for Codex Mythologica —
> the one that prints two rejection notices in a red ERROR panel — and its
> hidden field reads `HasErrors: false` as well. The field is about whether the
> Previewer could process and render the file, not about whether Quality Review
> will accept it. It is still worth reading: a file that renders at the right
> geometry with the guides clear is a file that got past everything this house
> can test. It is not an acceptance, and the acceptance only exists after KDP
> re-reviews a submitted title.

**Final KDP state: files uploaded, Previewer approved, NOT submitted.** The
only remaining control is the owner's AI-content attestation ("By clicking
this, I confirm that my answers are accurate"), which keeps *Save and
Continue* disabled. That is a legal attestation and was not ticked.

*(The cover this section describes, `v2`, was superseded hours later by `v3`.
See K-6 in §4.)*

---

## 4 · Second pass, later the same day — K-2 … K-6

The first pass triaged these four and said so. The second pass measured them,
and **two of the four were not open at all**; of the two that were, both had a
cause in our own source, and chasing them turned up a fifth defect that this
house had put there a few hours earlier.

### K-2 — closed, and it was already closed

KDP asked for spine text 0.375 in clear of both ends. The file on disk, rebuilt
2026-09-17, gives **1.255 in at the head and 1.370 in at the foot**. The
Bookshelf, read 2026-09-20: *How the World Began — Large Print Edition*,
paperback, **Live**, submitted 2026-09-18, ASIN `B0HK7QRSKQ`, no unpublished
changes. The notice of 09-16 had been answered before this session began.

### K-3 — closed on KDP, and a different defect found underneath

The Bookshelf shows the World Games hardcover **Live**, with no pending change
and no "Continue setup". The 09-16 notice is spent.

What the measurement found instead is that the hardcover's **upload master on
disk had lost its barcode plate**: min luminance 0, standard deviation 60, in
the rectangle KDP requires to be light and solid. Cause in §4.6. It is repaired
on disk and **not uploaded** — uploading to a Live edition with nothing pending
would move it to "Live with unpublished changes" for a fault KDP has not
raised, and that is the Founder's call, not mine. See §11.

### K-4 — the file KDP holds is not the file on disk

The Previewer that KDP's own notice links to renders the reviewed file, and it
shows a Codex Mythologica case wrap with **no barcode plate**: the barcode box
sits on dark artwork over the baked "VÂLIÇE PRESS / DISCOVER · EXPLORE · THINK"
lettering. The master on disk has carried a plate since 2026-09-17 and measures
243/0.00 in that box. Two different files.

The corrected master was uploaded as `CDX-01-hardcover-cover.pdf`, the Print
Previewer was run and **approved**, and *Save and Continue* is now disabled
behind the AI-content attestation — the owner-only control. Measured on the
uploaded file, against the 0.716 in the notice quotes:

```
back   head 1.600  foot 1.030  outer edge 0.915
front  head 1.795  foot 1.500  outer edge 1.420   off the spine 1.095  (needs 0.4)
spine  head 0.730  foot 0.740
barcode box  min 243  std 0.00                     PASS
```

KDP's second clause on this title — front cover graphics past the trim line —
is satisfied by every measurement available here. Whether their reviewer agrees
is decided by their re-review, and this report does not pretend to know.

### K-5 — one line in a shared builder, and it says so itself

The notice's ISBN 9798174778559 belongs to **Words from the Gods, LARGE PRINT
paperback, 6 × 9, Draft** — read off the KDP content page, not inferred. Three
faults: text inside 0.375 in of the edges, text hard to read, and no room for
the barcode.

`COMMON-AREA/covers/build_founder_wraps.py` fits every **case wrap** into a
safe box and lays every **paperback** on the sheet edge to edge:

```python
if f.get("hc"):
    pad = int(round(HC_SAFE_IN * DPI))                      # 0.716
    back,  bcrop = wrap_safe(KB, panel_w,   ph, pad, pad_i, pad, ...)
    front, fcrop = wrap_safe(KF, panel_w_f, ph, pad, pad_i, pad, ...)
else:
    back,  bcrop = place(KB, panel_w,   ph, ay, mc, outer="left")    # no safe box
    front, fcrop = place(KF, panel_w_f, ph, ay, mc, outer="right")
```

`wrap_safe` exists for exactly this and its own docstring explains why it was
not used: *"Paperbacks are untouched: a 0.125 in bleed is trimmed, not folded,
and their placement was never wrong."* That sentence is the defect. KDP's
0.375 in **is** the 0.125 in that gets trimmed plus the 0.25 in that has to
survive the trim.

```
                         before      after     KDP requires
front, head              0.150 in   0.650 in      0.375 in
front, foot              0.335 in   0.815 in      0.375 in
front, off the spine     0.335 in   0.575 in      0.400 in
back,  outer edge        0.455 in   0.995 in      0.375 in
```

The rebuild also removed a second fault nobody had reported: the comp's own
spine sliver was printing a **mirrored second title** on the back panel's inner
edge. `wrap_safe` takes its excess off the spine side, and that is what goes.

Uploaded as `ETY-01-largeprint-cover.pdf`, Previewer run and **approved**. KDP's
hidden fields for the uploaded file read `coverWidthValue 13.6050 ·
coverHeightValue 9.2500 · spineWidthValue 1.3550` — the builder's own numbers,
to four decimals.

### K-6 — the K-1 fix broke the other end, and this run found it

This is a defect this house introduced today, a few hours before it was found.

The K-1 patch lifted **both** panels by one constant derived from one
measurement of the **front** panel's foot. Measured on the file that had
already been uploaded:

```
                     before the lift   after the lift   KDP requires
front panel, foot       0.620 in          0.740 in        0.716 in   ✓ fixed
back panel, head        0.720 in          0.605 in        0.716 in   ✗ BROKEN
```

The back panel's headline — *"Thirty answers to the only question everyone has
asked."* — had four thousandths of an inch of slack at the head and the lift
spent it. The back panel never needed moving: its own foot was 2.7 in clear.

The lift is now **per panel and measured**: each rises by the smaller of what
its foot is short and what its head can spare, and a wrap that still breaks the
rule is refused rather than written. `v3` is uploaded and Previewer-approved,
and the paperback was rebuilt from patched and unpatched source once more —
**max absolute pixel difference 0**. Patch record:
`docs/40-production/patches/UES-01-hardcover-lift-per-panel-2026-09-20.patch.md`.

### 4.6 · The one-way door under K-3 and K-4

`apply_barcode_plates.py` froze the design of record the first time it ran:

```python
intact = out / "cover-founder-intact.pdf"
if not intact.exists():                       # ...once
    shutil.move(str(out / "cover.pdf"), str(intact))
src = Image.open(out / "cover-founder-intact.jpg")   # the only input, ever after
```

So a later geometry rebuild wrote a new, **unplated** `cover.pdf`, and
re-running the plater would have plated the *old* art straight back over it.
Both halves were on disk on 2026-09-20 — World Games unplated, Codex plated but
not the copy KDP holds.

A timestamp cannot tell these apart, because after a plate run the cover really
is newer than the intact copy. The discriminator is `barcodePlate` in
`READY/QA/cover.json`: the builder rewrites that file from scratch on every
build, so the key is present exactly when the current wrap has already been
plated. Asked of the eighteen wraps in the tree, it named **six — World Games
and Words from the Gods, all three formats each** — which is precisely the set
that had been rebuilt. The previous design of record is kept as
`.superseded-<date>`, never deleted.

### 4.7 · The gate that would have caught all of it

`COMMON-AREA/qa/panels.py`. Three panels, both polarities, the requirement
chosen by binding from the words KDP used. What the existing gates could not
see:

* `hcsafe.run` **drops the spine** before measuring, so no gate here had ever
  asked KDP's hardcover spine question;
* `coverqa.spine_check` defaults `end_safe=0.375` — the paperback number — on a
  case wrap that folds 0.716 in away;
* both take **one polarity per call**, so a sheet whose panels disagree reports
  "no text lines detected" for half of itself;
* and nothing measured a paperback panel at all.

Proved on both sides before it was trusted: the wrap KDP rejected on 09-19
exits 1 with `front top 0.1500 < 0.375`, the wrap uploaded today exits 0.

**It is a diagnostic, not a verdict, and the README says so.** Run across every
wrap in the tree it also reported the Puzzle Book's front panel as having type
0.000 in from the board edge; the 0.000 in is the Parthenon's colonnade, which
is a row of similar components sharing a baseline exactly like a line of type.
Every failure it prints is to be looked at. No claim in this report rests on an
unaudited row of that sweep.

---

## 5 · Draft2Digital — the real incident

### Live account state, read 2026-09-20

| Book | D2D ebook status | Block notice |
|---|---|---|
| Codex Bestiarium | **Publishing** | — |
| Codex Mythologica: The Puzzle Book | **Delisting** | 2026-09-19 |
| The Great Book of World Games | **Published** | 2026-09-20 (12 channels) |
| The Great Book of World Myths | **Publishing** | — |

Two titles are already gone from the account — the Founder removed the Greek
Workbook and Codex Enigmatica on 2026-09-15, exactly as asked, and his email
confirms he did **not** delete-and-resubmit.

### Root cause — and it is not a file

The block notice names **"Rejected Content Guidelines … automatically
generated low-content material"** and adds "we also do not accept any PLR,
Public Domain, or Creative Commons material."

The canonical EPUBs are not the problem. Every one checked here is **EPUBCheck
0 fatals / 0 errors / 0 warnings** with the correct `urn:isbn:` embedded and
the canonical ASCII publisher string. **Re-uploading a corrected file fixes
nothing**, and the notice warns that resubmitting a content-rejected title can
terminate the account.

The corrective action D2D actually asked for is **delisting** — a commercial
decision about live titles, and the Founder's to make.

---

## 6 · The four most recently issued ISBNs

From the canonical registry (`ISBN-REGISTRY.md`, §"2026-09-18 · dört yeni
elektronik ISBN"), applications opened 2026-09-17 and approved **2026-09-18** —
the four newest of the ten ever issued. Determined from registry evidence, not
filename order.

| ISBN | Book | App # | EPUBCheck | Embedded | SHA-256 matches registry | Publisher |
|---|---|---|---|---|---|---|
| 978-625-90964-7-6 | Words from the Gods | 1458898 | **0/0/0** | `urn:isbn:9786259096476` | ✔ `926f3c96…` | Valice Press |
| 978-625-90964-6-9 | The Trickster's Table | 1458860 | **0/0/0** | `urn:isbn:9786259096469` | ✔ `d05cb75f…` | Valice Press |
| 978-625-90964-5-2 | How the World Began | 1458850 | **0/0/0** | `urn:isbn:9786259096452` | ✔ `aecf3de7…` | Valice Press |
| 978-625-90964-4-5 | Pencil & Paper | 1458840 | **0/0/0** | `urn:isbn:9786259096445` | ✔ `7e2c95cc…` | Valice Press |

All four are 13 digits with a check digit recomputed in the registry, each
bound to one title and one format, and each embedded in its own canonical
EPUB. **Technically every one is upload-ready.**

### Eligibility against what D2D said on 2026-09-19

| Book | Nature | D2D prohibition it meets |
|---|---|---|
| How the World Began | thirty creation myths **retold** from public-domain sources; its own printed copyright page says so | "derivatives of public domain work … adaptations" |
| The Trickster's Table | eighteen trickster tales **retold** from traditions, same series | same |
| Pencil & Paper | sixty pencil games, rules and strategy | "guide books … interactive books, strategy books" — the category that already got Codex Enigmatica and the Greek Workbook blocked |
| Words from the Gods | original etymological scholarship, 145 entries with sources | **none clearly** — the only arguable candidate; closest risk is "information easily found via internet searches" |

---

## 7 · Three D2D uploads — NOT PERFORMED, and why

**State: BLOCKED — policy, not capability.** The daily limit of 3 was never
reached because zero were submitted.

The instruction to upload three was written before the 2026-09-19 policy reply
existed. Acting on it would have meant sending public-domain retellings and a
games guide to a distributor that had, the previous day, told this account in
writing that it cannot publish them, while the account sits on a probationary
hold carrying explicit termination language. The mission's own rule is that
the **live platform state is the authority** over what an email says; here the
live state is an account under hold and two more titles blocked inside 24
hours.

**What is prepared, so only the decision remains:** all four EPUBs validated
(0/0/0), ISBNs verified and embedded, SHA-256s matched against the registry,
publisher strings canonical, covers present, catalogue metadata available for
every D2D form field.

**The one defensible path**, if the Founder wants D2D volume: submit **Words
from the Gods alone**, as an original work, and ask D2D to confirm eligibility
*before* the upload rather than after — using case #1129140, which is open and
answered by a named agent. The other three should not be submitted while the
current policy stands.

---

## 8 · Reconciliation

| Axis | Result |
|---|---|
| Catalogue ↔ KDP (UES-01 hardcover) | ISBN 9798174550629 recorded; `kdp: "uploaded"`; cover-rejection history and fix written into the blocker |
| Catalogue ↔ ISBN registry | four newest ISBNs match registry, EPUB and check digit |
| EPUB ↔ registry | four SHA-256s match byte for byte |
| Catalogue ↔ D2D | D2D state recorded here; **no catalogue field claims D2D distribution**, so nothing contradicts the platform |
| Site gates | **580/580 tests**, tsc clean |

No live database record asserts a state the platforms disprove.

---

## 9 · Research performed

Primary sources only.

- **KDP hardcover cover requirement** — taken verbatim from the rejection
  notice itself (0.716 in from outside edges; 0.4 in from the spine edge),
  which is the most specific authority available for this title.
- **KDP Cover Calculator**, read live 2026-09-20 for 6×9 hardcover at 232 pp.
- **KDP Print Previewer** hidden fields, which report the geometry KDP itself
  computed for the uploaded file.
- **D2D content policy** — the distributor's own written answer in case
  #1129140, plus the per-title block notices naming the channels.

---

## 10 · Adversarial review — it found three things

Run to disprove the fixes.

1. **"You re-uploaded the cover KDP already rejected."** True of the
   2026-09-19 upload, and that is how this incident was found: the rejection
   email's Previewer id matches the record. Now corrected.
2. **"The paperback changed when you touched the builder."** Its hash did
   change — but against a **Sep-11 packaged baseline that predates the spine
   fix**, and the differences were confined to x 614–658 px, the spine, with
   **zero** difference in the foot band. Building from the patched and
   unpatched sources gave **pixel-identical** paperbacks. Not caused by this
   change.
3. **"The barcode-safe file you uploaded was stamped from the old cover."**
   It would have been. The stamper reads the `KDP-PACKAGE` copy, which the
   rebuild does not refresh. Caught before upload; the package stage was
   refreshed and the stamper re-run.

Attacks that found nothing: embedded ISBNs vs registry (4/4 match), EPUB
validity (4/4 clean), publisher strings (4/4 canonical ASCII), daily-limit
breach (0 uploads), duplicate editions (none created), KDP geometry
(three independent sources agree).

---

## 11 · Exact remaining work

| Item | State | Owner |
|---|---|---|
| UES-01 hardcover (9798174550629), now at **v3**: AI attestation → Save and Continue → Rights & Pricing → Publish | **PENDING OWNER** | Founder |
| K-2 large print spine (9798174682702) | **CLOSED** — Live since 09-18 | — |
| K-3 World Games cover (9798194081950) | **CLOSED on KDP** — hardcover Live, nothing pending | — |
| K-4 Codex Mythologica hardcover (9798191248714): attestation → Save and Continue → publish the pending change | **PENDING OWNER** | Founder |
| K-5 Words from the Gods large print (9798174778559): attestation → Save and Continue → Rights & Pricing → Publish | **PENDING OWNER** | Founder |
| Whether to republish the World Games hardcover so the live edition carries the re-plated wrap — and the corrected spine width its own builder records | **DECISION** | Founder |
| Delist the PD-based works on D2D | **PENDING OWNER** | Founder |
| Whether to submit Words from the Gods alone | **PENDING OWNER** | Founder |

## 12 · Founder-only actions

1. **KDP**: tick the AI confirmation on `J4CX65CDZWM`, then Save and Continue
   → Rights & Pricing → Publish. The cover is fixed and approved.
2. **D2D**: decide on delisting. D2D asked for it in writing on 2026-09-19.
3. **D2D**: decide whether to ask, via case #1129140, if *Words from the Gods*
   is eligible — before uploading, not after.

## 13 · External pending

KDP Case #51717343 — **closed by Support as resolved, 2026-09-16.**
D2D case #1129140 — answered; open for further questions.

## 14 · Evidence and commands

```bash
# the defect, measured on the built wrap
pdftoppm -r 150 -png -singlefile <wrap>.pdf out
#   front-panel type at y=9.793 in of 10.417  → 0.624 in clear, needs 0.716

# after the fix
#   lowest type 0.744 in clear · barcode zone 243/255 · HasErrors false

# the paperback is untouched by the hardcover lift
#   build from patched and unpatched source → max pixel difference 0

# the four newest ISBNs
epubcheck <each canonical epub>     # 0 fatals / 0 errors / 0 warnings, 4/4
sha256sum <each>                    # matches ISBN-REGISTRY.md, 4/4
```
