/**
 * Where Valice Press is on social media — the ONE place these addresses are written.
 *
 * The footer, the mobile menu, the About page, the founder card, the structured data and
 * the Twitter card all read this list. `social.test.ts` fails if an old handle, a GitHub
 * link or a second copy of any of these addresses appears anywhere else in `src/`.
 *
 * Order is the order they are shown.
 */
export type SocialId = "x" | "instagram" | "facebook" | "tiktok";

export interface SocialLink {
  id: SocialId;
  /** The network's name, for a screen reader and a visible label. */
  label: string;
  /** How the account is written on that network. */
  handle: string;
  /** Where it is. */
  href: string;
  /** One honest line on what is there; used on the About page. */
  blurb: string;
}

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { id: "x", label: "X", handle: "@ValicePress", href: "https://x.com/ValicePress", blurb: "New editions and notes from the press." },
  { id: "instagram", label: "Instagram", handle: "@valicepress", href: "https://www.instagram.com/valicepress/", blurb: "Covers, pages and what is on the shelf." },
  { id: "facebook", label: "Facebook", handle: "Valice Press", href: "https://www.facebook.com/profile.php?id=61594861742767", blurb: "Updates for readers who are not on the other networks." },
  { id: "tiktok", label: "TikTok", handle: "@valicepress", href: "https://www.tiktok.com/@valicepress", blurb: "Short looks inside the books." },
] as const;

/** For `sameAs` in the Organization's structured data. */
export const SOCIAL_URLS: readonly string[] = SOCIAL_LINKS.map((l) => l.href);

/** The handle `twitter:site` names. */
export const TWITTER_SITE = "@ValicePress";
