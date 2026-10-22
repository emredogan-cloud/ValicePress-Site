/**
 * The spiral library's colours, sampled from the reference picture
 * (`AUDIT/SPIRAL-LIBRARY-PHASE-1-FOUNDATION-AND-IMPLEMENTATION-PLAN.md` §3 and
 * §8). One table for the scene's materials and the page's HTML, so the gold
 * painted on a shelf's band and the gold of the rail that names it are one gold.
 *
 * Kept here, not in the global theme: nothing else on the site uses them yet.
 */
export const LIBRARY_PALETTE = {
  /** The room: the darkness round the column, and the reference's header. */
  ground: "#100f0d",
  /** The name bands. */
  wood: "#26190f",
  /** The column's core and the boards — a step darker than the bands. */
  woodDeep: "#1b120b",
  /** A shelf's painted name. */
  gold: "#fbf4b5",
  /** The light strip under each band, and the glow it throws. */
  cove: "#fdefc4",
  /** Mouldings and rails. The site's gold call-to-action ends on the same colour. */
  brass: "#c9a25c",
  /** A book's page edges. */
  pages: "#e3d7bb",
  /** The rotunda's windows — the only cool colour in the room. */
  night: "#1f3150",
} as const;

/** The palette as CSS custom properties, for the section that holds the library. */
export function paletteStyle(): Record<string, string> {
  return {
    "--lib-ground": LIBRARY_PALETTE.ground,
    "--lib-wood": LIBRARY_PALETTE.wood,
    "--lib-gold": LIBRARY_PALETTE.gold,
    "--lib-cove": LIBRARY_PALETTE.cove,
    "--lib-brass": LIBRARY_PALETTE.brass,
    "--lib-night": LIBRARY_PALETTE.night,
  };
}
