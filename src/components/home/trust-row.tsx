import { Download, FileCheck, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";

/**
 * The four promises under the hero.
 *
 * One row spanning the full width of the section rather than wrapping inside
 * the text column — they run under the photograph, which is what stops them
 * reading as a footnote to the copy and makes them read as terms of the shop.
 *
 * They are a list of claims, not decoration, so they stay in the accessibility
 * tree and keep real contrast. Each is a claim about how the store is built:
 * delivery is immediate, there is no DRM and no expiry, and checkout runs through
 * a merchant of record.
 *
 * THE FIRST ONE USED TO SAY "Watermark-free PDF". It was not true: the delivery
 * pipeline (`stampPdfWithWatermark`, src/inngest/functions/watermark.ts) draws
 * "Licensed to <name> · Order <id> · Valice Press" in the footer of every page —
 * small and grey, but visible, and the About page rightly says "watermarked". The
 * claim that IS true, and is what a reader actually cares about, is that the file
 * has no DRM.
 */
export function TrustRow() {
  const items = [
    { icon: FileCheck, label: "DRM-free PDF" },
    { icon: Download, label: "Instant Download" },
    { icon: InfinityIcon, label: "Yours to Keep" },
    { icon: ShieldCheck, label: "Secure Payments" },
  ];

  return (
    <ul className="mt-10 grid max-w-[560px] grid-cols-2 gap-x-6 gap-y-4 sm:mt-14 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:gap-x-9 lg:mt-16">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li
            key={item.label}
            className="group flex items-center gap-2.5 text-[13px] text-fg-mid transition-colors hover:text-fg-hi sm:text-sm"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] transition-all group-hover:border-emerald-deep/40 group-hover:bg-emerald-deep/10">
              <Icon
                aria-hidden
                className="h-3.5 w-3.5 text-emerald-bright transition-transform group-hover:scale-110"
              />
            </span>
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}
