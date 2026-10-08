/**
 * The two pieces of marginalia set into the hero photograph.
 *
 * They are the detail that makes the reference read as a printed page rather
 * than a landing page: a caption beside the image and a line of italic copy
 * signing off the bottom right corner.
 *
 * (There was a third, a list — "Independent publishing / Curated editions / Yours
 * to keep" — at the top right. It sat on the lit stone column and the bronze
 * sphere, where 9.5px white capitals measured as unreadable at 1536 and 2560px,
 * and all three claims are already made by the trust row under the buttons.)
 *
 * ALL THREE ARE HTML. None of it is drawn into the picture, so all of it is
 * selectable, translatable and readable by a screen reader — and none of it
 * has to be regenerated when the wording changes.
 *
 * Hidden below `xl`. Below 1280px the picture is a banner above the headline and
 * these would sit on top of the books; they are grace notes, and a grace note
 * that gets in the way is just an obstacle.
 *
 * TWO ANCHORS, ON PURPOSE.
 *   - `HeroEditorialNotes` (the left caption) hangs off the section: it sits in
 *     the dark margin beside the headline and has nothing to do with the books.
 *   - `HeroSceneNotes` (the sign-off) is a child of the scene itself and is placed
 *     in the PLATE's own proportions. The scene shrinks on a small laptop, and a
 *     note pinned to the screen's right edge — which is where it used to be — ends
 *     up on top of the third book. Pinned to the plate it sits where the plate has
 *     room: on the table beneath "The Sweetest Season".
 */
export function HeroEditorialNotes() {
  return (
    <div
      aria-hidden
      data-hero-note
      className="pointer-events-none absolute left-[30%] top-[22%] hidden xl:block"
    >
      <div className="flex gap-3">
        <span
          className="mt-1 block h-14 w-px shrink-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <p className="text-[9.5px] font-medium uppercase leading-[2.1] tracking-[0.3em] text-white/55">
          Ideas
          <br />
          travel
          <br />
          further
          <br />
          here.
        </p>
      </div>
    </div>
  );
}

/** Rendered inside the scene (`position: relative/absolute`, plate-proportioned). */
export function HeroSceneNotes() {
  return (
    <>
      {/* Sign-off, on the table beneath the third book (its base is at 85% of the
          plate's height; this is at 91-95%). One line: four stacked lines at the
          screen's edge is what used to run across its title. */}
      <div
        aria-hidden
        data-hero-note
        className="pointer-events-none absolute bottom-[4%] right-[4%] z-[1] hidden text-right xl:block"
      >
        <p className="font-serif text-[13px] italic leading-[1.6] text-white/60">
          Books for a more intentional world.
        </p>
      </div>
    </>
  );
}
