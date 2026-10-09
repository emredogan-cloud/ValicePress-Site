"use client";

import { useEffect } from "react";

/**
 * The `src` of an image whose file has not been asked for yet: a 1×1 transparent GIF, inline, so putting it
 * in the markup costs no request. The real address travels beside it in `data-src` (and `data-srcset`).
 */
export const DEFERRED_IMAGE_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * Asks for the files of the images marked `data-src` only when they are about to be SEEN.
 *
 * WHY NOT `loading="lazy"`. On a slow link Chrome widens how far from the screen a lazy image may be before it
 * is fetched (a few thousand pixels on a connection it rates as 3G), so the twelve covers on the home page's
 * shelf — 550 kB, far below the first screen — were requested 1.7 s in, sharing the link with the hero
 * photograph, which is the page's largest paint. Measured on the Redmi at 1.6 Mbps / 70 ms (`npm run
 * mobile:trace`): the hero landed at 4.96 s with them, 4.1 s without them. `fetchpriority="low"` did not move
 * it over HTTP/1.1, which shares the link between requests whatever their priority. Asking for an image when it is
 * about to enter the screen does, on every protocol.
 *
 * HOW. Server-rendered markup carries `src={DEFERRED_IMAGE_PLACEHOLDER}` and `data-src`; this renders nothing and,
 * once mounted, watches every such image on the page with one `IntersectionObserver`, swapping the real address in
 * when the image is within `rootMargin` of the screen. A browser with no `IntersectionObserver` gets every image
 * on the next tick — slower, never missing. Without JavaScript the placeholder would stay, so the server also
 * renders the real `<img>` inside a `<noscript>`.
 */
export function ImageDeferrer({ rootMargin = "250px 200px" }: { rootMargin?: string }) {
  useEffect(() => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-src]"));
    if (images.length === 0) return;

    const reveal = (img: HTMLImageElement) => {
      const { src, srcset } = img.dataset;
      if (srcset) img.srcset = srcset;
      if (src) img.src = src;
      img.removeAttribute("data-src");
      img.removeAttribute("data-srcset");
    };

    if (!("IntersectionObserver" in window)) {
      const t = setTimeout(() => images.forEach(reveal), 0);
      return () => clearTimeout(t);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          reveal(e.target as HTMLImageElement);
          io.unobserve(e.target);
        }
      },
      { rootMargin },
    );
    images.forEach((img) => io.observe(img));
    return () => io.disconnect();
  }, [rootMargin]);

  return null;
}
