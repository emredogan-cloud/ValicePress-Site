/**
 * Brand-logo SVGs for the press's four networks — X, Instagram, Facebook, TikTok.
 * `currentColor`-driven so hover/focus styles flow through; 24×24 viewBox, sized by the
 * caller's className.
 *
 * lucide-react dropped brand glyphs over trademark concerns, so they are inlined here once and
 * reused everywhere the addresses in `@/lib/social` are shown (footer, mobile menu, About).
 * Order matches that list.
 */

export function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.25-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"
      />
    </svg>
  );
}

export function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.3-1.6 1.7-1.6H17V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.5H7.7v3.3h2.8V22z" />
    </svg>
  );
}

export function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M16.6 2h-3.1v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.2a6 6 0 1 0 5.2 5.9V8.4a7.6 7.6 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7z" />
    </svg>
  );
}
