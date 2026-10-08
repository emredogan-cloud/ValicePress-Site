import { ImageResponse } from "next/og";

/**
 * Default Open Graph / social-share image — App Router file convention,
 * served at `/opengraph-image`.
 *
 * Lives at the app root, so it becomes the INHERITED OG image for every
 * route that doesn't set its own `openGraph.images` — the homepage,
 * `/books`, discovery hubs (`/categories`, `/authors`, `/genres`), the
 * blog and the legal pages. Book-detail pages override it with the real
 * cover in their `generateMetadata`, so those keep cover-art previews.
 * Twitter inherits it through the metadata `twitter.images ←
 * openGraph.images` fallback (the root layout sets
 * `twitter.card = "summary_large_image"`).
 *
 * Rendered with `next/og` (Satori) using NO external font fetch, so the
 * build never depends on network reachability; the brand look comes from
 * the cinematic dark-emerald palette and layout rather than a custom face.
 * For static routes it's generated once at build time (no per-request cost).
 */

export const alt =
  "Valice Press — Buy once, own forever. DRM-free, watermarked PDFs you can read on any device.";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #050705 0%, #0a1f14 55%, #03120b 100%)",
          padding: "84px",
          color: "#F4F6F4",
          position: "relative",
        }}
      >
        {/* Soft emerald glow, top-right — pure decoration. */}
        <div
          style={{
            position: "absolute",
            top: "-160px",
            right: "-120px",
            width: "520px",
            height: "520px",
            display: "flex",
            background:
              "radial-gradient(circle, rgba(51,240,170,0.22) 0%, rgba(51,240,170,0) 70%)",
          }}
        />

        {/* Eyebrow: brand mark + wordmark. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            color: "#33f0aa",
            fontSize: "24px",
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              display: "flex",
              background: "#33f0aa",
              borderRadius: "2px",
              transform: "rotate(45deg)",
            }}
          />
          Valice Press
        </div>

        {/* Headline + subhead. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "82px",
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            <span>Find it. Own it.</span>
            <span>Read it anywhere.</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "30px",
              maxWidth: "880px",
              fontSize: "30px",
              lineHeight: 1.4,
              color: "#9fb3a8",
            }}
          >
            Romance, world folklore, games and puzzles. Buy a DRM-free PDF once
            and keep it forever — never locked to a device.
          </div>
        </div>

        {/* Footer trust line. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "23px",
            color: "#6f857a",
          }}
        >
          <div
            style={{
              width: "46px",
              height: "2px",
              display: "flex",
              background: "#33f0aa",
            }}
          />
          DRM-free · Watermarked, not locked · Yours forever
        </div>
      </div>
    ),
    { ...size },
  );
}
