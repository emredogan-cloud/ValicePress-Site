/**
 * Helpers for the `sizes` attribute of responsive images.
 *
 * `sizes` is a promise to the browser about how wide the image will be DRAWN, made before layout, so
 * that it can pick the smallest file that is sharp enough. A promise that is too big is not wrong, it is
 * expensive: the browser trusts it and downloads a file several times larger than the pixels it will
 * paint. Two components were promising the width of their container for pictures that fill a fraction of it:
 * the fan of covers on a category card (each cover is 38% of the card) and the "Look inside" strip (a page is
 * 150px wide in a strip as wide as the screen) — and a phone fetched 1080px files for 140px slots.
 */

/** The comma-separated terms of a `sizes` value, split only at the top level (not inside min(…, …)). */
function splitTerms(sizes: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < sizes.length; i++) {
    const c = sizes[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(sizes.slice(from, i));
      from = i + 1;
    }
  }
  out.push(sizes.slice(from));
  return out.map((t) => t.trim()).filter(Boolean);
}

/**
 * `sizes` for something that fills `factor` of the box `sizes` describes: every length in it, times
 * `factor`, with its media conditions kept. `scaleSizes("(min-width: 1024px) 34vw, 90vw", 0.38)` is
 * `"(min-width: 1024px) calc(34vw * 0.38), calc(90vw * 0.38)"`.
 */
export function scaleSizes(sizes: string, factor: number): string {
  return splitTerms(sizes)
    .map((term) => {
      // the length is the last token at the top level; what precedes it is the media condition
      let depth = 0;
      let cut = -1;
      for (let i = term.length - 1; i >= 0; i--) {
        const c = term[i];
        if (c === ")") depth++;
        else if (c === "(") depth--;
        else if (/\s/.test(c) && depth === 0) {
          cut = i;
          break;
        }
      }
      const media = cut >= 0 ? term.slice(0, cut).trim() : "";
      const length = cut >= 0 ? term.slice(cut + 1).trim() : term;
      return `${media ? `${media} ` : ""}calc(${length} * ${factor})`;
    })
    .join(", ");
}
