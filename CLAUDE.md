# Valice Press — Agent Instructions

## Architecture & Stack
- Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
- PostgreSQL on Neon (serverless) with Drizzle ORM + drizzle-kit.
- Cloudflare R2 for zero-egress file storage.
- Inngest/Vercel Queues for async watermarking.

## File Layout
- `src/app/` - Next.js routes (SSG/ISR first).
- `src/components/` - Reusable UI components.
- `src/lib/` - Core business logic and DB access.
- `src/lib/db/` - Drizzle schema, relations, the Neon client (`db`), and per-entity helpers (e.g., `users.ts` JIT upsert).
- `src/lib/storage/` - Cloudflare R2 S3-compatible client and signed-URL utilities (ADR-6).
- `src/lib/auth.ts` - Clerk-backed server-side auth helpers (ADR-8).
- `src/proxy.ts` - Clerk proxy (Next.js 16 file convention): route protection for /account, /read, /admin (ADR-8).
- `drizzle/` - Generated SQL migrations (committed; applied by `db:migrate`).
- `memory/` - Agent's long-term memory and ADRs.
- `scripts/` - Composable utility scripts.
- `scripts/catalog/` - The catalog as source-controlled data, plus its loader
  and the operational scripts that provision Paddle, cut digital editions,
  upload masters and render previews. **`valice-catalog.mjs` is the source of
  truth for what this store sells.** Never edit catalog rows in the database.
- `docs/60-architecture/BONUS_SCENE_LEAD_MAGNET_ARCHITECTURE_TR.md` - Complete
  guide for building bonus scene landing pages, MailerLite groups, and BookFunnel funnels.

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Test: `npm test`
- Build: `npm run build`
- DB generate migrations: `npm run db:generate`
- DB apply migrations: `npm run db:migrate`
- DB push (dev convenience only): `npm run db:push`
- DB browser (Drizzle Studio): `npm run db:studio`

## Catalog rules (see `memory/PAST_DECISIONS.md` for the full list)
- **Publication is data.** A book goes live because `websiteStatus:
  "published"` is written next to its blockers in `valice-catalog.mjs`, then
  `load-catalog.mjs` applies it. The loader demotes as well as promotes.
- **Never invent a fact about a book.** No ASIN without a live KDP edition, no
  price you cannot point at, no rating without a review, no cover you have not
  seen. `valice-catalog.test.ts` enforces most of this; the loader refuses to
  write a catalog that fails the same checks.
- **KDP Select is exclusivity.** A Select-enrolled book's ebook may not be sold
  here. A test asserts it — do not weaken that test.
- **`price_cents = 0` means "not sold here", not "free".** Use
  `formatCatalogPrice`, and emit no JSON-LD Offer.
- Catalog scripts are dry-run by default and refuse to touch production
  without an explicit flag. Keep it that way.

## Verifying integrations
Presence checks lie. Four of five providers were once configured with a
wrong-but-plausible value that `process.env.X !== undefined` accepted. Verify
by making the system do the thing:
- Paddle: `provision-paddle.mjs` (dry run) lists live products, prices and the
  webhook's subscribed events.
- Inngest: `PUT /api/inngest` must return `{"message":"Successfully registered"}`.
- Resend: send to the account owner's address and read the delivery log.
- R2: list and write to both buckets.

## Agent Workflow Rules
- Read before Write: Always `Read` or `Grep` a file before attempting to `Edit` it to avoid stale diffs.
- Verification: Always run `npm run lint`, `npx tsc --noEmit`, and `npm run build` after making structural changes. For schema changes, also run `npm run db:generate`.
- Memory: Consult `memory/PAST_DECISIONS.md` before making architectural suggestions.
- Do not use generic placeholders; write complete, functional code.
