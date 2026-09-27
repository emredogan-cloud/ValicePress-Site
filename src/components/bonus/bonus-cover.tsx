import Image from "next/image";

/**
 * A book cover set INTO a bonus page rather than onto it.
 *
 * No border, no ring, no card shadow and no hover lift: those made the cover
 * read as a separate object sitting on the page. Instead its outermost 3%
 * dissolves into the page background through a mask, so the edges belong to
 * the composition and the page's own warm wash shows through them. The mask
 * touches only that 3% margin; the type on both Larkspur Lake covers sits
 * well inside it (series and author lines at 5% or more from any edge).
 *
 * Aspect ratio is the image's own (width/height are the asset's real pixel
 * size); on-screen width is responsive through the caller's classes.
 */
const EDGE =
  "linear-gradient(to right, transparent, #000 3%, #000 97%, transparent), " +
  "linear-gradient(to bottom, transparent, #000 3%, #000 97%, transparent)";

export function BonusCover({
  src,
  width,
  height,
  alt,
  sizes,
  className,
  priority = false,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      className={className}
      style={{
        WebkitMaskImage: EDGE,
        maskImage: EDGE,
        WebkitMaskComposite: "source-in",
        maskComposite: "intersect",
      }}
    />
  );
}
