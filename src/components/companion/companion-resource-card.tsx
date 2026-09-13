import { CompanionDownloadLink } from "@/components/companion/companion-download-link";
import { withLangRuns } from "@/lib/lang-runs";
import type { CompanionResourceView } from "@/lib/companion-view";

/**
 * One downloadable companion resource, in the approved card treatment.
 *
 * The card answers the four questions the directive names, in the order a
 * reader asks them: what it is (icon + title), what it costs them to open
 * (format · paper · extent, tracked small caps), why it matters (the
 * description, which is the publisher's own sentence about the thing), and
 * how big it is (measured, beside the button).
 *
 * The icon is chosen from the file's extension rather than being one generic
 * document glyph, because four of these companions hand out CSV and JSON as
 * well as PDFs, and a page icon over a data file is a small lie.
 */

function ResourceIcon({ href }: { href: string }) {
  const ext = href.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  const stroke = "#d6b266";

  // Decorative: every card's meaning is carried by its heading and metadata
  // row, both of which are real text.
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
  };

  if (ext === "csv" || ext === "json") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
      </svg>
    );
  }
  if (ext === "html" || ext === "htm") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 8h18" />
        <path d="M9 13l-2 2 2 2M15 13l2 2-2 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export function CompanionResourceCard({
  companionSlug,
  resource,
  className,
}: {
  companionSlug: string;
  resource: CompanionResourceView;
  /** Grid placement, passed down so the <li> stays a direct child of the <ul>. */
  className?: string;
}) {
  return (
    <li
      className={`home-glass home-card-hover flex flex-col rounded-2xl p-5 sm:p-6${className ? ` ${className}` : ""}`}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border sm:h-14 sm:w-14"
          style={{
            borderColor: "rgba(214,178,102,0.3)",
            background: "rgba(214,178,102,0.06)",
          }}
        >
          <ResourceIcon href={resource.href} />
        </span>

        <div className="min-w-0 flex-1">
          {/* Title and metadata share a row on desktop and stack below it.
              They wrap rather than truncate: an elided extent ("5 pag…") is
              worse than a second line. */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <h3 className="font-serif text-[19px] leading-snug text-fg-hi sm:text-xl">
              {withLangRuns(resource.title)}
            </h3>
            {resource.metaParts.length > 0 && (
              <p className="shrink-0 text-[12px] uppercase tracking-[0.16em] text-fg-fade lg:text-[11px]">
                {resource.metaParts.join("  ·  ")}
              </p>
            )}
          </div>

          <p className="mt-3 text-[14.5px] leading-relaxed text-fg-mid">
            {resource.description}
          </p>
        </div>
      </div>

      {/* The primary action sits at the foot of the card so that a row of
          cards of unequal text length still lines its buttons up. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 sm:pl-[4.5rem]">
        <CompanionDownloadLink
          companionSlug={companionSlug}
          assetId={resource.id}
          href={resource.href}
        />
        {resource.size && (
          <span className="text-[12px] text-fg-fade">{resource.size}</span>
        )}
      </div>
    </li>
  );
}
