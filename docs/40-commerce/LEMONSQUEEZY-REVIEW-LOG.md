# Lemon Squeezy — review log

## STATUS: **REVIEW PENDING**

No approval has been granted. Do not describe the store as approved, active or ready to sell
unless Lemon Squeezy states so explicitly.

---

## 2026-09-13 12:41 UTC — application acknowledged
From `hello@lemonsqueezy-mail.com`, subject *"Your application has been received: Valice Press"*.
Asked for product examples/demo videos and a business URL.

## 2026-09-13 12:45 UTC — Founder's first reply
Sent the storefront URL, a business overview and three product links.

## 2026-09-14 09:44 UTC — reviewer's follow-up (Mehvish Irshad, `hello@lemonsqueezy.com`)
Four specific questions:

1. A valid **website URL** showcasing the product
2. A **demo video or a sample** of the product in action — "user experience, functionality, and fulfilment"
3. A **detailed pricing plan**
4. A **brief description** of the product

> **Note for the record:** the internal brief described question 3 as a *delivery/fulfilment*
> plan. The reviewer's actual words are **"DETAILED PRICING PLAN"**. The reply answers pricing
> as asked, and covers fulfilment under question 2 where the reviewer raised it.

## 2026-09-14 — reply sent
Answered all four questions in order. Every URL HTTP-checked before sending; every figure taken
from the catalogue or the codebase, not from memory.

**What was claimed, and the evidence:**

| Claim | Evidence |
|---|---|
| Storefront and product pages live | HTTP 200 on `/`, three book pages, `/ebooks` |
| Interior sample viewable without purchase | "Look inside" on the World Games page serves 4 real interior pages |
| Free companion files download with no account | Two PDFs, HTTP 200, ~77 KB each |
| 27 digital editions, $4.99–$11.99, one-time | `valice-catalog.mjs` |
| Print is Amazon KDP and **not** sold via Lemon Squeezy | Catalogue format data; stated explicitly |
| Fulfilment is already built for Lemon Squeezy | `PAYMENT_PROVIDER` defaults to `lemonsqueezy`; webhook handler at `src/app/api/webhooks/lemonsqueezy`; `processPaidOrder` writes order + entitlement + watermark job |
| Terms, refund and privacy pages exist | HTTP 200 each |

**What was deliberately NOT claimed:**
- Not claimed that the checkout is live or has processed orders — it has not; activation is what is being applied for.
- Not claimed ownership of public-domain source texts. The reply distinguishes original works from annotated public-domain editions and describes the editorial contribution precisely.
- Paddle was not mentioned. There was no reason to raise it, and the reviewer did not ask.
- No demo video was fabricated. None exists, so the reply offers the live preview and real downloadable files as the "sample" the reviewer explicitly allowed as an alternative.

**NEXT ACTION:** await the reviewer's response. If approval requires a screen-recorded demo
specifically, record the real checkout-to-download flow in a test mode rather than mock it.
