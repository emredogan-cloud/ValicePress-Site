#!/usr/bin/env bash
#
# The one command that finishes everything blocked on the production database.
#
# ── WHY THIS SCRIPT EXISTS ──────────────────────────────────────────────────
# `DATABASE_URL` is a Vercel *Sensitive* variable. Measured, not assumed: the
# Vercel API returns it as `type: "sensitive"`, `value: ""`, `decrypted: false`,
# and `vercel env pull` writes the literal string `[SENSITIVE]` in its place.
# No CLI, API or dashboard hands it back — that is the point of the type, not a
# gap to be worked around. So an agent cannot run these three steps, and the
# account holder can. This script is the whole of what they have to do.
#
# It is DRY RUN by default, like every other script in this repository.
#
#   ENVFILE=<file with the production DATABASE_URL> scripts/db/founder-apply.sh
#   ENVFILE=<same file> scripts/db/founder-apply.sh --commit
#
# ── WHAT IT DOES, IN ORDER, AND WHY THE ORDER MATTERS ───────────────────────
#   1. MIGRATE   0013 — creates `contacts` and `popup_impressions`.
#   2. LOAD      the catalogue — wires the two products created on 2026-09-19
#                (Puzzles Old and New, Words from the Gods) into the two books
#                that have been showing "not on sale here" ever since.
#   3. IMPORT    the contact book. LAST, because it writes into `contacts`,
#                which step 1 creates. Running it first fails loudly rather
#                than silently, but there is no reason to make it fail.
#
# Every step verifies itself by reading the database back. None of them trusts
# an exit code: `drizzle-kit migrate` on this project has exited 0 having
# applied nothing, twice.
#
# ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
# It sends no email. The ARC check-in is deliberately deferred to 2026-09-24
# and is a separate, manual act. Importing contacts touches no outbound path.
#
# It cannot create an opted-in contact: `import-contacts.mjs` checks its own
# output and exits non-zero if a single `opted_in` row would be written.
set -euo pipefail

COMMIT=""
for arg in "$@"; do
  [ "$arg" = "--commit" ] && COMMIT="--commit"
done

if [ -z "${ENVFILE:-}" ]; then
  echo "ENVFILE is not set."
  echo
  echo "  ENVFILE=/path/to/env-with-production-DATABASE_URL $0 [--commit]"
  echo
  echo "The file needs one line: DATABASE_URL=postgres://…"
  exit 1
fi

if [ ! -f "$ENVFILE" ]; then
  echo "No such file: $ENVFILE"
  exit 1
fi

# A redaction is not a value. This repository has already spent a session
# treating the literal string [SENSITIVE] as a connection string.
if grep -q '^DATABASE_URL=\[SENSITIVE\]' "$ENVFILE"; then
  echo "REFUSING TO RUN: $ENVFILE has DATABASE_URL=[SENSITIVE]."
  echo "That is what 'vercel env pull' writes for a Sensitive variable — a"
  echo "redaction, not a credential. Use the real connection string from Neon."
  exit 1
fi

if [ -z "$COMMIT" ]; then
  echo "════════════════════════════════════════════════════════════"
  echo "  DRY RUN. Nothing will be written. Add --commit to apply."
  echo "════════════════════════════════════════════════════════════"
  echo
fi

echo "──────── 1/3 · migration 0013 (contacts, popup_impressions) ────────"
if [ -n "$COMMIT" ]; then
  ENVFILE="$ENVFILE" node scripts/db/apply-migration.mjs drizzle/0013_long_slayback.sql
else
  echo "  would run: node scripts/db/apply-migration.mjs drizzle/0013_long_slayback.sql"
  echo "  (it names the database out loud before touching it, runs each"
  echo "   statement independently, and reads information_schema back)"
fi
echo

echo "──────── 2/3 · catalogue → production ────────"
echo "  This is what makes Puzzles Old and New and Words from the Gods"
echo "  buyable on valicepress.com. Both Lemon Squeezy products are already"
echo "  live and were verified from the public checkout on 2026-09-20."
node scripts/catalog/load-catalog.mjs $COMMIT --env "$ENVFILE"
echo

echo "──────── 3/3 · contact book ────────"
if [ -n "$COMMIT" ]; then
  mkdir -p CRM
  ENVFILE="$ENVFILE" node scripts/crm/import-contacts.mjs --commit \
    --backup "CRM/valicepress-email-backup-$(date +%F).json"
else
  ENVFILE="$ENVFILE" node scripts/crm/import-contacts.mjs
fi
echo

echo "──────── verify ────────"
echo "Expected after a --commit run:"
echo "  · contacts: 81 not_marketing_contact · 4 opted_out · 5 unknown · 0 opted_in"
echo "  · MAILABLE: 0   (nobody has ever opted in; that is the correct answer)"
echo "  · load-catalog summary: BUYABLE 29"
echo "  · https://valicepress.com/books/puzzles-old-and-new shows a buy route"
echo "  · https://valicepress.com/api/popup returns {\"eligible\":true,…} in a"
echo "    browser with no vp_np cookie"
