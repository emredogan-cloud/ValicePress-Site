/**
 * Shapes and vocabulary for the `/authors` surfaces.
 *
 * This module used to export `DEMO_AUTHORS`: a hard-coded roster of Yuval
 * Noah Harari, Jane Austen, Dan Brown, George Orwell and J.K. Rowling,
 * each with an invented role, an invented "signature works" line and an
 * invented follower count, rendered on a Valice Press author page.
 *
 * That is not placeholder styling. It is a publisher claiming authors it
 * does not publish, attributed to real named people, with fabricated
 * social proof attached. It has been removed and must not come back.
 * `/authors` now lists whoever is actually in the `authors` table with a
 * published book, and says so plainly when that list is empty.
 *
 * The fields that carried the invention went with it — `followerCount`
 * (we have no follower graph), `works` and `role` (free-text claims about
 * a person), and `featured` (an editorial flag nothing set honestly). What
 * remains is what the database can actually answer for.
 */

import type { DirectoryAuthor } from "@/lib/reference-authors";

/**
 * One person in the directory: a researched reference author, or an author Valice Press publishes, or
 * both (Hearn: researched, and Kwaidan is on the list) — once. Built by `buildDirectory`.
 */
export interface AuthorCardData extends DirectoryAuthor {
  portrait: PortraitTheme;
}

export interface PortraitTheme {
  /** Background gradient — sets the overall mood. */
  background: string;
  /** Color of the silhouette body — usually a near-black with a hint of the bg tone. */
  silhouette: string;
  /** Rim-light color — the cinematic edge highlight (emerald, sepia, blue). */
  rimLight: string;
  /** Top-corner accent glow color. */
  accent: string;
}

/**
 * House portrait theme. Applied to every author until a real portrait
 * pipeline exists; the per-author bespoke themes were part of the removed
 * demo roster.
 */
export const DEFAULT_PORTRAIT: PortraitTheme = {
  background:
    "radial-gradient(ellipse at 35% 30%, #1a3326 0%, #0a1f14 60%, #050a08 100%)",
  silhouette: "#06120c",
  rimLight: "#33f0aa",
  accent: "rgba(51, 240, 170, 0.4)",
};

/**
 * Sorts that are answerable from real data. "Popular" is gone with the
 * follower counts that used to define it — there is no popularity signal
 * to sort by, and inventing one is how the roster got fictional in the
 * first place.
 */
export const AUTHOR_SORTS = ["Surname A → Z", "Most books", "Earliest born"] as const;
export type AuthorSort = (typeof AUTHOR_SORTS)[number];
