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
| K-1 | *How the World Began* hardcover — front-cover text past the trim line | KDP | **RESOLVED — fixed at source, re-uploaded, previewer-approved** |
| K-2 | *How the World Began* large print — spine text too close to edges | KDP | **ACTIVE — not repaired this run** |
| K-3 | *The Great Book of World Games* — front cover past the trim line | KDP | **ACTIVE — not repaired this run** |
| K-4 | *Codex Mythologica* — front cover past the trim line (3 notices) | KDP | **ACTIVE — not repaired this run** |
| K-5 | *Words from the Gods* — cover text too close to edges (2 notices) | KDP | **ACTIVE — not repaired this run** |
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
| KDP Previewer | **`HasErrors: false`** |
| Previewer guides | imprint sits **above** the guide line (was crossing it) |
| Approval persisted | **"Please preview and approve these changes" cleared** |
| Survives reload | cover `v2` and the approval both persist |

**Final KDP state: files uploaded, Previewer approved, NOT submitted.** The
only remaining control is the owner's AI-content attestation ("By clicking
this, I confirm that my answers are accurate"), which keeps *Save and
Continue* disabled. That is a legal attestation and was not ticked.

---

## 4 · KDP incidents K-2 … K-5 — ACTIVE, not repaired

Four notices across three other titles remain open. They were **triaged, not
fixed**, and this report does not claim otherwise.

K-3, K-4 and K-5 are the same defect class as K-1 (front-cover or cover text
inside the keep-out). K-2 is a **spine** variant on the large print. Each lives
in a different book project with its own cover builder, so each needs the same
measure → root-cause → rebuild → preview cycle that K-1 received. The method is
now proven and is written down above; what is missing is the work.

**Do not assume the K-1 patch fixes them.** It is scoped to UES-01's builder
and to the hardcover binding.

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
| UES-01 hardcover: AI attestation → Save and Continue → Rights & Pricing → Publish | **PENDING OWNER** | Founder |
| K-2 large print spine (9798174682702) | **ACTIVE** | next run |
| K-3 World Games cover (9798194081950) | **ACTIVE** | next run |
| K-4 Codex Mythologica cover (9798191248714) | **ACTIVE** | next run |
| K-5 Words from the Gods cover (9798174778559) | **ACTIVE** | next run |
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
