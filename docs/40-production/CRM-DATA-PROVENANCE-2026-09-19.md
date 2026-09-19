# Contact-book data provenance — 2026-09-19

Where every address in the `contacts` table came from, and on what footing it
is held. This is the document to read before anyone writes a campaign.

---

## The headline, first

**Ninety contacts. Zero of them are marketing subscribers.**

```
not_marketing_contact   81
opted_out                4
unknown                  5
opted_in                 0
--------------------------
MAILABLE                 0      (opted in AND not suppressed)
```

Those figures are the sandbox import, which is where the schema and the
importer were proved. The same run against production will differ only in the
customer rows; the outreach block is identical because it comes from a file.

"Mailable" is deliberately the smallest number on the admin dashboard and the
only one that authorises anything. Every other count is a count of people the
press *knows of*.

---

## The rule the schema enforces

`contacts.marketing_consent` defaults to `unknown`, and
`scripts/crm/import-contacts.mjs` **refuses to run** if its output would
contain a single `opted_in` row — it checks, and exits non-zero. The only
writer of `opted_in` anywhere in the codebase is `recordOptIn()` in
`src/lib/db/contacts.ts`, which throws unless it is given the evidence —
which form, on which page, at what time — in the same call.

This is not caution for its own sake. Eighty-one of the ninety rows are
published professional addresses, each written to once about one specific
book, and each marked in its own source file:

> `PUBLIC_CONTACT: published professional address. NOT a newsletter subscriber.`

Mailing those as a list would be spam. The schema is built so it cannot
happen by accident.

### The four states, and why `opted_out` and `not_marketing_contact` are different

| State | Means | Example |
|---|---|---|
| `opted_in` | They asked to hear from us, on a form that said what they were agreeing to | A newsletter signup |
| `opted_out` | They **were asked** and said no, or later unsubscribed | The free-ebook form's unticked "email me about new books" box |
| `unknown` | We hold the address and nobody has ever asked | A customer; an account holder |
| `not_marketing_contact` | They were **never a candidate** — a press enquiry, a partner, a rights holder | The outreach file |

Collapsing the last two would make a future "re-ask the people who said no"
campaign mail eighty-one people who were never asked at all.

`unsubscribed` is a **separate column** from consent, on purpose. Consent is
what the person chose; the flag is whether a suppression is in force. An
unsubscribe sets both. A hard bounce or a complaint sets only the flag — and
must still stop the send.

---

## Source 1 — creator and press outreach (81 rows)

**File:** `MARKETING/VALICE-PRESS-AUDIENCE-MASTER.csv` (81 rows, 81 distinct
addresses, no duplicates)
**Written as:** `source: "outreach"`, `marketing_consent:
"not_marketing_contact"`
**Provenance kept:** the CSV's own `SOURCE` (`outreach CRM (T-nnn)`, which
points back at a row in `CREATOR-OUTREACH-MASTER.csv`), plus organisation and
role.

The file's own `CONSENT_STATUS` column reads `PUBLIC_CONTACT` on 80 rows and
`PARTNER` on 1. Neither is a subscription, so both import as
`not_marketing_contact`; the partner is additionally marked
`customer_status: "partner"` so the relationship is not lost.

**Three suppressions set.** Any row with `DO_NOT_CONTACT` filled in, or a
`RELATIONSHIP_STAGE` beginning `BOUNCED`, imports with `unsubscribed = true`.
Measured: 3 rows carry `DO_NOT_CONTACT = "YES - delivery failed"`, and the
stage column additionally holds `BOUNCED - ADDRESS DOES NOT EXIST`,
`BOUNCED - REROUTED` and `BOUNCED - ACCOUNT INACTIVE`.

---

## Source 2 — the free-ebook queue (7 rows in the sandbox)

**Table:** `free_book_requests`
**Written as:** `source: "free-book"`

This is the one historical source that carries a real, per-person answer: the
form had a box reading "email me about new books", and the row records whether
they ticked it.

- **Unticked → `opted_out`.** They were asked and they declined. Recording
  that as `unknown` would lose the decision and make them eligible for a
  future "we've never asked these people" campaign.
- **Ticked → `unknown`, NOT `opted_in`.** This is the deliberate part. What
  survives in the row is a boolean; the sentence the person actually agreed
  to was not stored beside it. An opt-in without its evidence is precisely
  what the contacts table refuses to hold, so the tick is recorded as a note
  on the row and the state stays `unknown`. Those people can be asked
  properly, once, and then they will be a real opt-in.

Going forward this gap is closed: `/api/newsletter` now writes the contact
through `recordOptIn()` with the consent sentence and the page verbatim, at
the moment of consent.

---

## Source 3 — customers and account holders (5 rows in the sandbox)

**Tables:** `users` left-joined to `orders` where `status = 'paid'`
**Written as:** `source: "customer"` (has paid orders) or `"account"` (none),
`marketing_consent: "unknown"`

A purchase is a transaction. Nobody agreed to anything beyond it. `purchased`
and `purchase_count` are set so the admin can filter to customers without
that being mistaken for permission.

---

## Deliberately NOT imported

**Resend's audience.** Resend holds the people who genuinely subscribed
through the site. They are not imported, because an import would have to
invent their `consent_source` — and a consent record whose provenance was
written by a script is not a consent record. They arrive in `contacts`
through the live newsletter route from now on, with the real evidence.

**Nothing from the ARC programme.** ARC recipients are a working relationship
with named individuals, handled in `MARKETING/outbound/`, not a list.

---

## Deduplication

Case-insensitively, on the trimmed, lowercased address, which is also the
table's unique key (`contacts_email_uk`). `email_raw` keeps the first
spelling seen, because an address is also how somebody writes their own name.

When the same person appears in more than one source, the merge only ever
**adds** facts: the first source keeps `source` and `source_detail`,
`purchased` ORs, `purchase_count` takes the maximum, a suppression from any
source sticks, and consent is only ever raised out of `unknown`. An import
cannot lower an existing state or clear a suppression.

93 rows across three sources became **90 unique contacts**.

---

## Where the data lives, and where it must not

| Thing | Location | Protection |
|---|---|---|
| The contact book | `contacts` table, production Postgres | Behind the app; no public route reads it |
| Admin view | `/admin/contacts` | Clerk proxy redirects unauthenticated requests to sign-in (verified: 307 to `accounts.valicepress.com`); the page calls `requireAdmin()` itself |
| CSV export | `/admin/contacts/export` | Same proxy, **plus its own `requireAdmin()`** returning 403; `no-store, private`; `X-Robots-Tag: noindex`; generated on demand and streamed — never written to disk |
| Local backup | `CRM/valicepress-email-backup-YYYY-MM-DD.json` | mode **0600**, and `/CRM/` is in `.gitignore` (verified with `git check-ignore`) |
| robots.txt | — | `/admin/` is already disallowed |

**Nothing in `CRM/` is ever committed.** A repository is a distribution
mechanism, and this is personal data.

---

## Re-running the import

```bash
# dry run — prints the consent breakdown and writes nothing
node scripts/crm/import-contacts.mjs

# against production (Founder: needs the production DATABASE_URL)
ENVFILE=<file with the production DATABASE_URL> \
  node scripts/crm/import-contacts.mjs --commit \
  --backup CRM/valicepress-email-backup-$(date +%F).json
```

It is idempotent. Re-running it cannot downgrade a consent state, cannot
clear a suppression, and cannot create an `opted_in` row.
