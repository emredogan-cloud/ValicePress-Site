import type { CSSProperties } from "react";

/**
 * The room round the column: a dark rotunda, softly out of focus — two
 * galleries of arched windows with the night outside, warm sconces between
 * them, a balustrade along each gallery, the floor's glow.
 *
 * DRAWN IN CSS, AND ARCHITECTURE ONLY. No image file, no text, no shelves of
 * books: the room may not show a title nobody can buy or a cover that is not in
 * the catalogue, so it shows a building. Every element is a soft gradient,
 * painted once; the canvas in front of it is transparent, so the browser only
 * composites the two. It does not move with the scroll: an element moved from
 * a scroll handler is what Firefox warns about as a scroll-linked effect, and
 * the column's own descent already carries the depth.
 *
 * Symmetric about the centre, where the column stands; arches nearer the edges
 * are drawn narrower, as a curved wall turns away.
 */

/** Window centres across the stage (%), left half; the right half mirrors them. */
const BAYS = [5, 15.5, 26];

function arch(x: number, top: number, height: number, key: string): { key: string; style: CSSProperties } {
  const fromEdge = Math.min(x, 100 - x);
  const width = 3.6 + fromEdge * 0.14;
  return {
    key,
    style: {
      left: `${x - width / 2}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      borderRadius: "50% 50% 6px 6px / 28% 28% 6px 6px",
      background: "linear-gradient(180deg, rgba(38,60,98,0.85) 0%, rgba(24,36,60,0.55) 55%, rgba(14,16,22,0) 100%)",
      filter: "blur(8px)",
      opacity: 0.6,
    },
  };
}

function glow(x: number, y: number, size: number, alpha: number, key: string): { key: string; style: CSSProperties } {
  return {
    key,
    style: {
      left: `${x - size / 2}%`,
      top: `${y - size / 2}%`,
      width: `${size}%`,
      height: `${size * 1.6}%`,
      background: `radial-gradient(closest-side, rgba(255,196,120,${alpha}), rgba(255,170,90,${alpha * 0.35}) 45%, transparent)`,
    },
  };
}

const xs = [...BAYS, ...BAYS.map((x) => 100 - x)];
const ARCHES = [
  ...xs.map((x, i) => arch(x, 7, 17, `u${i}`)),
  ...xs.map((x, i) => arch(x, 41, 23, `l${i}`)),
];
/** Sconces on the piers between the windows, and a few lamps on the reading desks below. */
const piers = [10.25, 20.75, 89.75, 79.25];
const LAMPS = [
  ...piers.map((x, i) => glow(x, 21, 5.5, 0.32, `s${i}`)),
  ...piers.map((x, i) => glow(x, 55, 6.5, 0.36, `t${i}`)),
  ...[8, 22, 78, 92].map((x, i) => glow(x, 83, 9, 0.22, `d${i}`)),
];

export function LibraryBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--lib-ground)]">
      <div className="absolute inset-x-0 -top-[4%] h-[112%]">
        {/* The light the column throws into the room. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 36% 58% at 50% 44%, rgba(150,98,48,0.34) 0%, rgba(84,54,28,0.18) 45%, transparent 75%)",
          }}
        />
        {ARCHES.map((a) => (
          <div key={a.key} className="absolute" style={a.style} />
        ))}
        {/* The gallery floors. */}
        {[30, 70].map((y) => (
          <div
            key={y}
            className="absolute inset-x-0"
            style={{
              top: `${y}%`,
              height: "2.4%",
              background: "linear-gradient(180deg, transparent, rgba(150,104,58,0.22), transparent)",
              filter: "blur(3px)",
            }}
          />
        ))}
        {LAMPS.map((l) => (
          <div key={l.key} className="absolute" style={l.style} />
        ))}
        {/* The floor, catching the column's light. */}
        <div
          className="absolute inset-x-0 bottom-0 h-[30%]"
          style={{ background: "radial-gradient(ellipse 55% 70% at 50% 100%, rgba(120,80,42,0.3), transparent 70%)" }}
        />
      </div>
      {/* Vignette: the room falls away into the dark at the edges. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 85% 78% at 50% 46%, transparent 52%, rgba(0,0,0,0.62) 100%)" }}
      />
    </div>
  );
}
