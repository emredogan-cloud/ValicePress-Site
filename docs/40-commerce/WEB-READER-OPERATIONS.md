# Running the private reader

Operational notes for whoever is holding the pager. Deployment specifics live
in the architecture document; this is what to *do*.

---

## "I bought the book but I can't open it"

**Go to `/admin/support` and look them up by the email on their account.**

The page walks the chain in the order it fails and prints the sentence rather
than making you read six columns:

| What it says | What to do |
|---|---|
| No account for that address | They bought under a different email, or the spelling is off. Check the provider's dashboard for an order under that address. |
| Account exists, no entitlements | The payment reached the provider but never became an order here. Check the webhook delivery log for their order reference. |
| No artifact and no watermark job | Fulfilment never ran for this book. Re-trigger it. |
| Queued but not started | If it is more than a few minutes old, the worker is not picking it up — check Inngest. |
| The watermark failed after *n* attempts | This is the problem. The error is printed below the row. |
| Ready and never opened | Nothing is wrong on our side. Send them `/account/library`. |
| Ready, and they have opened it | The problem is in their browser or session, not the entitlement. |
| Refunded / Revoked | Working as intended. |

The page also prints that account's last ten reader decisions, so a customer
who says "it just says not found" can be checked against what the gate actually
answered.

**It shows state, never access.** There is no control anywhere on it that opens
a customer's book, and there should never be one — it would be the only
impersonation path in the system, and the operator does not need it to answer
the question.

---

## "Is somebody probing us?"

The same page prints reader decisions for the last 24 hours, by kind.

- A handful of `denied_not_ready` is a normal day — customers reload while a
  watermark runs.
- A run of `denied_not_owned` is not normal. That is the shape enumeration
  takes here, and the page says so above 20.

To see which account:

```sql
select user_id, count(*), min(created_at), max(created_at)
  from reader_access_events
 where outcome = 'denied_not_owned'
   and created_at > now() - interval '24 hours'
 group by user_id
 order by 2 desc;
```

A `user_id` of null means the refusals carried no session at all.

The denial throttle already bounds this at 10 refusals a minute per identity;
the query is for deciding whether to act, not for stopping it.

---

## Re-running fulfilment for one entitlement

The watermark worker is idempotent: a `ready` entitlement with an artifact key
short-circuits and spends no attempt. So re-running is safe.

```bash
node scripts/reader/grant-entitlement.mjs --list <email>
```

That prints every entitlement, its status, whether the PDF and EPUB exist, the
order reference, and when they last read it.

---

## Test entitlements

```bash
# dry run — prints what it would do, writes nothing
node scripts/reader/grant-entitlement.mjs <email> <slug> [<slug>…]

# do it
node scripts/reader/grant-entitlement.mjs <email> <slug> --commit

# take it away again
node scripts/reader/grant-entitlement.mjs --revoke <email> <slug> --commit
```

Targets `.env.local` (the **sandbox**) unless `--env` says otherwise, and
prints the database name before doing anything. Check that line.

Rows it creates carry a `test-grant-` order reference, so they are findable and
can never be mistaken for revenue.

**This is a script, not an endpoint.** There is no code path in the deployed
site that reaches it, and no flag or header the application honours. Deleting
the file removes nothing from production.

---

## Running the security audit

```bash
node scripts/reader/security-audit.mjs --seed                    # fixtures
node scripts/reader/security-audit.mjs --base https://host       # run
node scripts/reader/security-audit.mjs --clean                   # tidy up
```

It builds two real accounts with two real watermarked books and runs 42 checks.
Without `--base` it runs the 28 database-level checks only.

Run it after any change to `reader-access.ts`, `ownership.ts`, the asset route,
or the proxy's route matcher.

---

## Two traps this project has already fallen into

**You may be measuring a stale build.** A `next start` that loses the port to an
already-running server exits with `EADDRINUSE` — and if you backgrounded it, you
will not see that, and every request you make goes to the old build. This cost
an hour during the reader's own audit: a route that returned 404 because the
server answering had never heard of it. Check the port is yours before believing
a result.

**A hidden tab is not a browser.** Chrome suspends `requestAnimationFrame` in a
backgrounded or occluded tab. Any animation that triggers on rAF simply will not
run there, and pdf.js work is deprioritised too. Automation drives hidden tabs,
so an animation that "does not fire" under automation may be perfectly correct.
The reader now co-triggers on a timeout precisely so it degrades cleanly in that
case — but when *measuring*, use a visible window or a real device.

---

## Data retention (§61)

| Table | Holds | Kept |
|---|---|---|
| `reading_progress` | one row per (user, book): page, percent, timestamp | while the entitlement exists; removed with the account |
| `bookmarks` | one row per (user, book, page), optional label | same |
| `reader_access_events` | outcome, local user id, the book reference as supplied, a short reason | **prune beyond 90 days** — see below |
| `entitlements.last_read_at` | one timestamp | with the entitlement |

The audit table holds no IP address, no user agent, no URL and no email. It is
the only table here that grows without bound, and nothing prunes it yet:

```sql
delete from reader_access_events where created_at < now() - interval '90 days';
```

Ninety days is longer than any support question and shorter than a reading
history. Wiring this to a cron job is an open item.

Account deletion already cascades `reading_progress` and `bookmarks`; audit rows
have their `user_id` set to null rather than being deleted, so the counts
survive without naming anyone.

---

## What to do in an incident

**A book is circulating that should not be.** The artifact carries the buyer's
name and short order id in a footer on every page. Read it, find the order, and
decide. Revoking is `entitlements.status = 'revoked'`, which closes the reader
on the next request — there is no cached grant to wait out.

**R2 credentials are suspected leaked.** Rotate the keys in Vercel. The reader
mints signed URLs per request with a 15-minute ceiling, so no long-lived
credential is outstanding. Old artifacts are unaffected; they are objects, not
URLs.

**A customer's session is suspected stolen.** Revoke it in Clerk. The gate runs
per request, so access ends at the next range request rather than at the end of
a cached session.

**The webhook starts returning 503.** The signing secret is unset. No orders are
being fulfilled. This is currently the live state — see the manifest's blocker
table.
