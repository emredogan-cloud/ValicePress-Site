"use client";

import { GiftBox } from "@/components/campaign/gift-box";
import type { FreeBookSubject } from "@/components/campaign/free-book-modal";

import { useCampaign } from "./use-campaign";

/**
 * The free-promotion strip on a book page: the sentence and the gift control,
 * as one thing that appears and disappears together.
 *
 * WHY THIS COMPONENT EXISTS. `<GiftBox>` correctly returns null once the
 * campaign window closes, but the box around it — the one that says "Free
 * during our limited-time promotion" — was rendered by the hero and had no
 * idea. Measured on 2026-09-13, the day after the campaign ended: every
 * deliverable book's page still advertised a free copy with nothing on the
 * page that could claim one. A promise with no control under it is worse than
 * no promise, and the restoration of the public-domain series would have put
 * that promise on twenty-seven pages instead of nine.
 *
 * The sentence and the control now share one condition, so they cannot
 * disagree again.
 */
export function GiftStrip({ book }: { book: FreeBookSubject }) {
  const { ready, open } = useCampaign();

  // `ready` guards hydration: the campaign window is decided against the
  // server clock, so rendering the strip before that lands would flash a
  // promise and then withdraw it.
  if (!ready || !open) return null;

  // A book this store holds no file for cannot be given away, and the strip
  // must not appear over a control that will hide itself. This is the same
  // question `<GiftBox>` asks; asking it here too keeps the box from
  // outliving its contents.
  if (!(book.deliverableFree ?? book.priceCents > 0)) return null;

  return (
    <div
      className="mt-5 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3"
      style={{
        borderColor: "rgba(214,178,102,0.3)",
        background: "rgba(214,178,102,0.06)",
      }}
    >
      <span className="text-[12.5px] leading-snug text-fg-mid">
        Free during our limited-time promotion
      </span>
      <GiftBox size="lg" book={book} />
    </div>
  );
}
