# Lemon Squeezy review — sources consulted

**Date:** 2026-09-14 · Consulted before replying to the reviewer (Mehvish Irshad).

## First-party Lemon Squeezy sources

| Source | URL | What it established |
|---|---|---|
| Activate Your Store | `docs.lemonsqueezy.com/help/getting-started/activate-your-store` | Every store is reviewed with KYC/KYB checks; products must align with the terms and acceptable-use policies. |
| Prohibited Products | `docs.lemonsqueezy.com/help/getting-started/prohibited-products` | **Prohibited: products for which you do not hold proper intellectual-property rights, and Private Label Rights (PLR) / Master Resell Rights (MRR) products.** Also services. |
| Sell Digital Products | `lemonsqueezy.com/ecommerce/digital-products` | **eBooks and PDFs are explicitly among the approved product types**, alongside design assets, photos, audio and video. |
| Merchant of Record | `docs.lemonsqueezy.com/help/payments/merchant-of-record` | Lemon Squeezy acts as merchant of record and handles digital sales tax and compliance. |
| Marketplace Guidelines | `docs.lemonsqueezy.com/help/marketplace/guidelines` | General quality expectations. |

**Note:** `docs.lemonsqueezy.com/help/getting-started/how-to-get-approved` returned **403** to
automated fetching; the equivalent content was obtained from the activate-your-store and
prohibited-products pages above.

## The two findings that shaped the reply

1. **Lemon Squeezy does not approve stores selling goods fulfilled outside Lemon Squeezy**
   (physical goods, services). → The reply states plainly that **print editions are fulfilled
   by Amazon KDP and are not sold through Lemon Squeezy**, and that only digital editions would
   pass through their checkout.

2. **PLR / Master Resell Rights products are prohibited, as are products without proper IP
   rights.** → The reply distinguishes, without overclaiming, between Valice Press's **original
   works** and its **annotated editions of public-domain texts**, where the copyrightable
   contribution is the editorial apparatus, selection, typesetting and commentary — not the
   underlying historical source. This is the honest framing and it is also the distinction the
   prohibition is aimed at.

## Claims verified against the live site before sending

| Claim | Check | Result |
|---|---|---|
| Storefront live | `GET valicepress.com` | 200 |
| Product pages live | 3 book URLs | 200 each |
| "Look inside" preview exists | World Games page | 4 interior pages served (p16–p19) |
| Free companion downloads, no login | `/companion/world-games/game-index.pdf`, `score-sheets.pdf` | 200, ~77 KB each |
| Terms / Refund / Privacy | `/terms`, `/refund`, `/privacy` | 200 each |
| Price band | `valice-catalog.mjs` | 27 digital editions, **$4.99 – $11.99**, one-time |
| Fulfilment pipeline | `src/lib/fulfillment.ts`, `src/app/api/webhooks/lemonsqueezy`, `src/lib/payments/index.ts` | Lemon Squeezy is already the **default** provider; webhook → order → entitlement → watermark job → download |

**A path that was NOT cited:** `/companion/world-games/rule-cards.pdf` returns **404** — that
file lives under `/companion/play-anywhere/`. Caught before sending.
