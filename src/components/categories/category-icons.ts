import {
  BookOpen,
  Compass,
  Dices,
  Heart,
  Landmark,
  Languages,
  Puzzle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * One glyph and one tint per REAL category, keyed on the slug the catalogue
 * declares in `scripts/catalog/valice-catalog.mjs`. A category that is not
 * listed here gets the neutral book glyph and the house tint — never a guess
 * matched on a keyword in its name, which is how "Classics & Philosophy"
 * once rendered a fantasy castle.
 */
export interface CategoryLook {
  icon: LucideIcon;
  /** Radial tint behind the cover fan. */
  tint: string;
}

const LOOKS: Record<string, CategoryLook> = {
  "myth-and-folklore": { icon: Sparkles, tint: "rgba(51, 240, 170, 0.16)" },
  "puzzle-and-challenge": { icon: Puzzle, tint: "rgba(244, 196, 75, 0.14)" },
  "games-and-play": { icon: Dices, tint: "rgba(122, 182, 255, 0.16)" },
  "young-explorers": { icon: Compass, tint: "rgba(255, 154, 110, 0.14)" },
  "language-and-learning": { icon: Languages, tint: "rgba(94, 228, 216, 0.14)" },
  "classics-and-philosophy": { icon: Landmark, tint: "rgba(224, 212, 184, 0.12)" },
  romance: { icon: Heart, tint: "rgba(244, 134, 160, 0.15)" },
};

const DEFAULT_LOOK: CategoryLook = { icon: BookOpen, tint: "rgba(51, 240, 170, 0.12)" };

export function categoryLook(slug: string): CategoryLook {
  return LOOKS[slug] ?? DEFAULT_LOOK;
}
