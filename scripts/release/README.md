# scripts/release — verifying a live deploy

Read-only (plain GETs and throw-away browsers; nothing is written to the site except cookies in those browsers). Written
for the 2026-10-09 release (`AUDIT/FINAL-RELEASE-REPORT-2026.md` §10–§11) and kept so the next one starts from a tested kit.

**Run them one at a time.** The live proxy rate-limits per IP (Upstash, 100 requests / 10 s — `src/lib/rate-limit.ts`) and the
phone shares your address: a crawl, a sweep and an axe run launched together are answered "Too many requests. Please slow down."
and every "failure" then measures that sentence. Read the body of a failure before believing it. Everything here marks its own
traffic as internal (`vp_internal=1` + `va-disable`, see `src/lib/internal-traffic.ts`) so analytics ignores it.

| Order | Tool | What it proves | 2026-10-09 |
|---|---|---|---|
| 1 | `node scripts/release/postdeploy-check.mjs --from <previously deployed commit> --to <deployed commit>` | key pages, sitemap = the published books, the draft absent, edition facts, the admin area refuses a stranger (pages and APIs), robots, headers, and **every file added / changed / deleted under `public/` compared byte for byte (sha256) with the repository at `--to`** | 49 / 49 |
| 2 | `node scripts/release/amazon-links.mjs` | each book page links exactly the ASINs the catalogue gives that book; no ASIN on two books; the draft has no page | 36 pages · 55 links · 0 problems |
| 3 | `node scripts/release/cart-isolation.mjs` | three brand-new browsers: no cart crosses from one visitor to another | 6 / 6 |
| 4 | `node scripts/release/axe.mjs` | axe-core, WCAG 2.2 AA + best practice, 21 pages at a desktop and a phone width (paced on a live origin) | 0 violations |
| 5 | `node scripts/seo/audit.mjs --base <origin>` · `node scripts/qa/desktop-sweep.mjs --base <origin> --strict --widths 1440 --pause 8000 --pages …` · `node scripts/catalog/validate-catalog.mjs --origin <origin>` | crawl · Chromium + Firefox console/network/CLS · catalogue against the live site | 0 errors · 0 page problems · 119 pass |
| 6 | the phone: `node scripts/mobile/mark-internal.mjs <origin>` once, then `MOBILE_PACE_MS=8000 npm run mobile:final -- --url <origin>`, `mobile:books`, `mobile:cwv -- --no-throttle` | the real finger, every book, Core Web Vitals; `node scripts/mobile/shifts.mjs <url> [--taps] [--throttle]` traces every layout shift with the node and rectangle that moved | 91 / 91 · 36 pages (36 popups after a cold-cache re-run) |

Two traps this kit hit: the Amazon verifier (`scripts/catalog/verify-amazon-asins.mjs`) is answered with a throttling stub and then a
CAPTCHA if the address has been used recently — stop, do not get round it; and a book's popup read 500 ms after it opens can fail
on a size the image optimizer has never been asked for (about 1 s cold) — re-run it warm before calling it a defect.
