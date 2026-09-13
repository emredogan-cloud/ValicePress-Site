import { CompanionResourceCard } from "@/components/companion/companion-resource-card";
import type { CompanionResourceView } from "@/lib/companion-view";

/**
 * The companion's downloads, two to a row on desktop and one on a phone.
 *
 * The number of cards is deliberately NOT fixed: these companions carry
 * between two and five pieces each, and forcing a uniform count would mean
 * either padding a book with a resource it does not have or hiding one it
 * does. The grid is the constant; the contents are the book's.
 *
 * An odd last card stretches to the full width rather than sitting in a
 * half-width column beside empty space — at five resources that is what the
 * approved composition does with its own leftover.
 */
export function CompanionResourceGrid({
  companionSlug,
  resources,
  heading,
  headingId,
}: {
  companionSlug: string;
  resources: CompanionResourceView[];
  heading: string;
  headingId: string;
}) {
  const odd = resources.length % 2 === 1;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id={headingId} className="font-serif text-[26px] text-fg-hi sm:text-3xl">
          {heading}
        </h2>
        <p className="text-[13px] text-fg-soft">
          Free, no sign-up, reprint as often as you like.
        </p>
      </div>

      <ul className="mt-7 grid gap-5 lg:grid-cols-2">
        {resources.map((resource, i) => (
          <CompanionResourceCard
            key={resource.id}
            companionSlug={companionSlug}
            resource={resource}
            className={
              odd && i === resources.length - 1 ? "lg:col-span-2" : undefined
            }
          />
        ))}
      </ul>
    </section>
  );
}
