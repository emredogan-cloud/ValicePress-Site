/**
 * Every picture the scene paints for itself, and the loader for the ones it
 * does not: the covers.
 *
 * NOTHING HERE IS AN IMAGE FILE. The column's wood, the bands with each
 * shelf's name, the cove light and the floor are drawn on a 2D canvas when the
 * scene starts, from the palette — a few milliseconds, no download, and no
 * picture of anything that is not in the catalogue. The only files the scene
 * fetches are the covers, the same 432 px thumbs the homepage shelf draws.
 *
 * The names painted on the bands are decoration: the canvas is `aria-hidden`,
 * and the readable name is the HTML rail's.
 */
import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";

import { LIBRARY_PALETTE } from "../palette";

export type Quality = "high" | "low";

/** A deterministic pseudo-random sequence, so every visit paints the same grain. */
function grain(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, anisotropy = 1): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

/**
 * One tier's height of the column's core, and one pilaster's width round it;
 * the mesh repeats it. Warm just under the band above, where the cove light
 * falls, and dark down at the board — the light pools the way it does in the
 * reference, without a light or a shadow map to compute it.
 */
export function coreTexture(quality: Quality): CanvasTexture {
  const [c, ctx] = quality === "high" ? canvas(256, 512) : canvas(128, 256);
  const { width: w, height: h } = c;
  const fall = ctx.createLinearGradient(0, 0, 0, h);
  fall.addColorStop(0, "#6b4626");
  fall.addColorStop(0.12, "#4a2f19");
  fall.addColorStop(0.5, "#24170d");
  fall.addColorStop(1, "#0f0a06");
  ctx.fillStyle = fall;
  ctx.fillRect(0, 0, w, h);

  const rand = grain(7);
  for (let i = 0; i < w; i += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.1})`;
    ctx.fillRect(i, 0, 1, h);
  }

  // A pilaster: a flat strip standing a little proud, catching the light on its edges.
  const p0 = w * 0.39;
  const pw = w * 0.22;
  ctx.fillStyle = "rgba(255,214,150,0.05)";
  ctx.fillRect(p0, 0, pw, h);
  ctx.fillStyle = "rgba(255,226,170,0.16)";
  ctx.fillRect(p0, 0, Math.max(1, w * 0.012), h);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(p0 + pw, 0, Math.max(1, w * 0.016), h);

  const t = finish(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

/** A four-pointed star, the ornament either side of a shelf's name. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    const rr = k % 2 === 0 ? r : r * 0.3;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** Text with even letter spacing, centred on `cx`; returns its width. `letterSpacing` on a 2D context is not everywhere yet. */
function spacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, spacing: number): number {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, cy);
    x += widths[i] + spacing;
  });
  return total;
}

/**
 * Every band's face, one row each, in one texture: a band per shelf with the
 * shelf's name centred on the canvas (which `structure.tsx` turns to face the
 * shelf), and one plain band under the last shelf. One texture, so all the
 * bands are one draw call.
 */
export function bandAtlas(
  names: readonly (string | null)[],
  fontFamily: string,
  quality: Quality,
  anisotropy: number,
): CanvasTexture {
  const width = quality === "high" ? 4096 : 2048;
  const rowHeight = quality === "high" ? 72 : 36;
  const [c, ctx] = canvas(width, rowHeight * names.length);
  const rand = grain(11);

  names.forEach((name, row) => {
    const y0 = row * rowHeight;
    const lacquer = ctx.createLinearGradient(0, y0, 0, y0 + rowHeight);
    lacquer.addColorStop(0, "#4a3220");
    lacquer.addColorStop(0.16, LIBRARY_PALETTE.wood);
    lacquer.addColorStop(0.84, "#1d130b");
    lacquer.addColorStop(1, "#0d0805");
    ctx.fillStyle = lacquer;
    ctx.fillRect(0, y0, width, rowHeight);
    for (let x = 0; x < width; x += 3) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.08})`;
      ctx.fillRect(x, y0, 2, rowHeight);
    }
    // Brass mouldings along both edges.
    ctx.fillStyle = LIBRARY_PALETTE.brass;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, y0 + rowHeight * 0.06, width, Math.max(1, rowHeight * 0.035));
    ctx.fillRect(0, y0 + rowHeight * 0.9, width, Math.max(1, rowHeight * 0.03));
    ctx.globalAlpha = 1;

    if (!name) return;
    const cy = y0 + rowHeight * 0.52;
    const size = rowHeight * 0.36;
    ctx.font = `600 ${size}px ${fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = LIBRARY_PALETTE.gold;
    ctx.shadowColor = "rgba(251, 236, 170, 0.55)";
    ctx.shadowBlur = rowHeight * 0.12;
    const textWidth = spacedText(ctx, name.toUpperCase(), width / 2, cy, size * 0.32);
    const gap = size * 1.1;
    star(ctx, width / 2 - textWidth / 2 - gap, cy, size * 0.42);
    star(ctx, width / 2 + textWidth / 2 + gap, cy, size * 0.42);
    ctx.shadowBlur = 0;
    // Hairlines running out from the ornaments, fading round the band.
    for (const dir of [-1, 1]) {
      const from = width / 2 + dir * (textWidth / 2 + gap * 1.8);
      const to = from + dir * width * 0.06;
      const rule = ctx.createLinearGradient(from, 0, to, 0);
      rule.addColorStop(0, "rgba(201,162,92,0.8)");
      rule.addColorStop(1, "rgba(201,162,92,0)");
      ctx.fillStyle = rule;
      ctx.fillRect(Math.min(from, to), cy - 0.5, Math.abs(to - from), Math.max(1, rowHeight * 0.02));
    }
  });

  const t = finish(c, anisotropy);
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

/** The warm glow on the underside of a band: brightest at the rim, where the strip is. */
export function coveGlowTexture(): CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(30,18,10,1)");
  g.addColorStop(0.8, "rgba(74,46,22,1)");
  g.addColorStop(0.94, "rgba(214,168,104,1)");
  g.addColorStop(1, "rgba(240,206,146,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finish(c);
}

/**
 * The floor the column stands on: polished dark stone with brass inlay rings,
 * and the warm pool of light the column throws on it.
 */
export function floorTexture(quality: Quality, floorRadius: number): CanvasTexture {
  const size = quality === "high" ? 1024 : 512;
  const [c, ctx] = canvas(size, size);
  const mid = size / 2;
  /** World units from the column's axis → canvas pixels from its centre. */
  const px = (r: number) => (r / floorRadius) * mid;
  const stone = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  stone.addColorStop(0, "#4d3927");
  stone.addColorStop(px(3.4) / mid, "#3a2b1e");
  stone.addColorStop(px(6) / mid, "#1d1610");
  stone.addColorStop(px(11) / mid, "#120e0b");
  stone.addColorStop(1, LIBRARY_PALETTE.ground);
  ctx.fillStyle = stone;
  ctx.fillRect(0, 0, size, size);
  // Brass inlay: a close pair round the plinth, then wider rings out into the room.
  ctx.strokeStyle = LIBRARY_PALETTE.brass;
  for (const [r, alpha, width] of [
    [2.95, 0.6, 0.035],
    [3.2, 0.4, 0.02],
    [4.6, 0.32, 0.03],
    [6.4, 0.22, 0.03],
    [9.2, 0.12, 0.04],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(1, px(width));
    ctx.beginPath();
    ctx.arc(mid, mid, px(r), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finish(c);
}

/* -------------------------------------------------------------- the covers */

interface Job {
  src: string;
  priority: number;
  resolve: (image: ImageBitmap | HTMLImageElement) => void;
  reject: (reason: unknown) => void;
  signal: AbortSignal;
}

const queue: Job[] = [];
let running = 0;
/** Enough to keep a slow link busy without letting thirty-six requests race the page's own. */
const CONCURRENCY = 4;

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    queue.sort((a, b) => a.priority - b.priority);
    const job = queue.shift() as Job;
    if (job.signal.aborted) {
      job.reject(job.signal.reason);
      continue;
    }
    running++;
    decode(job.src, job.signal)
      .then(job.resolve, job.reject)
      .finally(() => {
        running--;
        pump();
      });
  }
}

/**
 * The file a cover is drawn from. A front cover is drawn about 100 CSS px wide
 * on a desktop and 90 on a phone, so:
 *   - a high-density desktop screen (more than 1.25 device pixels per CSS
 *     pixel) gets the 432 px thumb built for the homepage shelf — about twice
 *     the pixels it shows;
 *   - everything else gets a 256 px copy from the site's own image optimiser:
 *     measured 21.5 kB against the thumb's 53.3 kB for the same cover, under
 *     half the GPU memory, and still 2.5× the pixels of a 1× desktop's cover.
 * Sending the thumb to a 1× screen was 4.3× the pixels it could show — waste
 * with no quality to lose (the rule `scripts/perf/page-weight.mjs` applies).
 */
export function coverTextureSrc(
  book: { textureSrc: string | null; item: { coverSrc?: string | null } },
  quality: Quality,
  devicePixelRatio: number,
): string | null {
  if ((quality === "low" || devicePixelRatio <= 1.25) && book.item.coverSrc) {
    return `/_next/image?url=${encodeURIComponent(book.item.coverSrc)}&w=256&q=75`;
  }
  return book.textureSrc;
}

/** Decode off the main thread where the browser can; a bitmap is flipped as it decodes, which WebGL needs. */
async function decode(src: string, signal: AbortSignal): Promise<ImageBitmap | HTMLImageElement> {
  const res = await fetch(src, { signal, headers: { accept: "image/webp,image/*" } });
  if (!res.ok) throw new Error(`cover ${src}: HTTP ${res.status}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, { imageOrientation: "flipY" });
    } catch {
      // An older engine that knows createImageBitmap but not its options: fall through.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A cover's pixels, queued: lower `priority` first — the shelf in front, then
 * its neighbours, then the rest. Covers are static WebP under `/images`, which
 * skip the proxy and are cached for a day.
 */
export function loadCover(src: string, priority: number, signal: AbortSignal): Promise<Texture> {
  return new Promise<ImageBitmap | HTMLImageElement>((resolve, reject) => {
    queue.push({ src, priority, resolve, reject, signal });
    pump();
  }).then((image) => {
    const t = new Texture(image);
    t.colorSpace = SRGBColorSpace;
    // A bitmap was flipped when it was decoded; WebGL ignores flipY for one.
    t.flipY = !(typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap);
    t.minFilter = LinearMipmapLinearFilter;
    t.needsUpdate = true;
    return t;
  });
}
