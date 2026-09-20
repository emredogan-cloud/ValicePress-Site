/**
 * The Valice Press catalog, as source-controlled data.
 *
 * Every field here was read out of the book production repositories under
 * `MY-DİGİTAL-BOOK/`, out of the built PDFs themselves, or off the live KDP
 * bookshelf. Nothing is invented. Where a value could not be established it
 * is `null`, and null renders as absent rather than as a guess.
 *
 * ── WHAT CHANGED, AND WHY IT CHANGED EVERYTHING ──────────────────────────
 * The previous revision of this file opened by stating that no Valice Press
 * book was published on Amazon, and set every `amazonAsin` to null on that
 * basis. That was true when it was written. It is no longer true.
 *
 * Verified against the KDP bookshelf and Author Central on 2026-08-31:
 * SIX of the seven titles are live on Amazon across nineteen editions, each
 * with a real ASIN, and all nineteen `/dp/` URLs were fetched and returned
 * 200. Those ASINs are recorded below and are the reason "Buy on Amazon" can
 * finally render — it is now a real destination rather than a fabrication.
 *
 * The same check produced the constraint that shapes direct sale:
 * **Codex Mythologica's Kindle edition is enrolled in KDP Select.** Select is
 * an exclusivity agreement. While it stands, that book's digital edition may
 * not be sold anywhere else — including here. It is the one title whose
 * ebook is deliberately not for sale on this site, and the reason is not a
 * missing file or an unset price but a contract.
 *
 * The old file's inverse claim — "nothing is enrolled in KDP Select, because
 * nothing is on KDP at all" — is therefore now wrong in both halves. This is
 * exactly why publication state is re-derived from the source of truth each
 * phase rather than inherited from the last report.
 *
 * ── HOW THE THREE STATUSES DIFFER ────────────────────────────────────────
 * `websiteStatus`   whether valicepress.com lists the book at all.
 * `format.kdp`      what Amazon currently holds for that edition.
 * `directSale`      whether we may sell the digital edition ourselves.
 * They move independently. A book can be live on Amazon and unsellable here
 * (Codex Mythologica), or sellable here and not on Amazon at all.
 *
 * Prices on Amazon-fulfilled formats are the ACTUAL live list prices read off
 * KDP — not the modelled ones the previous revision carried. Several differed
 * by several dollars, and a storefront quoting a price Amazon does not charge
 * is worse than quoting none.
 */

/** Prices are in minor units (cents). */
const usd = (dollars) => Math.round(dollars * 100);

/** Amazon product URL for a verified ASIN. Never call this with a guess. */
/**
 * The plain product URL for a verified ASIN.
 *
 * AMAZON ATTRIBUTION. To measure how many of our own visitors go on to buy on
 * Amazon, replace this call on a single format with the tracking URL that
 * Amazon Attribution generates — `attributionUrl: "https://www.amazon.com/dp/…?maas=…"`
 * pasted whole, never assembled by hand, because the tag is signed. The
 * storefront already prefers `amazonUrl` over the ASIN fallback
 * (`src/components/book-detail/format-table.tsx` → `amazonHref`), so a pasted
 * URL takes effect on the next catalogue load with no code change. Keep the
 * ASIN in `amazonAsin` either way: it is what `verify-amazon.mjs` checks the
 * listing against, and a tracking URL that silently points at the wrong book
 * is exactly the failure this catalogue exists to prevent.
 */
const amazon = (asin) => `https://www.amazon.com/dp/${asin}`;

export const CATEGORIES = [
  {
    slug: "myth-and-folklore",
    name: "Myth & Folklore",
    description:
      "Myth, legend and bestiary — retold and referenced from the traditions that carried them.",
  },
  {
    slug: "puzzle-and-challenge",
    name: "Puzzle & Challenge",
    description:
      "Books that ask something of the reader: ciphers, enigmas, and problems set to be solved.",
  },
  {
    slug: "games-and-play",
    name: "Games & Play",
    description:
      "The rules people have played by, across cultures and centuries — written to be played from.",
  },
  {
    slug: "young-explorers",
    name: "Young Explorers",
    description:
      "Books made for readers aged 8–12, and for the adults reading alongside them.",
  },
  {
    slug: "language-and-learning",
    name: "Language & Learning",
    description:
      "Workbooks and companions for learning a script, a language, or a practice by doing it.",
  },
  {
    // Holds the public-domain line. One real title today (Meditations);
    // it exists because that book exists, not to pad the navigation.
    slug: "classics-and-philosophy",
    name: "Classics & Philosophy",
    description:
      "Public-domain works reset and typeset as reading editions, with the translation and source edition stated plainly.",
  },
];

export const AUTHORS = [
  {
    slug: "emre-dogan",
    name: "Emre Doğan",
    // Supplied verbatim by the Founder on 2026-09-02 and canonical from that
    // date. It is the only biography of him this repository may print: it
    // stays word-for-word wherever the full text fits, and where a provider
    // caps the field (Amazon Author Central, KDP), the shortened variant that
    // was actually used is recorded in docs/execution/phase-3/AUTHOR_BIO.md
    // rather than improvised at the point of use. Do not add credentials.
    bio: "Emre Doğan writes about the stories that cultures tell themselves in order to keep going.\n\nTrained as a software engineer, he came to mythology the way most people do — through a single story that would not leave him alone — and stayed for the pattern underneath. CODEX MYTHOLOGICA, his first book, gathers seventy-six myths from nineteen traditions and retells each one in full.\n\nHe reads in several languages, badly, and is grateful daily to the translators and ethnographers whose patient work made a book like this possible for someone who is neither.\n\nHe lives in Turkey.",
  },
  {
    slug: "marcus-aurelius",
    name: "Marcus Aurelius",
    bio: "Roman emperor from 161 to 180 and a Stoic. The twelve books collected as Meditations were written in Greek, for himself, and were never intended to be read by anyone else.",
  },
  {
    slug: "henry-dudeney",
    name: "Henry E. Dudeney",
    // Facts from the MacTutor biography (University of St Andrews), read
    // 2026-09-02; see the book project's CLAIMS.jsonl C-001…C-011.
    bio: "English puzzle-maker (1857–1930). A Civil Service clerk from the age of thirteen, he wrote puzzles for The Strand Magazine for more than thirty years and published The Canterbury Puzzles (1907) and Amusements in Mathematics (1917). The Haberdasher's four-piece triangle and the spider and the fly are his.",
  },
  {
    slug: "lafcadio-hearn",
    name: "Lafcadio Hearn",
    // Facts from Wikipedia, "Lafcadio Hearn" and "Kwaidan: Stories and Studies of
    // Strange Things", read 2026-09-06; see the book project's CLAIMS.jsonl C-001…C-003.
    bio: "Writer and interpreter of Japan (1850\u20131904). Born on Lefkada to a Greek mother and an Irish father, raised in Dublin, and a newspaperman in Cincinnati and New Orleans for twenty years before he reached Japan in 1890. He married Koizumi Setsu, became a Japanese citizen in 1896 as Koizumi Yakumo, and taught at Tokyo Imperial University. Kwaidan, his book of ghost stories, was published six months before he died.",
  },
  {
    slug: "henry-lee",
    name: "Henry Lee",
    // Every clause is taken from the book's own title page and from PG bibrec 36677;
    // nothing here is inferred. See the book project's CLAIMS.jsonl C-001 to C-003.
    bio: "English naturalist and writer on marine animals (1826\u20131888). F.L.S., F.G.S., F.Z.S., and \u2014 in the words of his own title page \u2014 sometime naturalist of the Brighton Aquarium, where he spent years watching octopus and cuttle through glass. He wrote The Octopus, or the Devil-fish of Fiction and Fact in 1873, and in the summer of 1883 produced two shilling handbooks for the International Fisheries Exhibition at South Kensington, signing their prefaces at the Savage Club seven weeks apart. In them he identified the kraken as a giant squid a decade before anyone could prove it.",
  },
  {
    slug: "sabine-baring-gould",
    name: "Sabine Baring-Gould",
    // Dates from PG bibrec 5324; the rest from the book's own pages and from Wikipedia,
    // read 2026-09-06. See the book project's CLAIMS.jsonl C-001 and C-002.
    bio: "English clergyman, antiquarian, novelist and collector of folk-song (1834\u20131924). Squire and parson of the same Devon parish, Lew Trenchard, which he had inherited and then presented himself to; author of the words of \u201cOnward, Christian Soldiers\u201d, of a very long series on the lives of the saints, and of well over a hundred other books. He had been to Iceland and could read Old Norse, which is why the middle chapters of The Book of Were-Wolves are so much better than the end. He went about Devon with a notebook collecting folk-songs from farm labourers before anyone else in England was doing it systematically.",
  },
  {
    slug: "thomas-keightley",
    name: "Thomas Keightley",
    // Dates from PG bibrec 41006; the career and the Croker connection from Keightley's own
    // preface, which is the primary source. See CLAIMS.jsonl C-001 and C-002.
    bio: "Irish writer and folklorist (1789\u20131872), born in Dublin and settled in London from 1824. He came to literature, by his own account, because his fortune was gone and ill health shut him out of the professions, and he lived by writing school histories. Helping T. Crofton Croker gather the Fairy Legends of the South of Ireland led him to write The Fairy Mythology (1828), the first attempt in English to set the fairy beliefs of Europe side by side. It was translated into German at once; Jacob Grimm wrote commending it. He is also, unusually for his century, a collector who admitted in print that some of the material he helped produce had been improved for effect.",
  },
  {
    slug: "wirt-sikes",
    name: "Wirt Sikes",
    // Dates from PG bibrec 34704; the appointment, the novels and the pseudonyms from
    // Wikipedia, read 2026-09-06. See the book project's CLAIMS.jsonl C-001 and C-005.
    bio: "American journalist and writer (1836\u20131883), United States Consul at Cardiff from June 1876 until his death. He had worked on newspapers in Utica, Chicago and New York, written two novels, and \u2014 by one account \u2014 used as many as thirty pseudonyms, one of them for a dime novel. Four years in Wales produced British Goblins (1880), still the largest book on Welsh folklore in English, and Rambles and Studies in Old South Wales (1881). Richard Dorson called the first the most substantial book of Welsh legendry in English, and in the same assessment faulted it for leaning on earlier compilations rather than on collecting of its own.",
  },
  {
    slug: "t-h-thomas",
    name: "T. H. Thomas",
    // Dates and the museum role from PG bibrec 34704 and Wikipedia; the bardic name from
    // the Dictionary of Welsh Biography, all read 2026-09-06. CLAIMS.jsonl C-006.
    bio: "Welsh artist and antiquary (1839\u20131915), known in Wales by the bardic name Arlunydd Penygarn. He settled in Cardiff in 1866, worked for the Daily Graphic, helped found the Royal Cambrian Academy, and was a leading force behind the founding of the National Museum of Wales, to which his thousand-odd prints, drawings and watercolours went after his death. His twenty-one drawings for British Goblins are the only illustrations the book has, and he is the only other person named on its title page.",
  },
];

/**
 * @typedef {Object} FormatSpec
 * @property {'ebook'|'paperback'|'hardcover'|'large_print'} format
 * @property {'available'|'coming_soon'|'unavailable'} availability
 * @property {'direct'|'amazon'} fulfillment
 * @property {number|null} priceCents
 * @property {number|null} pageCount
 * @property {string|null} amazonAsin   Verified on the KDP bookshelf only.
 * @property {string|null} amazonUrl    Derived from a verified ASIN only.
 * @property {'live'|'in_review'|'not_created'|'not_applicable'} kdp
 * @property {string|null} masterFileKey
 * @property {string|null} [epubFileKey]  R2 key of the EPUB master, when the
 *   edition ships one. Absent or null means the buyer gets the PDF only, and
 *   the storefront must then say nothing about EPUB.
 * @property {string} priceBasis  Why this number is what it is.
 */

const RAW_BOOKS = [
  {
    // The one title that was already published and already selling — except
    // that it carried `pri_test_meditations_999`, a Paddle price id that
    // never existed, so its checkout failed at the till for the entire time
    // it has been live. It is entered here so that it stops being an orphan
    // row that nothing in source control describes.
    slug: "meditations",
    title: "Meditations",
    subtitle: "The George Long translation of 1862, newly typeset",
    language: "en",
    pageCount: 148,
    categories: ["classics-and-philosophy"],
    authors: ["marcus-aurelius"],
    bisac: ["PHI011000"],
    // Valice Classics is the public-domain, direct-first series described in
    // valice-house/series-bibles/valice-classics.md; Meditations was its
    // first edition and Dudeney (2026-09-02) its second.
    series: { name: "Valice Classics", volume: 1 },
    websiteStatus: "published",
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142140",
    onelinePromise:
      "A Roman emperor's private notebook, in the translation that carried it into English, set as a book to actually read.",
    description:
      "Twelve books of private notes, written in Greek by a Roman emperor who never meant them to be read. This edition uses George Long's 1862 translation — the version through which most English readers have met the text — set from Project Gutenberg's transcription of it (ebook #15877) and typeset fresh at 148 pages across 487 numbered sections. The Gutenberg apparatus, licence text and headers are stripped entirely; what remains is the translation and Valice Press's own front matter, which states the source and the translator rather than leaving a reader to guess which Meditations they have bought.",
    idealReader:
      "Anyone who wants Long's Meditations as a book rather than as a wall of scanned text, and who would rather be told exactly which translation and which source they are reading.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 148,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/meditations/master/v1/master.pdf",
        priceBasis:
          "The figure already on the published production row. Carried forward rather than re-decided — but see the blocker: it is high for a public-domain reprint whose original contribution is currently front matter alone.",
      },
    ],
    blockers: [
      "CHECKOUT WAS BROKEN. This book has been published and advertised while pointing at `pri_test_meditations_999`, a Paddle price that does not exist. A real price (pri_01m1btwjzqvest52bwde6mqqam, $9.99) now replaces it. Nobody lost a purchase — production has zero orders — but the store's only buyable title could not be bought.",
      "PRICING / DIFFERENTIATION: $9.99 is at the top of the range for a public-domain text whose original contribution is, today, typesetting and a source note. Long's translation is free on Gutenberg and on Kindle at $0.99. Either add the original matter that justifies the price (introduction, notes, apparatus) or reprice. See PUBLIC_DOMAIN_BATCH_1_PLAN.md — this is the same decision every Batch 1 title faces.",
      "No print edition exists. Digital only.",
    ],
  },

  {
    slug: "codex-mythologica",
    title: "Codex Mythologica",
    subtitle: "76 Myths from 19 Civilizations",
    language: "en",
    pageCount: 329,
    categories: ["myth-and-folklore"],
    authors: ["emre-dogan"],
    bisac: ["FIC010000", "SOC011000", "LIT004290"],
    series: { name: "Codex", volume: 1 },
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_at_next_kdp_revision", why: "All three editions now carry a dedicated companion page (p. 330 / p. 330 / p. 579), and all three covers were rebuilt for the new page counts on 2026-09-03 — the files are finished and verified. They are held, not unfinished: KDP Select runs to 2026-11-03, and on that date the interiors are reopened anyway so the ebook can be sold here. Pulling three live editions through a review cycle before then buys nothing. Packages: docs/execution/phase-5/kdp-packages/codex-mythologica/." },
    // The exclusivity that decides this book's digital channel.
    kdpSelect: true,
    directSale: false,
    // Now a dated blocker rather than an open-ended one. The KDP promotion
    // manager, read 2026-09-02, states the term exactly: enrolled, started
    // 6 August 2026, **ends 3 November 2026**, auto-renew already unticked by
    // the Founder. Cancelling auto-renew does not end the current term — the
    // exclusivity runs to the end date and not a day earlier. So this is not
    // waiting on anybody; it is waiting on a calendar.
    directSaleBlockedBy:
      "KDP Select exclusivity on the Kindle edition. Term 2026-08-06 → " +
      "2026-11-03 (KDP promotion manager, read 2026-09-02); auto-renew is off, " +
      "so it lapses on that date and does not repeat. The digital edition may " +
      "not be sold outside Amazon before 2026-11-03. Nothing to do until then.",
    providerPriceId: null,
    onelinePromise:
      "Seventy-six myths from nineteen civilizations, told at full length and left unsoftened.",
    description:
      "Seventy-six myths from nineteen civilizations, retold at full narrative length rather than summarised into paragraphs. Greek, Norse, Egyptian, Mesopotamian, Chinese, Turkic, Inuit, Polynesian and Mesoamerican traditions sit side by side, each story given roughly a thousand words and left unsoftened. The arrangement is comparative by design: cultures that never met asked the same questions in the same images — a grieving spouse in Egypt and a grieving mother in Greece, the rabbit a Chinese poet saw in the moon sitting also in the Mexican account.",
    idealReader:
      "Readers who want the myths themselves rather than a commentary on them, and who are as interested in what the Turkic and Inuit traditions did with a story as in what Greece did with it.",
    formats: [
      {
        format: "ebook",
        // Available — just not from us. Selling it here would breach Select,
        // but the Kindle edition is on sale today, so the honest row is a
        // link to it rather than "not yet available" about a book that is.
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(6.99),
        pageCount: 329,
        amazonAsin: "B0HD8121RR",
        amazonUrl: amazon("B0HD8121RR"),
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "$4.99 → $6.99, the Founder's change of 2026-09-02. Confirmed twice: the KDP bookshelf shows $6.99 USD, and the live format strip on the Amazon page now reads $6.99 (verify-amazon.mjs, 2026-09-02 evening). It read $4.99 that afternoon — KDP price changes take up to 72 hours to propagate, and the catalogue follows the shelf, not the dashboard.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(21.99),
        pageCount: 329,
        pendingPageCount: 330,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        amazonAsin: "B0HCY8KY3X",
        amazonUrl: amazon("B0HCY8KY3X"),
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "Live Amazon list price 2026-08-31. The previous modelled figure ($18.99) was $3 low.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(32.99),
        pageCount: 329,
        pendingPageCount: 330,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        amazonAsin: "B0HDBFZRQ4",
        amazonUrl: amazon("B0HDBFZRQ4"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "large_print",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(27.99),
        pageCount: 578,
        pendingPageCount: 579,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        // Amazon carries the large print run as its own title, not as a
        // format of the main one. One ASIN, its own listing.
        amazonAsin: "B0HDDR84MF",
        amazonUrl: amazon("B0HDDR84MF"),
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "Live Amazon list price 2026-08-31. Paperback only: 578pp exceeds KDP's 550pp hardcover maximum.",
      },
    ],
    blockers: [
      "KDP Select enrolment blocks direct ebook sale. This is the only thing standing between this title and the Valice Press store.",
      "Cover art native resolution ~112 PPI (101 PPI on the hardcover canvas) — below the 300 PPI print target, accepted at publication.",
    ],
  },

  {
    slug: "codex-bestiarium",
    title: "Codex Bestiarium",
    subtitle:
      "A World Bestiary: 112 Legendary Creatures from 40 Traditions — Beasts, Spirits, and Guardians of World Folklore",
    language: "en",
    pageCount: 436,
    categories: ["myth-and-folklore"],
    authors: ["emre-dogan"],
    bisac: ["SOC011000", "REF000000", "FIC010000"],
    series: { name: "Codex", volume: 2 },
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_at_next_kdp_revision", why: "All three editions now carry a dedicated companion page (p. 436 / p. 436 / p. 600) and all three covers were rebuilt for the new page counts on 2026-09-03. Held for one reason: the four listings still claim '120 Legendary Creatures' where the book has 112 (handbook O4), and that correction needs a KDP visit for every edition. One review cycle, both jobs. Packages: docs/execution/phase-5/kdp-packages/codex-bestiarium/." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142153",
    onelinePromise:
      "A reference bestiary of 112 creatures, organised by what a creature does rather than where it is from.",
    description:
      "A reference bestiary of 112 creatures drawn from 40 folk traditions, organised by what a creature does rather than where it comes from. The Irish each-uisce, the Icelandic nykur, the Finnish näkki and the Filipino tikbalang share a chapter because they share a behaviour. Six classes — Guardians, Devourers, Shape-Changers, Water-Dwellers, Sky and Storm, Restless Dead — hold entries of roughly 675 words, each carrying two independent sources, a Thompson motif code, pronunciation, cross-references and a line-engraved plate, closing with four indexes.",
    idealReader:
      "Anyone who reaches for a bestiary to look something up rather than to read it straight through — folklorists, worldbuilders, game masters, and readers who want the source cited.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 436,
        amazonAsin: "B0HDLS4W8Q",
        amazonUrl: amazon("B0HDLS4W8Q"),
        kdp: "live",
        masterFileKey: "books/codex-bestiarium/master/v1/master.pdf",
        priceBasis:
          "Matched to the live Kindle list price ($9.99, KDP 2026-09-08 — Kindle B0HDLS4W8Q reads Live at $9.99 USD on the bookshelf). The direct edition matches Amazon rather than undercutting it. Not in KDP Select, so direct sale is permitted.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(24.99),
        pageCount: 436,
        pendingPageCount: 436,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        amazonAsin: "B0HDLQHQ7H",
        amazonUrl: amazon("B0HDLQHQ7H"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(37.99),
        pageCount: 436,
        pendingPageCount: 436,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        amazonAsin: "B0HDLLPG5M",
        amazonUrl: amazon("B0HDLLPG5M"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "large_print",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(29.99),
        pageCount: 599,
        pendingPageCount: 600,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        amazonAsin: "B0HDLT1V3P",
        amazonUrl: amazon("B0HDLT1V3P"),
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "Live Amazon list price 2026-08-31. Listed on Amazon as its own title; paperback only.",
      },
    ],
    blockers: [
      "LISTING ERROR ON AMAZON: all four live listings are titled '120 Legendary Creatures'. The book contains 112 — confirmed by the build reports (`entries: 112`, 112 plates measured and accepted) and by the PDF's own metadata. The listing overstates the contents by eight entries and should be corrected in KDP.",
      "White-paper cover variants are defective (spine band overflows 1.10mm paperback / 0.41mm hardcover). Cream stock is correct and is the stock that was published.",
      "Cover art native resolution 103–116 PPI, upscaled to a 300 DPI canvas.",
    ],
  },

  {
    slug: "the-great-book-of-world-myths",
    title: "The Great Book of World Myths",
    subtitle:
      "45 Stories of Gods, Heroes, and Monsters from 22 Cultures — Retold for Young Readers (Ages 8–12)",
    language: "en",
    pageCount: 234,
    categories: ["myth-and-folklore", "young-explorers"],
    authors: ["emre-dogan"],
    bisac: ["JUV033010"],
    series: { name: "The Great Book of…", volume: 1 },
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_now", why: "Rebuilt 2026-09-03: the half-page 'THE MAP, FULL SIZE' note on p. 233 — a one-inch code low on the page with a caption beside it — is now a dedicated companion page carrying a 2.1-inch code at 24 % of the page height. Still 234 pages, so the covers at KDP stay exactly valid. Interior swap only, both formats." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    // Replaced 2026-09-02 when the price moved $4.99 → $6.99. The old id
    // pri_01m1btjddes1p637hd78zsvczx is archived in Paddle, not deleted:
    // existing transactions must keep resolving to what was actually paid.
    providerPriceId: "2142154",
    onelinePromise:
      "Forty-five myths for ages 8–12, from twenty-two traditions — and no more than three of them Greek.",
    description:
      "Forty-five myths retold for readers aged 8 to 12, drawn from twenty-two traditions — Korean, Inuit, Māori, Hawaiian, Yoruba, Akan, Persian, Turkic, Greek, Norse, Irish, Finnish, Egyptian, Mesopotamian, Japanese, Chinese, Vietnamese, Hindu, Maya, Aztec, Andean and Zulu. It is built against the roughly eighty-percent-Greek children's mythology shelf: no culture gets more than four stories and Greece gets no more than three. Each story runs 900–1,000 words with one black-and-white illustration, and the back matter carries a hand-drawn world map, per-culture cards, a sourced pronunciation guide and a Who's Who. Australian Aboriginal material is deliberately excluded, and the book says so.",
    idealReader:
      "A confident 8–12 year old reader, and the parent or teacher who has noticed that most children's mythology is Greek mythology with a wider title.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(6.99),
        pageCount: 234,
        amazonAsin: "B0HDQRPKST",
        amazonUrl: amazon("B0HDQRPKST"),
        kdp: "live",
        masterFileKey: "books/the-great-book-of-world-myths/master/v1/master.pdf",
        priceBasis:
          "$4.99 → $6.99 on 2026-09-02, following the Kindle edition. The Founder moved the Kindle list to $6.99 (KDP bookshelf, and the live format strip agrees); the house rule is that a direct price matches the Kindle list to the cent, so the direct price follows. This is the Phase 3 'scenario C' outcome arriving for free: $6.99 direct nets $6.14 against $4.24 at $4.99 — 45% more per copy — while staying at parity with Amazon, so it invites no price-matching and raises no question about why the publisher's own shop costs more.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(14.99),
        pageCount: 234,
        amazonAsin: "B0HDTL5V2H",
        amazonUrl: amazon("B0HDTL5V2H"),
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "Live Amazon list price 2026-08-31. The previous modelled figure ($16.99) was $2 high.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(26.99),
        pageCount: 234,
        amazonAsin: "B0HDZJ4PHQ",
        amazonUrl: amazon("B0HDZJ4PHQ"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "large_print",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1899,
        pageCount: null,
        amazonAsin: "B0HK2GLCFG",
        amazonUrl: "https://www.amazon.com/dp/B0HK2GLCFG",
        kdp: "live",
        masterFileKey: null,
        priceBasis: "READ OFF KDP 2026-09-19 — live since 2026-09-16 at $18.99. The row said 'not_applicable' because no large print was planned when it was written; one exists and is on sale.",
      },
    ],
    blockers: [
      "Founder's KDP AI-content declaration: made at upload (the book is live), but not recorded anywhere in the project files. Record it for the audit trail.",
      "Cover art effective resolution 115/106 dpi.",
      "The two-parent-readings validation gate was closed by founder attestation only, with no per-reader log. The book makes no claim that depends on it.",
    ],
  },

  {
    slug: "the-great-book-of-world-games",
    title: "The Great Book of World Games",
    subtitle:
      "63 Games from 4,600 Years of Human Play — Rules, Boards and Stories from 45 Cultures, Ready to Play Tonight",
    language: "en",
    pageCount: 182,
    categories: ["games-and-play"],
    authors: ["emre-dogan"],
    bisac: ["GAM002000", "REF000000", "HIS000000"],
    series: { name: "The Great Book of…", volume: 2 },
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_now", why: "Rebuilt 2026-09-03: the weak note of 09-02 — a text block at the top of an otherwise empty p. 160, with no code at all — is now a dedicated companion page with a 2.9-inch code. That was the 56-game edition at 160 pages. The recovery edition measures 182 (hardcover 186, large print 272) and the three wraps were rebuilt to the live KDP Cover Calculator on 2026-09-19 — the previous wraps carried 160- and 232-page spines. The large print is in KDP review; its invented author biography was corrected on p. 4 (page-neutral) and its companion page is built, but its cover cannot be rebuilt here — see the hold in companion-page-spec.mjs." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142158",
    onelinePromise:
      "Sixty-three traditional games with complete rules and boards — arranged by how they play, not where they came from.",
    description:
      "Sixty-three traditional games from forty-five cultures spanning some 4,600 years, arranged by mechanic rather than by region into seven families — Sowing Games, Hunt and Siege, Race Home, Line and Territory and others. Each entry gives sourced provenance, complete playable rules and a deterministic vector board diagram, and the seven rule sets that are scholarly reconstructions say so in the prose. The oldest game in it is the Royal Game of Ur, at 2600 BCE. It aims at the gap between academic game history, which is authoritative but unplayable, and the cheap family-games listicle.",
    idealReader:
      "Someone who wants to actually play a 4,000-year-old game tonight, and wants to know which parts of the rules are attested and which are reconstruction.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 182,
        amazonAsin: "B0HG44FH1B",
        amazonUrl: amazon("B0HG44FH1B"),
        kdp: "live",
        masterFileKey: "books/the-great-book-of-world-games/master/v1/master.pdf",
        priceBasis:
          "Matched to the live Kindle list price ($9.99, KDP 2026-09-08 — Kindle B0HG44FH1B reads Live at $9.99 USD on the bookshelf). The direct edition matches Amazon rather than undercutting it. Not in KDP Select.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(22.99),
        pageCount: 182,
        amazonAsin: "B0HG3KMK9L",
        // Amazon Attribution tag, created in the Ads console on 2026-09-08
        // (campaign 585752812173052673, ad group valicepress-com-world-games-pb,
        // publisher "Valice Press website"). Same /dp/ page, same ASIN; the
        // query string is what lets Amazon report site → Amazon purchases.
        amazonUrl:
          "https://www.amazon.com/dp/B0HG3KMK9L?maas=maas_adg_464E7BF296979686C0BCF4F5B808E585_afap_abs&ref_=aa_maas&tag=maas",
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(34.99),
        pageCount: 186,
        amazonAsin: "B0HG41F21F",
        amazonUrl: amazon("B0HG41F21F"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        // Built 2026-09-02 (Phase 2 v3 pilot): 16 pt body, 232 pp, KDP
        // preflight green — 08_OUTPUT/LARGEPRINT in the book project.
        // Uploaded by the Founder on 2026-09-02 and in KDP review since; not
        // on the shelf as of 2026-09-03 (author-wide Amazon search). The ASIN
        // lands here only when the listing is live, never before.
        format: "large_print",
        // VERIFIED LIVE 2026-09-07: $31.99, 232 pp, 8.5 x 11 in, In Stock,
        // published 2026-09-02. It is on KDP as a second "paperback" entry, which
        // is why an earlier check reading formats by name did not find it.
        //
        // THREE DEFECTS ON THE LIVE LISTING, none of them fixable from here — see
        // F-045. They are recorded on the row because a reader meets them:
        //   1. the title reads "39 Cultıres" — a Turkish dotless i for the u in
        //      Cultures, in the product title, on Amazon, now;
        //   2. the title never says LARGE PRINT, so this $31.99 8.5x11 edition and
        //      the $22.99 6x9 paperback (B0HG3KMK9L) are indistinguishable to a
        //      buyer reading titles. Codex Mythologica and Codex Bestiarium both
        //      carry "(Large Print Edition)" in theirs;
        //   3. the description is unescaped: literal backslash-n pairs print as
        //      text — "A reference book you play from.\\n\\nThe Great Book...".
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(31.99),
        pageCount: 232,
        pendingPageCount: 272,
        pendingPageCountReason:
          "The 63-game recovery edition measures 272 pages and its wrap was rebuilt to match on 2026-09-19 (KDP Cover Calculator: 17.863 x 11.25 in, spine 0.613 in). `pageCount` stays at 232 — what the listing actually sells — until that interior and wrap are uploaded to B0HHNCVQVX. The earlier value 233 was the 2026-09-03 companion-page build and is superseded.",
        isbn13: "979-8171397371",
        amazonAsin: "B0HHNCVQVX",
        amazonUrl: "https://www.amazon.com/dp/B0HHNCVQVX",
        kdp: "live",
        listingDefects: ["title-typo-cultires", "title-omits-large-print", "description-literal-newlines"],
        masterFileKey: null,
        priceBasis:
          "LIVE AT $31.99 since 2026-09-02. price-engine.mjs 2026-09-02 — 232 pp large trim B&W prints at $4.94; $31.99 nets $14.25 (44.5%), $3 under the hardcover. See 06_REPORTS/LARGEPRINT_BUILD_REPORT.md.",
      },
    ],
    blockers: [
      "The subtitle promises 'Ready to Play Tonight' and `01_SOURCE/playtests/` is empty — no game in this book has been played by a human from the book's text alone. Founder decision PLAYTEST-STANDARD-2026-09-19 replaced the external-playtest release bar with 'Pre-publication simulation and rule verification completed', which IS measured (qa_rules.py: 109 rules-complete, 0 not-production-ready, and tie/stalemate/illegalMove checked per game). No session has been fabricated and none will be. Running real playtests remains the highest-value thing that could be done for this title.",
      "Scope: 63 games against a locked target of 100; 45 cultures against a target of 45, which is met. Recounted 2026-09-19 off 02_MANUSCRIPT/book.json — the previous line said 56 and 39 and had not been recounted since 2026-09-07, before the recovery edition added seven games. The published book does not claim 100 games, so the remaining gap is a roadmap gap rather than a misstatement.",
      "One A+ content module (APLUS-05) has no artwork.",
    ],
  },

  {
    slug: "the-myth-hunters-field-book",
    title: "The Myth Hunter's Field Book",
    subtitle:
      "A Screen-Free Quest Through 22 Cultures — 120 Puzzles, Maps, Codes and Challenges for Ages 8–12",
    language: "en",
    pageCount: 156,
    categories: ["puzzle-and-challenge", "young-explorers"],
    authors: ["emre-dogan"],
    bisac: ["JNF001000", "JUV045000", "JNF025000"],
    series: null,
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_now", why: "Rebuilt 2026-09-03. The interior ended on two identical ruled 'Field Notes' pages; the second is now the companion page, so the reader keeps a notes page and gains a destination — 156 pages before, 156 after, cover untouched. The same pass set the PDF title and author, which had shipped as 'untitled / anonymous'." },
    kdpSelect: false,
    directSale: false,
    directSaleBlockedBy:
      "No digital edition exists, by design. This is a write-in activity book; " +
      "the puzzles are solved on the page. An ebook of it would not work.",
    providerPriceId: null,
    onelinePromise:
      "One hundred and twenty puzzles for ages 8–12, each built from something a real culture actually made.",
    description:
      "A screen-free activity book in which 120 puzzles across six world regions and twenty-two cultures are each built from something a people actually made. Children decode Younger Futhark and Inuktitut syllabics, count in Maya bars and dots, and trace the Red River delta. Answers are sourced to museums and archives rather than invented, and the quest is structured: six regional seals to earn and a completion certificate at the end. It is a book to be written in, which is why there is no ebook edition.",
    idealReader:
      "An 8–12 year old who has finished the puzzle books that repeat themselves, and an adult looking for a screen-free hour that teaches something real.",
    formats: [
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(14.99),
        pageCount: 156,
        amazonAsin: "B0HFP4KYX5",
        amazonUrl: amazon("B0HFP4KYX5"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "ebook",
        availability: "unavailable",
        fulfillment: "direct",
        priceCents: null,
        pageCount: null,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: null,
        priceBasis:
          "Deliberately not produced. This is a write-in book; an e-reader edition would not work.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 3399,
        pageCount: 156,
        amazonAsin: "B0HJ5MJJ5K",
        amazonUrl: "https://www.amazon.com/dp/B0HJ5MJJ5K",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-08 at $33.99. Earlier reasoning: price-engine.mjs 2026-09-07 at the MEASURED 156 pages of the hardcover's own "
          + "typesetting, 8.25 × 11 hardcover, B&W on white: printing $8.30, KDP minimum list "
          + "$13.84, recommended $33.99 — which nets $12.09 (35.6%), the first price on the "
          + "ladder that clears the 35% house floor. The project's own editionsHypothesis "
          + "carried $24.99 as a DISABLED test position; it nets 26.8% and was not taken. "
          + "$33.99 is also exactly where Codex Mythologica: The Puzzle Book sits — same trim, "
          + "same binding, same 156 pages — so the two are consistent rather than each guessed.",
      },
    ],
        blockers: [
      "HARDCOVER: BUILT 2026-09-07 under FOUNDER DECISION F-051, which closed A5. It is "
        + "its OWN typesetting, not the paperback in a different jacket: KDP's hardcover "
        + "line does not offer 8.5 × 11, so the interior was re-set at 8.25 × 11 by "
        + "`interior.py --format hardcover` and measured its own page count — 156, the "
        + "same as the paperback, because this book's extent is set by fixed-height "
        + "activity boxes rather than by reflowing text. Interior: 156 pp, 8.250 × 11.000 "
        + "in, 7 fonts embedded, real title and author, companion page at p.156 with its "
        + "QR measured at 26% of the page. Wrap: 18.615 × 12.417 in, spine 0.540, art at "
        + "311 ppi, barcode zone measured clear, every WCAG contrast ratio above floor. "
        + "The geometry was READ from KDP's own Cover Calculator on 2026-09-07, never "
        + "derived. WHAT IS NOT DONE: the edition has never been uploaded, so KDP Print "
        + "Previewer has never seen it — and this house has already had a table print off "
        + "the page that every local check passed.",
      "Accepted risk on record: ZERO child testing (`externalValidation = overridden-zero-sessions`, explicitly not 'passed'). The project config permanently refuses to claim a child tested this book. It is live on Amazon regardless.",
      "Accepted risk on record: interior art resolution floor lowered from 300 to 150 dpi by founder decision rather than regenerating assets.",
      "PDF METADATA IS FIXED on both formats (2026-09-07); both interiors carry the real "
        + "title and author. The hardcover's first build did not, and the companion-page "
        + "tool caught it and refused — then could not fix it, because its own assembly "
        + "read ReportLab's placeholder `anonymous` as a value. The check and the thing "
        + "it checked disagreed; both now exclude the same two words. Separately, BOTH "
        + "WRAPS WERE OVER KDP'S 40 MB COVER LIMIT (paperback 50.2 MB, hardcover 52.7 MB) "
        + "and would have been rejected at upload. Both are re-encoded at 300 dpi — 1.5 "
        + "and 1.6 MB, 329 and 311 ppi, geometry unchanged — with the originals kept "
        + "beside them as `cover.uncompressed.pdf`.",
    ],
  },

  {
    // ── THE GREEK ALPHABET HANDWRITING WORKBOOK ────────────────────────────
    // Valice Script 2. Written, typeset, illustrated and validated on
    // 2026-09-04 from an empty scaffold. Nothing here is a plan: every number
    // below was measured off a built file on that date.
    //
    // The differentiator is the one thing every competing Greek alphabet
    // workbook leaves out. Greek has NO official stroke-order standard — a
    // 1998 study of 756 Greek schoolchildren recorded thirty-one different
    // ways of writing capital Δ — so this book prints, letter by letter,
    // whether its order was transcribed from a published Greek handwriting
    // reference, taken from the Latin letter the reader already writes, or
    // derived by a stated rule. That page is the product.
    slug: "greek-alphabet-handwriting-workbook",
    title: "The Greek Alphabet Handwriting Workbook",
    subtitle:
      "Write all 24 letters in the modern and the classical forms, with a sourced stroke order for every one",
    language: "en",
    pageCount: 100,
    categories: ["language-and-learning"],
    authors: ["emre-dogan"],
    bisac: ["FOR010000"],
    series: null,
    // PUBLISHED 2026-09-04. The condition was that a published page must be a
    // page a reader can act on, and it now is: the direct ebook is buyable
    // here against a live Paddle price, with both master files in R2.
    //
    // The earlier note said the price "cannot be created from this machine".
    // That was the observed behaviour and the wrong diagnosis: `.env` carries
    // TWO PADDLE_API_KEY lines and the second, live one is written with a
    // space before the `=`, so every loader's ^([A-Z0-9_]+)=(.*)$ skipped it
    // and a stale sandbox key won. The live key works.
    websiteStatus: "published",
    linkageDecision: {
      decision: "rebuild_now",
      why: "Built new on 2026-09-04 with the companion page in the typesetting rather than spliced on afterwards: page 99 is a dedicated leaf carrying a code at 30 % of the usable page height and valicepress.com/companion/greek beneath it. Nothing to retrofit.",
    },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    // Created against the LIVE Paddle account on 2026-09-04 by
    // provision-paddle.mjs and read back from the API: active, one-time,
    // 699 USD, custom_data.valice_slug matching this row.
    providerPriceId: "2142168",
    onelinePromise:
      "Thirty-two lessons that take an adult from nothing to writing all 24 Greek letters, in both the modern and the classical forms, with a sourced stroke order for each.",
    description:
      "A 100-page handwriting workbook for adult English speakers learning to write Greek — the forms you will meet in Athens today and the ones you will meet in a Loeb. Thirty-two lessons cover all 24 letters in both cases, the final sigma, three variant letterforms a reader meets in print and the lunate sigma they meet on stone, and every accent in both the monotonic and the polytonic systems \u2014 53 stroke diagrams in all, 33 of them numbered. Each lesson is a spread: the left page shows the letter with a start dot and a numbered arrow for every stroke, then the same letter again for each stroke with the marks building up in order; the right page is ruled practice that moves trace \u2192 dot-start \u2192 free and, from Lesson 9 on, finishes on a real Greek word. Every letter also carries what it sounds like now and what it sounded like in the fifth century BC. A provenance page states plainly that Greek has no official stroke-order standard, cites the study of 756 schoolchildren that recorded up to thirty-one ways of writing one letter, and labels every sequence in the book with where it came from.",
    idealReader:
      "An adult beginner who wants to write Greek by hand before speaking it \u2014 for Modern Greek, for reading Attic or Koine, or because the names on the mythology shelf are worth reading in their own alphabet \u2014 and who would rather be told that a stroke order is recommended than be told to trust it.",
    formats: [
      {
        format: "paperback",
        // Built 2026-09-04 and preflighted; not yet uploaded. No ASIN is
        // invented while that is true.
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1299,
        pageCount: 100,
        amazonAsin: "B0HJV1ZRSR",
        amazonUrl: "https://www.amazon.com/dp/B0HJV1ZRSR",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-15 at $12.99. Earlier reasoning: price-engine.mjs 2026-09-04 at the MEASURED 100 pages, 8.5 \u00d7 11 large trim, B&W, white: printing $2.84, KDP minimum list $4.74. $12.99 nets $4.95 (38.1 %), inside the Valice Script band of $12.99\u201314.99 and matched to the Hangul volume so the series does not price two comparable workbooks differently.",
      },
      {
        format: "hardcover",
        // PRODUCED 2026-09-05, on a Founder instruction that overrode the
        // earlier "not viable" reading — and the override turned out to be
        // right on the numbers, not only on authority. See priceBasis.
        //
        // Built as its OWN interior at 8.25 × 11 (KDP has no 8.5 × 11
        // case-laminate trim) and measured at 100 pages, and its wrap geometry
        // was read out of KDP's Cover Calculator rather than derived, which is
        // the house rule. Not uploaded, so no ASIN is invented.
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(24.99),
        pageCount: 100,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: null,
        priceBasis:
          "price-engine.mjs 2026-09-05 at the MEASURED 100 pages, 8.25 × 11 hardcover, B&W, white: printing $5.65 — KDP's 75–108 page hardcover band is a flat fee with no per-page charge, which makes a short hardcover the cheapest one it prints — KDP minimum list $9.42, and $24.99 nets $9.34 (37.4 %). That is over the 35 % house floor and the best margin of any format this book has. The earlier decision not to produce it measured a $19.99 list at 21 % and drew the wrong conclusion from a correct number: $19.99 was the wrong price, not the format. The roadmap's $21.99 TEST position nets 34.3 % and misses the floor.",
      },
      {
        format: "large_print",
        availability: "unavailable",
        fulfillment: "amazon",
        priceCents: null,
        pageCount: null,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: null,
        priceBasis:
          "NOT PRODUCED \u2014 DUPLICATIVE. The book is already an 8.5 \u00d7 11 large trim with 44-point exemplars and four-line rules; a large-print edition of it would be the same book at the same size. Series bible; DECISIONS.md K4.",
      },
      {
        format: "ebook",
        // Two files, one purchase, and neither of them is "the workbook as
        // an ebook" \u2014 a workbook's value is the empty box, and an empty box
        // cannot be written in on a screen. The PDF is the workbook you can
        // reprint; the EPUB is the reference the screen is better at.
        //
        // AVAILABLE 2026-09-04: the price exists, is active, and was read back
        // from api.paddle.com before this line was changed.
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(6.99),
        pageCount: 100,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        // The print interior itself, screen-normalised \u2014 for a workbook that
        // is not a degraded paperback but the format that lets a reader print
        // page 31 again instead of writing in their only copy.
        masterFileKey: "books/greek-alphabet-handwriting-workbook/master/v1/master.pdf",
        // The second delivered file: the reflowable reference edition.
        epubFileKey: "books/greek-alphabet-handwriting-workbook/master/v1/master.epub",
        priceBasis:
          "$6.99 direct, netting $6.14 after Paddle (5 % + $0.50) = 87.8 %. Comparison set inside this catalogue: World Myths $6.99, Dudeney $9.99, Enigmatica $9.99, World Games $11.99, Bestiarium $12.99. Not matched to a Kindle price, because there is no Kindle edition to match. Two files for the one price \u2014 the 100-page workbook as a printable PDF and a 36-chapter reflowable reference with 77 vector diagrams \u2014 set at the foot of the range because it sits beside a $12.99 print book and the pair should cost under $20. EPUBCheck 5.1.0 on the EPUB: 0 fatals, 0 errors, 0 warnings.",
      },
      // NO `kindle` ROW. The decision not to make one is real and is recorded
      // in the project's DECISIONS.md (K5, K9) and project_config.json, which
      // is where a decision belongs. It was briefly written here as a format
      // row with availability "unavailable", and that broke the production
      // loader: `book_format` is a Postgres enum of ebook | paperback |
      // hardcover | large_print, so even the DELETE the loader runs for an
      // unavailable edition failed its enum cast. A catalogue format row is
      // for an edition the storefront reasons about, not for a note.
    ],
    blockers: [
      "NO PHYSICAL PROOF OF THE HARDCOVER — the hardcover interior and case wrap were built on 2026-09-05 and preflight clean, but this is their first print. A proof copy is recommended before publishing, and more so than for the paperback: the case wrap folds around board and the fold is not visible on screen.",
      "PADDLE TAX CATEGORY \u2014 the product was created as `standard` because this Paddle account is not approved for the `ebooks` category. That over-collects VAT where books are taxed at a reduced rate. Same pending request as the other six products.",
      "KDP UPLOAD \u2014 the paperback interior and cover are built, preflighted and packaged, but only the account holder can upload them. See OUTPUT/KDP/KDP_UPLOAD_GUIDE.html.",
      "AI DECLARATION \u2014 the manuscript text and the diagrams were produced by an AI agent; the fact is recorded in project_config.json \u2192 compliance.aiDisclosure with its evidence. Only the account holder can enter that declaration on the KDP form.",
      "ISBN \u2014 none assigned; the copyright page prints PENDING \u2014 KDP-PROVIDED ISBN until one is.",
      "NO PHYSICAL PROOF \u2014 first print of the paperback interior and of this cover. A proof copy is recommended before publishing.",
      "KDP UPLOAD (HARDCOVER) \u2014 the 8.25 \u00d7 11 hardcover interior and its case wrap are built and preflight clean; only the account holder can upload them.",
    ],
  },
  {
    // Roadmap book 4, built end to end on 2026-09-05. A companion volume to
    // the two Codex reference books rather than the next one in the series,
    // which is why it carries no series volume number.
    //
    // The differentiator is not the subject — mythology puzzle books exist —
    // it is that every puzzle in it was solved by a program that saw only the
    // printed page, to exactly one answer, and every factual premise in it
    // points at a field or a sentence in a manuscript this press owns and
    // re-reads on every build. 542 of them.
    slug: "codex-mythologica-the-puzzle-book",
    title: "Codex Mythologica: The Puzzle Book",
    subtitle: "100 Myth Puzzles from 19 Civilizations",
    language: "en",
    pageCount: 156,
    categories: ["puzzle-and-challenge"],
    authors: ["emre-dogan"],
    bisac: ["GAM007000"],
    series: null,
    // PUBLISHED 2026-09-05. The condition for publishing is that the page
    // gives a reader something they can act on, and it now does: the direct
    // ebook is buyable here against a live Paddle price, with both master
    // files in R2. Neither print format is uploaded, and the page says so.
    websiteStatus: "published",
    linkageDecision: {
      decision: "rebuild_now",
      why: "Built new on 2026-09-05 with the companion leaf in the typesetting rather than spliced on afterwards: page 155 is a dedicated leaf carrying a 3.00 in code at 27 % of the usable page height and valicepress.com/companion/codex-puzzles beneath it, and the code was read back module for module in both interiors.",
    },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    // Created against the LIVE Paddle account on 2026-09-05 by
    // provision-paddle.mjs and read back from the API: active, one-time,
    // 1199 USD, custom_data.valice_slug matching this row.
    providerPriceId: "2142177",
    onelinePromise:
      "A hundred myth puzzles whose every fact is checkable and whose every answer was reached, independently, by something that only saw the printed page.",
    description:
      "A hundred puzzles built out of CODEX MYTHOLOGICA and CODEX BESTIARIUM \u2014 and you need neither of them. Every fact a puzzle rests on is printed with the puzzle: the names, the classes, the dates, the whole candidate list. Nothing here is a quiz. Fourteen ciphers over lines quoted from the myths themselves, ten logic grids and twelve deductions, ten word fits and ten searches whose leftover letters spell a sentence, eight orderings, eight classifications, eight tallies and eight pictures drawn out of their own numbers. Three hints for every one of them, printed in three separate passes so that looking up the first does not show you the third. Every answer given, and beside each one the line that says how it was checked \u2014 because every puzzle in this book was solved by a program that saw only the printed page, and had to reach one answer and no other. Where a puzzle had two, the puzzle was rebuilt.",
    idealReader:
      "An adult puzzler who is tired of puzzle books that are really quizzes \u2014 someone who will do a logic grid on a train, wants the facts inside it to be true, and would rather be given the whole candidate list than be tested on what they happen to remember.",
    formats: [
      {
        format: "paperback",
        // STAGED AT KDP AND READY TO PUBLISH, 2026-09-07. The listing is complete —
        // Details, Content and Rights & Pricing all filled, preview approved, price
        // $16.99 saved and showing on the bookshelf. It is DRAFT because the last
        // click, "Publish Your Paperback Book", carries the KDP Terms agreement and
        // belongs to the account owner. See F-046.
        //
        // KDP's Print Previewer failed it twice on p. 152 — "This text is outside the
        // margins" and "This object is outside the margins" — and the cause was worse
        // than a margin: the fifty-seven-creature reference table drew straight off
        // the bottom of the page, so THREE ROWS NEVER PRINTED AT ALL. The whole
        // Arabian civilization — Ghul, Ifrit, Rukh — was missing from a table the
        // book's own text says holds "three to each, exactly". Fixed in BUILD (long
        // tables now split across pages, header repeated); the corrected interior is
        // uploaded and the previewer is clean.
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(16.99),
        pageCount: 156,
        isbn13: "9798172268281",
        // LIVE. Submitted to KDP 2026-09-07 and watched through the pipeline the same
        // day. It was "publishing" for part of that day — the product page existed and
        // carried ISBN 979-8172268281 and 156 pages, both matching the corrected
        // interior, but printed "—" where the price goes, which is what a book still in
        // KDP's pipeline looks like. Re-checked later on 2026-09-07: the bookshelf reads
        // Live and the product page now prints "Paperback from $16.99" with an offer
        // beneath it. (The page also says the item cannot ship to the account's own
        // address in Turkey; that is a shipping-destination limit, not a listing state.)
        amazonAsin: "B0HJ2TPX4T",
        amazonUrl: "https://www.amazon.com/dp/B0HJ2TPX4T",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "STAGED AT $16.99 at KDP 2026-09-07; the form shows printing $3.65 and royalty $6.54 at 60%, which is the figure below, confirmed by KDP itself. price-engine.mjs 2026-09-05 at the MEASURED 156 pages, 8.5 \u00d7 11 large trim, B&W, white: printing $3.65, KDP minimum list $6.09. $16.99 nets $6.54 (38.5 %). The roadmap said $14.99 against a planned 130 pages; at the built 156 that nets 35.6 %, six tenths of a point over the house floor and inside the noise of a KDP printing-rate change.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 3399,
        pageCount: 156,
        amazonAsin: "B0HJBY2CJW",
        amazonUrl: "https://www.amazon.com/dp/B0HJBY2CJW",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-10 at $33.99. Earlier reasoning: price-engine.mjs 2026-09-05 at 156 pages, 8.25 \u00d7 11 hardcover, B&W, white: printing $8.30. The roadmap's $24.99 TEST nets 26.8 % and fails the 35 % floor by eight points; so do $29.99 (32.3 %) and $31.99 (34.0 %). $33.99 nets $12.09 = 35.6 %, the first price that clears it, inside the Codex hardcover band and beside the closest comparable in this catalogue \u2014 World Games, 160 pages at the same trim, live at $34.99.",
      },
      {
        format: "large_print",
        availability: "unavailable",
        fulfillment: "amazon",
        priceCents: null,
        pageCount: null,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: null,
        priceBasis:
          "NOT PRODUCED, and the reason is the format rather than the market. The book is already 8.5 \u00d7 11 with 10 pt clues and nothing under 8 pt. Large print would have to enlarge the GRIDS, and a nonogram at 1.75\u00d7 is not a more readable nonogram \u2014 it is one that no longer fits a page. Where large print would help is the hints and answers, and those are on the companion page as text at whatever size the reader's own browser is set to.",
      },
      {
        format: "ebook",
        // Two files, one purchase: the print interior as a DRM-free
        // watermarked PDF (the solving copy \u2014 print puzzle 63 again rather
        // than write in your only one) and a reflowable EPUB with every grid
        // as SVG and the three hint passes in three separate documents.
        //
        // AVAILABLE 2026-09-05: the price exists, is active, and was read back
        // from api.paddle.com before this line was changed.
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(11.99),
        pageCount: 156,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/codex-mythologica-the-puzzle-book/master/v1/master.pdf",
        epubFileKey: "books/codex-mythologica-the-puzzle-book/master/v1/master.epub",
        priceBasis:
          "$11.99 direct, netting $10.89 after Paddle (5 % + $0.50) = 90.8 %. Comparison inside this catalogue: Dudeney $9.99, Enigmatica $9.99, World Games $11.99, Bestiarium $12.99. The Codex bible sets the direct ebook at the Kindle list price, $9.99\u201312.99; this sits at World Games' price because it is the same shape of book \u2014 a large-format volume you work through rather than read.",
      },
    ],
    blockers: [
      "PADDLE TAX CATEGORY \u2014 the product was created as `standard` because this Paddle account is not approved for the `ebooks` category. That over-collects VAT where books are taxed at a reduced rate. Same pending request as the other seven products.",
      "KDP UPLOAD \u2014 the paperback and hardcover interiors and both wraps are built and preflight clean; only the account holder can upload them.",
      "AI DECLARATION \u2014 the manuscript prose and the cover illustration were both produced by AI tools; the facts are recorded in project_config.json \u2192 compliance.aiDisclosure with their evidence. Only the account holder can enter that declaration on the KDP form.",
      "ISBN \u2014 none assigned; the copyright page prints PENDING until one is.",
      "NO PHYSICAL PROOF \u2014 first print of both interiors and both covers. A proof copy is recommended, and more so for the hardcover, whose case wrap folds around board.",
    ],
  },
  {
    slug: "korean-hangul-handwriting-workbook",
    title: "Korean Hangul Handwriting Workbook",
    subtitle:
      "Learn to write all 40 letters with correct stroke order, build syllable blocks, and read your first 97 Korean words",
    language: "en",
    pageCount: 124,
    categories: ["language-and-learning"],
    authors: ["emre-dogan"],
    bisac: [],
    series: null,
    // Published on 2026-09-02, after the paperback was found LIVE on Amazon
    // (B0HHHWXGG4, $12.99, 124 pp). The page links to a listing that already
    // sells to the public; withholding our own page does not withhold the
    // book, it only costs the sale. The rights remediation is complete in the
    // files (book project RIGHTS.md, decision K46): the CC BY-SA dictionaries
    // and the CC BY-NC phonetic chart were withdrawn, every word re-verified
    // against the National Institute of Korean Language's learner vocabulary
    // list (KOGL Type 1), every gloss rewritten, and the paperback, hardcover
    // and Kindle files rebuilt (09_OUTPUT/FINAL). What Gate 2 still gates is
    // the DIRECT sale — see directSaleBlockedBy; the ebook stays unavailable.
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_now", why: "Rebuilt 2026-09-03. The companion was a grey box at the foot of p. 122, the fourth thing on that page; it is now a dedicated page 125 with a 2.85-inch code. This is the one book where the page count had to move — 124 → 126 — because nothing on the closing pages could be given up. The paperback cover was rebuilt for the new spine (0.2792 → 0.2838 in); the hardcover wrap is a KDP-Cover-Calculator value only the account holder can re-run." },
    kdpSelect: false,
    directSale: false,
    directSaleBlockedBy:
      "GATE 2 PENDING: the rights remediation of 2026-09-02 (RIGHTS.md, K46) " +
      "replaced the CC BY-SA / CC BY-NC sources with a KOGL Type 1 word list " +
      "and a public-domain phonetics source; the Founder has not yet signed " +
      "the ledger (book_metadata.json → legal.a7_status is still " +
      "LEGAL_REVIEW_REQUIRED, now only for cover-art rights and the KDP AI " +
      "declaration). No direct sale until that signature.",
    providerPriceId: null,
    onelinePromise:
      "Thirty lessons that take an adult beginner from nothing to writing all 40 Hangul letters in the correct stroke order.",
    description:
      "A 124-page handwriting workbook for adult English-speaking learners starting Korean from the script up. Thirty lessons cover all 40 letters plus 16 single batchim through 122 numbered stroke-order diagrams, moving trace → dot-start → empty box, then into syllable-block mechanics and 97 practice words with Revised Romanization, every one checked against the National Institute of Korean Language's learner vocabulary list. A provenance page states plainly that 28 of the 40 stroke sequences were transcribed from published diagrams and 12 derived from a rule.",
    idealReader:
      "An adult beginner who wants to learn to write Hangul by hand before learning to speak, and who would rather know where a stroke order came from than be told to trust it.",
    formats: [
      {
        format: "paperback",
        // LIVE. Read from the listing itself on 2026-09-02 with
        // scripts/market/verify-amazon.mjs: $12.99, 124 pages, 8.5 × 11 in,
        // ISBN 979-8170602360, published 29 August 2026. Nobody supplied this
        // ASIN — it was found by searching Amazon for the title and confirmed
        // against four catalogue facts before being written here.
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(12.99),
        pageCount: 124,
        pendingPageCount: 126,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        amazonAsin: "B0HHHWXGG4",
        amazonUrl: amazon("B0HHHWXGG4"),
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "FOUNDER-APPROVED (decision K43, 2026-08-29); the live listing charges exactly this.",
      },
      {
        format: "hardcover",
        // WAS: "Not on the shelf — an author-wide Amazon search on 2026-09-02
        // returned the paperback and no hardcover." That was true on 2026-09-02
        // and it went live the next day, on 2026-09-03. The search was the right
        // instrument and nobody ran it again, which is how a row keeps saying
        // "coming soon" about a book that is In Stock.
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(21.99),
        pageCount: 124,
        pendingPageCount: 126,
        pendingPageCountReason: "the companion page of 2026-09-03; `pageCount` stays at what the listing sells until the file is uploaded",
        // VERIFIED LIVE 2026-09-07 on the KDP bookshelf and on the listing itself:
        // hardcover, $21.99, 124 pp, In Stock. The row had said coming_soon /
        // in_review / asin: null since the submission, and nobody had gone back to
        // look. KDP shows "Live · Updates in review", which means the EDITION is
        // live and a metadata change is pending — not that the book is unpublished.
        isbn13: "979-8170927647",
        amazonAsin: "B0HHLZ31CV",
        amazonUrl: "https://www.amazon.com/dp/B0HHLZ31CV",
        kdp: "live",
        masterFileKey: null,
        priceBasis: "FOUNDER-APPROVED (K43, 2026-08-29); the live listing charges exactly this.",
      },
      {
        format: "ebook",
        availability: "unavailable",
        fulfillment: "direct",
        priceCents: null,
        pageCount: 125,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: null,
        priceBasis:
          "Not priced until the Founder signs Gate 2 (2026-09-02 remediation). The fixed-layout EPUB 3 was rebuilt on 2026-09-02 (13.4 MB) from the remediated content; it is a reference edition, not a reflowable one.",
      },
    ],
    blockers: [
      "GATE 2 — the rights remediation of 2026-09-02 (book project RIGHTS.md, DECISIONS.md K46) withdrew the CC BY-SA dictionaries and the CC BY-NC phonetic chart and re-verified all 97 words against the National Institute of Korean Language's learner list (KOGL Type 1). The Founder must sign the ledger (legal.a7_status) before any sale.",
      "KDP — the paperback went live as B0HHHWXGG4 on 29 August 2026, before the remediation. The Founder reports having replaced the interior with 09_OUTPUT/FINAL/paperback/paperback_interior_8.5x11_124pp.pdf; that cannot be confirmed from outside Amazon, because the pre- and post-remediation interiors are both 124 pages. Confirm inside KDP that the current interior is the remediated file. The hardcover is not on the shelf yet.",
      "Remaining A7 items (Founder): ownership terms of the AI-generated cover art, and the KDP AI declaration.",
      "Cover art measures ~83 DPI true resolution; no higher-resolution source exists anywhere in the project.",
      "No real human usability test: the Phase 4 pilot used an AI proxy and returned REVISE; closed by founder override.",
      "No BISAC code assigned.",
    ],
  },

  {
    // Valice Classics 2 — built 2026-09-02 (Phase 2 v3 pilot). Everything a
    // direct sale needs is staged (Paddle price, R2 master, previews, cover,
    // companion); the switch to "published" is the Founder's Gate 12 call
    // after Gate 2 (rights) and Gate 8 (price) sign-off. Facts below come
    // from the book project's QA/interior-main.json and CLAIMS.jsonl.
    slug: "the-puzzles-of-henry-dudeney",
    title: "The Puzzles of Henry Dudeney",
    subtitle:
      "110 Classic Problems from Amusements in Mathematics and The Canterbury Puzzles — Annotated, with Hints, a Glossary of Old Money and a Chronology",
    language: "en",
    pageCount: 144,
    categories: ["puzzle-and-challenge", "classics-and-philosophy"],
    authors: ["henry-dudeney", "emre-dogan"],
    bisac: ["GAM007000", "MAT025000"],
    series: { name: "Valice Classics", volume: 2 },
    // PUBLISHED 2026-09-02 on the Founder's written approval: Gates 2 (rights),
    // 5 (facts), 8 (price) and 12 (publication) signed, prices $9.99 direct /
    // $14.99 paperback confirmed, AI declaration given. Gates 1, 3, 4, 6, 7, 9,
    // 10 and 11 were already passed. All twelve are recorded in the book
    // project's gates.json with their evidence.
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_now", why: "Rebuilt 2026-09-03. The book's only companion mention had been one line inside the imprint on p. 4; p. 144 was an empty page carrying a running head. That page is now the companion page. 144 before, 144 after — and this edition has not been uploaded yet, so nothing at KDP is affected." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142181",
    onelinePromise:
      "Dudeney's best puzzles in his own words, with a hint for every one, a difficulty mark, and the old money explained.",
    description:
      "One hundred and ten puzzles chosen from the five hundred and forty-four in Dudeney's two great books, arranged in seven parts by kind — money and markets, ages and clocks, digits and magic squares, cutting and fitting, counters and routes, combinations and the chessboard, and the tales of the Canterbury pilgrims. Every statement and every solution is Dudeney's own text from the 1907 and 1917 editions, with the original figures. Added: a 2,000-word introduction, an editor's hint for every puzzle that says where to look without giving the answer, a difficulty mark, editor's notes on the famous ones, a glossary of pounds, shillings and pence, a chronology of Dudeney's life, and a concordance back to the original numbering. 144 pages, 6 × 9 in.",
    idealReader:
      "Someone who has met the Haberdasher's puzzle or the spider and the fly and wants the rest, with enough help to finish and enough honesty to know what is Dudeney's and what is ours.",
    formats: [
      {
        format: "ebook",
        // ON SALE 2026-09-02. Gate 12 signed; the Paddle price below is the
        // live one provision-paddle.mjs created and verified against the live
        // account (active, 999 USD, one-time, quantity 1–1).
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 144,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/the-puzzles-of-henry-dudeney/master/v1/master.pdf",
        // The first Valice edition to deliver two files. One purchase, both:
        // the worker stamps the PDF page by page and appends a licence leaf to
        // the EPUB. Written here only because the object is actually in the
        // bucket and the worker actually reads it — see PHASE_4_REPORT §EPUB.
        epubFileKey: "books/the-puzzles-of-henry-dudeney/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-02, direct ebook: $9.99 nets $8.99 after Paddle (90%); the Valice Classics bible allows $7.99–9.99 and this edition carries a 28% original apparatus (QA/interior-main.json editorShare 0.279).",
      },
      {
        format: "paperback",
        // VERIFIED LIVE 2026-09-07 on the KDP bookshelf and on the listing:
        // paperback, $14.99, 144 pp, 6 x 9 in, In Stock, submitted 2026-09-04.
        // The row said coming_soon / not_created / asin: null — written before
        // the upload and never revisited. The proposed price became the charged
        // price, so priceBasis below is now a record of a decision taken, not of
        // one pending.
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(14.99),
        pageCount: 144,
        isbn13: "979-8171876937",
        amazonAsin: "B0HHS2JW9N",
        amazonUrl: "https://www.amazon.com/dp/B0HHS2JW9N",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "LIVE AT $14.99 since 2026-09-04. price-engine.mjs 2026-09-02, 144 pp 6×9 B&W public domain: prints at $2.73; $12.99 nets $5.07 (39%), $14.99 nets $6.27 (41.8%), $16.99 nets $7.47. $14.99 was proposed for a 144-page annotated edition and is what the listing charges. Interior and full-wrap cover are built (OUTPUT/interior-main.pdf, OUTPUT/KDP/PAPERBACK/cover.pdf \u2014 the cover was rebuilt from the Founder's artwork on 2026-09-04; the typographic one it replaced is in 09_ARCHIVE/covers-superseded-2026-09-04/).",
      },
    ],
    blockers: [
      "The paperback is built and preflight-clean but has never been uploaded to KDP — that is a Founder action, and it needs a physical proof copy first. The catalogue keeps it coming_soon with no ASIN until it is live.",
      "Before that upload, the KDP AI declaration must be re-decided. The Founder declared no AI use; the project records that the editorial apparatus — 28.1% of the words — was agent-drafted, which is 'AI-generated' under Amazon's own definition. It does not affect the direct ebook, which makes no declaration to anyone. See project_config.json → compliance.aiDisclosure.textConflict.",
      "The direct edition ships the watermarked PDF only. The EPUB is built and epubcheck-clean; nothing delivers it yet, so nothing advertises it.",
      "No Kindle edition planned: public-domain titles are capped at the 35% royalty on KDP and the Kindle store already carries the same text for free at BSR #193.",
    ],
  },

  {
    slug: "epictetus-discourses-and-enchiridion",
    title: "Epictetus: The Discourses and Enchiridion",
    subtitle:
      "The George Long Translation, Annotated — the Complete Enchiridion, 68 Discourses in Seven Thematic Parts, 120 Head-Notes, a Stoic Glossary and a Concordance to the Meditations",
    language: "en",
    pageCount: 176,
    categories: ["classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["PHI011000", "PHI002000"],
    series: { name: "Valice Classics", volume: 3 },
    // READY TO PUBLISH, HELD ON ONE DEPENDENCY. Gates 2 (rights) and 5 (facts)
    // are signed, compliance-lint is clean with the AI disclosure decided under
    // constitution Article 20, the R2 masters are uploaded and hash-verified,
    // and the preview pages are rendered.
    // ON SALE 2026-09-04. Paddle price provisioned live, R2 masters uploaded and
    // content-verified, fulfillment mapping in place. The blocker that held all five
    // was one malformed line in .env shadowing the live key; FOUNDER F-004 is closed.
    websiteStatus: "published",
    linkageDecision: { decision: "house_pipeline", why: "The dedicated companion page is built by scripts/factory/build-companion-pages.mjs — the house tool — not by this book\u2019s own typesetter. An earlier build authored the page natively; that was a parallel system with none of the house pipeline\u2019s verification, and it was removed. The pipeline appended the leaf (175 \u2192 176 pp), read the file back to confirm the page count and the printed address, and decoded the QR module-by-module against the URL it carries: p.176, QR 24% of page height, 1.696 mm per module against a 0.5 mm print floor. The wrap was already built at 176 pp and its spine agrees with the pipeline\u2019s arithmetic to four decimals, so no cover rebuild was needed." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142183",
    onelinePromise:
      "The book Marcus Aurelius read, in the same translator's English, with a head-note on every chapter and the passages he reused marked.",
    description:
      "Epictetus was born a slave and taught that nobody could govern a man who wanted nothing they controlled. He wrote none of it down; his student Arrian did. This edition prints Arrian's handbook \u2014 the complete Enchiridion, all fifty-two chapters \u2014 first, as the shorter way in, then the sixty-eight Discourses George Long selected in 1877, arranged into seven thematic parts instead of the unbroken sequence Long printed. The text is Long's, unaltered. Around it: a 3,000-word introduction, an introduction to each part, a head-note on every one of the 120 chapters, a glossary of the eighteen terms Epictetus uses technically and English hides, a biographical index of the people he names without introducing, a chronology, an index of thirty-four subjects generated from the text, and a concordance to the Meditations listing the four passages where George Long's two translations touch \u2014 and the two he cites that turned out not to be in this selection. 176 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who read the Meditations, wanted the source, and would rather be told plainly which translation they are holding and what it leaves out.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 176,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/epictetus-discourses-and-enchiridion/master/v1/master.pdf",
        epubFileKey: "books/epictetus-discourses-and-enchiridion/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-04, direct ebook: $9.99 nets $8.99 after Paddle (90%). The Valice Classics bible allows $7.99\u20139.99 for the minimum apparatus standard and $12.99 for premium; this edition measures 20.0% original matter (QA/differentiation.json), which is the floor, not premium \u2014 so $9.99, the same as Meditations and Dudeney.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1699,
        pageCount: 176,
        amazonAsin: "B0HJ6G2B4L",
        amazonUrl: "https://www.amazon.com/dp/B0HJ6G2B4L",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-08 at $16.99. Earlier reasoning: price-engine.mjs 2026-09-04, 176 pp 6\u00d79 B&W public domain: prints at $3.11, KDP minimum list $5.19. $16.99 nets $7.08 (41.7%); the engine's recommended list is $12.99 and the Valice Classics bible's band is $16.99\u201319.99 once an edition has proved itself. DECIDED at $16.99 on 2026-09-06: the price-engine was re-run at the MEASURED 176 pages and the files are built, preflight clean and packaged. What is left is the upload itself.",
      },
    ],
    blockers: [
      "Not on KDP, which is why the paperback reads coming_soon and not available: the files are built, preflight clean and packaged, but no Amazon listing exists and a reader cannot buy what is not listed. The handbook is at ROADMAP-BOOKS/05-EPICTETUS-DISCOURSES-AND-ENCHIRIDION/KDP_UPLOAD_GUIDE.html. The upload is a Founder action. The direct ebook is on sale here regardless.",
      "Gates 7 (cover) and 8 (interior/proof) are unsigned, so the proof is unseen. Gates 2 (rights), 4 (content), 5 (facts) and 9 (metadata) are signed. The cover was corrected on 2026-09-06: the title line now matches the listed title, and the barcode rectangle carries zero text.",

      "No Kindle edition and no hardcover or large print are planned at launch; each decision is recorded below rather than assumed.",
      "No Kindle edition planned at launch: KDP caps public-domain content at the 35% royalty tier and the Kindle store already carries several free Epictetus editions. It is a discovery channel, not a revenue one, and the decision is recorded rather than assumed.",
      "No hardcover and no large print. 176 pages qualifies for KDP hardcover (75\u2013550), but a hardcover on an unproven public-domain title competes with established hardback classics series at a price this edition has not earned. Large print would push 176 pages to roughly 330 and the list to about $22.99 with no evidence of demand. Both are deferred until the paperback has sold; the reasons are written down so the decision can be revisited rather than re-derived.",
    ],
  },

  {
    slug: "seneca-selected-dialogues",
    title: "Seneca: Selected Dialogues",
    subtitle:
      "Five Dialogues Complete in Aubrey Stewart's Translation, Annotated — with an Argument Map of All 79 Chapters, a Glossary, a Biographical Index and a Chronology",
    language: "en",
    pageCount: 154,
    categories: ["classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["PHI011000", "PHI002000"],
    series: { name: "Valice Classics", volume: 4 },
    // READY TO PUBLISH, HELD ON ONE DEPENDENCY — identical position to volume 3.
    // Gates 2 and 5 signed, compliance clean, masters uploaded and hash-verified,
    // previews rendered. Held "draft" only because no live Paddle key exists in
    // this environment, and the catalogue refuses to publish a page for a book
    // that cannot be bought or linked. FOUNDER F-004.
    // ON SALE 2026-09-04. Paddle price provisioned live, R2 masters uploaded and
    // content-verified, fulfillment mapping in place. The blocker that held all five
    // was one malformed line in .env shadowing the live key; FOUNDER F-004 is closed.
    websiteStatus: "published",
    linkageDecision: { decision: "house_pipeline", why: "Dedicated companion page built by scripts/factory/build-companion-pages.mjs and appended as a leaf (155 \u2192 156 pp). The interior builder pads to an ODD count on purpose, because the companion leaf is what makes the final count even. Verified by reading the file back: p.154, QR 25% of page height, 1.947 mm per module. The wrap was built at 156 pp and agrees with the pipeline\u2019s spine arithmetic." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142187",
    onelinePromise:
      "Nero's tutor on how to live, with the life told honestly beside the essays \u2014 including the twelve chapters where he defends being rich.",
    description:
      "In the spring of 65, on the emperor's orders, the richest private citizen in Rome opened his veins and took a very long time to die. He had been Nero's tutor, then his minister, then the man who drafted the public justification for matricide \u2014 and he had written, while doing all of it, the most quotable defence of the simple life in Latin.\n\nThis edition prints five of Seneca's twelve dialogues, complete and unabridged, in Aubrey Stewart's 1889 translation: On the Shortness of Life, On Peace of Mind, On the Happy Life, On Providence and On Leisure. They are the five about how to live, and they argue with each other.\n\nAround them: a 3,000-word introduction that takes up George Long's refusal to discuss Seneca at all \u2014 Long, who translated the Meditations Valice publishes, said only that his writings and his life must be taken together \u2014 an introduction to each dialogue, an argument map giving a line to every one of the 79 chapters (Seneca wrote no headings; the numbers were added by later editors), a glossary of 14 working terms, a biographical index, a chronology that sets the essays beside Nero's reign, and an index of 30 subjects generated from the text.\n\nTwo of the five are incomplete in the manuscripts. The edition says which, and where, and does not supply endings that do not exist.\n\n154 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who has met Seneca in quotation and wants the essays whole, with the life told honestly beside them.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 154,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/seneca-selected-dialogues/master/v1/master.pdf",
        epubFileKey: "books/seneca-selected-dialogues/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-04, direct ebook: $9.99 nets $8.99 after Paddle (90%). Measured 20.0% original apparatus (QA/differentiation.json) \u2014 the Valice Classics floor, not the premium tier \u2014 so $9.99, matching the other three Classics titles.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1599,
        pageCount: 154,
        amazonAsin: "B0HJDMFV1R",
        amazonUrl: "https://www.amazon.com/dp/B0HJDMFV1R",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-10 at $15.99. Earlier reasoning: price-engine.mjs 2026-09-04, 154 pp 6\u00d79 B&W public domain: prints at $2.85, KDP minimum list $4.79. $15.99 nets $6.72 (42.0%); the engine's recommended list is $11.99. Set one dollar below the Epictetus paperback because the book is twenty pages shorter. Proposal \u2014 the Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "Not on KDP. These editions are built and packaged, and the print upload is a Founder action \u2014 see the KDP upload handbook in PHASE-1-REPORT. The direct ebook is on sale here regardless.",
      "Gates 7 (cover) and 8 (interior/proof) are unsigned, so the paperback list price is proposed rather than decided. Gates 2 (rights), 4 (content), 5 (facts) and 9 (metadata) are signed.",

      "Volume-mate note: this edition and the Epictetus volume share a translator-era and a price band; neither has market evidence yet, so Gate 1 is open for both.",
      "No Kindle edition planned at launch: KDP caps public-domain content at 35% and free Seneca editions already saturate the Kindle store.",
      "No hardcover and no large print. 154 pages qualifies for KDP hardcover, but a hardcover on an unproven public-domain title competes with Penguin and Everyman hardbacks at a price this edition has not earned. Large print would take 154 pages to roughly 285 and the list to about $21.99 with no demand evidence. Both deferred, with the reasons recorded so the decision can be revisited.",
      "Gate 5 is signed and all twelve claims are VERIFIED. The five that were PENDING were resolved by cutting or hedging: Gallio was confirmed at Acts 18:12 and in the source text itself, the Dio fortune figure and the Jerome attribution were cut, the nine-tragedies count was removed, and the cognitive-therapy resemblance was softened.",
    ],
  },

  {
    slug: "myths-and-legends-of-china",
    title: "Myths and Legends of China",
    subtitle:
      "Volume One: The Gods \u2014 8 Chapters Complete in the 1922 Text, Annotated, with a Register of the 9 Celestial Ministries, a Glossary of 25 Figures with Verified Chapter References and a Chronology",
    language: "en",
    pageCount: 108,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["SOC011000", "REL114000"],
    series: { name: "Valice Classics", volume: 5 },
    // SPLIT, DELIBERATELY. Werner's twelve narrative chapters measured 13.3%
    // original matter against a 20% floor, and the gap could only be closed by
    // padding \u2014 which the constitution forbids \u2014 or by choosing a smaller
    // subject. The eight chapters here are the ones in which Werner sets out the
    // divine order; the four long legend cycles (Kuan Yin, the Guardian, Monkey,
    // the fox-spirits) are 31,744 words and become volume two. This volume
    // measures 22.1%, above the floor with real margin and without a padded
    // sentence in it.
    // ON SALE 2026-09-04. Paddle price provisioned live, R2 masters uploaded and
    // content-verified, fulfillment mapping in place. The blocker that held all five
    // was one malformed line in .env shadowing the live key; FOUNDER F-004 is closed.
    websiteStatus: "published",
    linkageDecision: { decision: "house_pipeline", why: "The companion leaf is appended by scripts/factory/build-companion-pages.mjs \u2014 the house tool \u2014 not by this book\u2019s typesetter. The interior is built deliberately ODD (107 pp) so the appended leaf makes the final count even, as KDP requires." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142190",
    onelinePromise:
      "The Chinese gods do not rule \u2014 they are posted, promoted and demoted. Eight chapters of Werner\u2019s 1922 classic, with the celestial civil service mapped from his own text.",
    description:
      "Thunder is a ministry. So are the waters, fire, epidemics, medicine and exorcism, each with a president, a staff and a jurisdiction; a dragon-king can be taken to court and usually loses. E. T. C. Werner spent thirty-three years as a British consul in China, retired to Peking and stayed, and he translated these myths from Chinese sources rather than from other Europeans. This first volume prints the eight chapters in which he sets out that divine order \u2014 the creation of the world from P\u2019an Ku\u2019s body, the archer who shot down nine of the ten suns, the ministries of the natural world, the Eight Immortals, and a war in heaven \u2014 complete and unaltered. The four long legend cycles (Kuan Yin, the Guardian of the Gate of Heaven, Monkey and the fox-spirits) are held for volume two, and the book says so on its first page rather than on its last. Around the text: an introduction, an introduction to each chapter, a register of the nine celestial ministries assembled from the printed chapters because Werner\u2019s own catalogue of them is not in this selection, a glossary of twenty-five figures whose chapter references were produced by searching the text, a note on the Wade-Giles romanisation, a chronology and an index of subjects. The 1922 colour plates are not reproduced: no source names their artist, so they cannot be cleared. 108 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who knows Greek or Norse myth and wants the Chinese material from a man who read the sources \u2014 with enough apparatus to keep several hundred Wade-Giles names straight.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 108,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/myths-and-legends-of-china/master/v1/master.pdf",
        epubFileKey: "books/myths-and-legends-of-china/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-04, direct ebook: $9.99 nets $8.99 after Paddle (90%). The Valice Classics bible allows $7.99\u20139.99 for the minimum apparatus standard and $12.99 for premium; this edition measures 22.1% original matter (QA/differentiation.json) \u2014 above the 20% floor but short of the 35% premium tier \u2014 so $9.99, the same as the other Classics.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1399,
        pageCount: 108,
        amazonAsin: "B0HJ7N35KS",
        amazonUrl: "https://www.amazon.com/dp/B0HJ7N35KS",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-09 at $13.99. Earlier reasoning: price-engine.mjs 2026-09-04, 108 pp 6\u00d79 B&W public domain: prints at $2.30 (flat rate under 110 pp), KDP minimum list $3.84, recommended list $9.99. Proposed at $13.99, which nets $6.09 (43.6%). Deliberately below the $16.99 proposed for Epictetus: this is a 108-page book against a 176-page one, and pricing it level would be charging the same for less. The Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "Not on KDP. These editions are built and packaged, and the print upload is a Founder action \u2014 see the KDP upload handbook in PHASE-1-REPORT. The direct ebook is on sale here regardless.",

      "Gate 8 (interior) and Gate 7 (cover) are unsigned: the paperback list price is proposed, not decided, and the Founder signs the price.",
      "No Kindle edition planned at launch. KDP caps public-domain content at the 35% royalty tier and the Kindle store already carries free Werner editions; it is a discovery channel rather than a revenue one, and the decision is recorded rather than assumed.",
      "No hardcover and no large print. At 108 pages a hardcover is not offered by KDP below 75 pages but would compete with established mythology hardbacks at a price this edition has not earned; large print would roughly double the extent with no demand evidence. Both deferred with the reason recorded.",
      "Volume two (Kuan Yin, the Guardian of the Gate of Heaven, Monkey, Fox Legends \u2014 31,744 words) is scoped and unbuilt. The apparatus of this volume refers to it as forthcoming, which is a promise this house has to keep.",
    ],
  },

  {
    slug: "indian-myth-and-legend",
    title: "Indian Myth and Legend",
    subtitle:
      "Volume One: The Vedic Gods \u2014 5 Chapters Complete in the 1913 Text, Annotated, with a Register Grading the Author's Comparisons and a Who's-Who of 32 Figures with Verified Chapter References",
    language: "en",
    pageCount: 94,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["SOC011000", "REL032000"],
    series: { name: "Valice Classics", volume: 6 },
    // The Werner lesson applied BEFORE writing rather than after: the selection
    // was measured against the 20% floor at the outset. Mackenzie's 26 chapters
    // are ~140,000 words; the five printed here are the Vedic gods themselves,
    // and they measure 21.5%. The Mahabharata, Nala and Ramayana cycles are
    // roughly 100,000 words and become later volumes.
    // ON SALE 2026-09-04. Paddle price provisioned live, R2 masters uploaded and
    // content-verified, fulfillment mapping in place. The blocker that held all five
    // was one malformed line in .env shadowing the live key; FOUNDER F-004 is closed.
    websiteStatus: "published",
    linkageDecision: { decision: "house_pipeline", why: "The companion leaf is appended by scripts/factory/build-companion-pages.mjs. The interior is typeset deliberately ODD (93 pp) so the appended leaf makes 94, the even count KDP requires." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142193",
    onelinePromise:
      "The Indian gods in their first form, before Hinduism demoted them \u2014 with a register telling you which of a 1913 author's comparisons still stand.",
    description:
      "The gods in this book lose. Indra opens it as king of heaven holding the thunderbolt, and Indian religion spends the next two thousand years demoting him; Varuna, the most morally serious god in the Vedic pantheon, all but disappears; and the two figures who get walk-on parts here \u2014 Vishnu, and Rudra who becomes Shiva \u2014 inherit everything. This is the pantheon in its first form, not its final one.\n\nDonald Mackenzie was a Scottish journalist rather than an orientalist, and this edition says so plainly: he worked from translations and from Macdonell, Oldenberg and Monier Williams, and what he supplied was arrangement and pace. Judged as that, it is very good. Five chapters are printed complete and unaltered \u2014 Indra; the great Vedic deities; Yama, the first man and king of the dead; the demons, giants and fairies; and the mysteries of creation, including the hymn that ends by allowing that possibly nobody knows how the world began.\n\nAround the text, and original to this edition: an introduction; an introduction to each chapter; a register grading Mackenzie's relentless comparisons \u2014 Indo-Iranian, wider Indo-European, Babylonian, decorative \u2014 by how much weight each still bears; a who's-who of 32 figures whose chapter references were produced by searching the text, which is how it was discovered that the book contains two different Savitris; a note on the Sanskrit names; a chronology; and an index of 34 subjects generated from the text.\n\nNone of the 1913 illustrations is reproduced. Two of those in these chapters are paintings by Nandalal Bose, who died in 1966 and whose work is in copyright until 2037; the rest name no creator. 94 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who knows Greek or Norse myth, wants the Indian material, and would rather be told which parts of a hundred-year-old book have not aged well than have them quietly cut.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 94,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/indian-myth-and-legend/master/v1/master.pdf",
        epubFileKey: "books/indian-myth-and-legend/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-04, direct ebook: $9.99 nets $8.99 after Paddle (90%). 21.5% original matter (QA/differentiation.json) is above the 20% floor and short of the 35% premium tier, so the same $9.99 as the other Valice Classics.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1299,
        pageCount: 94,
        amazonAsin: "B0HJ5RB8BR",
        amazonUrl: "https://www.amazon.com/dp/B0HJ5RB8BR",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-08 at $12.99. Earlier reasoning: price-engine.mjs 2026-09-04, 94 pp 6\u00d79 B&W public domain: prints at $2.30 (flat rate under 110 pp), KDP minimum list $3.84, recommended $9.99. Proposed at $12.99, which nets $5.49 (42.3%). A dollar under the Werner volume because it is fourteen pages shorter, on the same principle that put Werner below Epictetus. The Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "Not on KDP. These editions are built and packaged, and the print upload is a Founder action \u2014 see the KDP upload handbook in PHASE-1-REPORT. The direct ebook is on sale here regardless.",

      "Gates 7 (cover) and 8 (interior/proof) are unsigned: the paperback list price is proposed, not decided.",
      "No Kindle edition planned at launch. KDP caps public-domain content at the 35% royalty tier and free Mackenzie editions already exist on Kindle.",
      "No hardcover and no large print. At 94 pages neither is a serious proposition for an unproven title; both deferred with the reason recorded.",
      "Volumes two to four (the Mahabharata cycle, the Nala romance and the Ramayana \u2014 roughly 100,000 words) are scoped and unbuilt. This volume's apparatus refers to them as forthcoming.",
      "Warwick Goble's eight colour plates ARE public domain (he died in 1943) but none falls in these five chapters. They are available to the epic volumes and are a real asset for them.",
    ],
  },

  {
    // ADDED 2026-09-19. Live on Amazon since 2026-09-11 (B0HJG58238) and absent
    // from this catalogue, from digital-edition-sources.mjs and from the preview
    // manifest — a whole book that existed on Amazon and in no record this house
    // keeps. Nothing about it was inferred: the ASIN, price and subtitle were read
    // off the KDP bookshelf, the page count off the built interior, the cover out
    // of the book's own EPUB.
    slug: "puzzles-old-and-new",
    title: "Puzzles Old and New",
    subtitle:
      "Volume One: The Puzzles You Can Solve Tonight \u2014 Five Chapters Complete in the 1893 Text, Annotated, with Every Figure Redrawn",
    language: "en",
    pageCount: 102,
    categories: ["games-and-play", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["GAM002000", "REF000000"],
    series: { name: "Valice Classics", volume: 15 },
    websiteStatus: "published",
    linkageDecision: { decision: "house_pipeline", why: "The companion leaf is appended by scripts/factory/build-companion-pages.mjs, as with the rest of Valice Classics." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    // WIRED 2026-09-19. Lemon Squeezy product 1373111, variant 2145449, created in
    // the dashboard (the API still answers 405 on POST /v1/products) and read back
    // from the store's own product list: status "published", price 999, test_mode
    // false. This is the product the blocker below called "the 28th".
    providerPriceId: "2145449",
    onelinePromise:
      "The five chapters of Hoffmann's 1893 survey you can actually sit down and solve, with every figure redrawn and every answer kept where it belongs.",
    description:
      "In 1893 Professor Hoffmann \u2014 the man who had taught England how to write down a conjuring trick \u2014 tried to put every puzzle he could find into one volume. He got a long way, and discovered in the doing why nobody had managed it.\n\nThis edition prints five chapters complete and unaltered from the first edition, set from the Boston Public Library copy: the chapters whose puzzles need nothing but the page in front of you and a little patience. Every figure has been redrawn for this edition rather than reproduced from the scan, so a diagram is legible at reading size instead of being a grey smear of 1893 halftone.\n\nOriginal to this edition: an introduction placing Hoffmann among his contemporaries, head-notes orienting each chapter, difficulty ratings, a glossary, a register of the text's own claims, and an index. The 1893 text is in the public domain; the apparatus is \u00a9 Valice Press and is declared to Amazon as AI-generated text under human editorial direction.\n\n102 pages, 6 \u00d7 9 in.",
    idealReader:
      "Somebody who wants Victorian puzzles they can actually solve tonight, and who would rather have five chapters printed whole than fifty excerpted.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 102,
        isbn13: null,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/puzzles-old-and-new/master/v1/master.pdf",
        epubFileKey: "books/puzzles-old-and-new/master/v1/master.epub",
        priceBasis:
          "$9.99, the Valice Classics direct-ebook price the rest of the series carries. WIRED TO A CHECKOUT 2026-09-19: Lemon Squeezy variant 2145449 carries the same 999 cents, read back from the live store rather than typed.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1399,
        pageCount: 102,
        isbn13: null,
        amazonAsin: "B0HJG58238",
        amazonUrl: "https://www.amazon.com/dp/B0HJG58238",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 \u2014 live since 2026-09-11 at $13.99.",
      },
    ],
    blockers: [
      "CLEARED 2026-09-19. The 28th Lemon Squeezy product now exists — product 1373111, variant 2145449, $9.99, published, test_mode false — so the ebook can be bought here. Created in the dashboard because the API still refuses POST /v1/products.",
      "No ISBN. The paperback carries a free KDP-assigned ISBN; nothing has been read off the content page for it yet, so ISBN-REGISTRY.md records the edition without a number rather than guessing one.",
    ],
  },
  {
    slug: "mythical-monsters",
    title: "Mythical Monsters",
    subtitle:
      "Volume One: The Dragon \u2014 3 Chapters Complete in the 1886 Text, Annotated, with a Register Setting Six of the Author's Claims Against What Is Established and His Sources Graded",
    language: "en",
    pageCount: 74,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["SOC011000", "NAT017000"],
    series: { name: "Valice Classics", volume: 7 },
    // The one book in Phase 1 whose central thesis is FALSE, and the apparatus
    // is built around saying so. Gould \u2014 first Government Geologist of
    // Tasmania \u2014 argued that dragons were real animals remembered. The
    // Register of Claims sets six assertions against what is established and
    // marks which is which, because publishing the thesis silently would be
    // dishonest and dropping it would remove half the interest.
    // ON SALE 2026-09-04. Paddle price provisioned live, R2 masters uploaded and
    // content-verified, fulfillment mapping in place. The blocker that held all five
    // was one malformed line in .env shadowing the live key; FOUNDER F-004 is closed.
    websiteStatus: "published",
    linkageDecision: { decision: "house_pipeline", why: "The companion leaf is appended by scripts/factory/build-companion-pages.mjs. The interior is typeset deliberately ODD (73 pp) so the appended leaf makes 74." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142197",
    onelinePromise:
      "A trained geologist argues that dragons were real animals \u2014 carefully, from true premises, to a false conclusion. With a register saying exactly where it fails.",
    description:
      "Charles Gould believed that dragons were real animals: large reptiles that lived alongside early humans, were accurately described by them, and became extinct within historical memory. He was wrong.\n\nHe was also the first Government Geologist of Tasmania, trained at the Royal School of Mines, a veteran of the Geological Survey of Great Britain, and the son of John Gould the ornithologist. This is not a crank's book. It is a trained scientist applying a real method to a false hypothesis, and in 1886 nobody could yet tell him that the gap he needed to close was sixty-six million years wide.\n\nThree chapters are printed complete and unaltered \u2014 the dragon, the Chinese dragon, the Japanese dragon \u2014 which together are Gould's whole treatment of one creature. The Chinese chapter is the reason the book survives its own thesis: he reads the Shan Hai King, the Yih King and the 'Rh Ya as sources with dates and reliability, which almost no English writer on myth was doing then, and he reports \u2014 against his own case \u2014 that in the older and more credible layer, dragons are infrequent.\n\nAround the text, original to this edition: a Register of Claims setting six of his assertions beside what is actually established, with an editorial reading of each; a graded list of his sources, from the Chinese classics down to the Victorian newspapers he treats as comparable testimony; a glossary of eighteen dragon terms with chapter references produced by searching the text; a chronology whose first two rows are the whole answer to his thesis; and an index.\n\nNone of the 1886 figures is reproduced: the book names no illustrator, so they cannot be cleared. 74 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who enjoys watching a careful argument fail, and would rather be shown where it fails than have the failure quietly edited out.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 74,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/mythical-monsters/master/v1/master.pdf",
        epubFileKey: "books/mythical-monsters/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-04, direct ebook: $9.99 nets $8.99 after Paddle (90%). 22.0% original matter (QA/differentiation.json), above the 20% floor and short of the 35% premium tier, so the same $9.99 as the other Valice Classics.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1199,
        pageCount: 74,
        amazonAsin: "B0HJD2NCR4",
        amazonUrl: "https://www.amazon.com/dp/B0HJD2NCR4",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-10 at $11.99. Earlier reasoning: price-engine.mjs 2026-09-04, 74 pp 6\u00d79 B&W public domain: prints at $2.30 (flat rate under 110 pp), KDP minimum list $3.84. Proposed at $11.99, which nets $4.89 (40.8%). A dollar under the Mackenzie volume because it is twenty pages shorter, on the same principle applied down the series. The Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "Not on KDP. These editions are built and packaged, and the print upload is a Founder action \u2014 see the KDP upload handbook in PHASE-1-REPORT. The direct ebook is on sale here regardless.",

      "Gates 7 (cover) and 8 (interior/proof) are unsigned: the paperback list price is proposed, not decided.",
      "No Kindle edition planned at launch. KDP caps public-domain content at the 35% royalty tier and free Gould editions already exist.",
      "No hardcover and no large print. At 74 pages neither is a serious proposition; both deferred with the reason recorded.",
      "Volume two (the sea-serpent, 25,000 words) and volume three (the unicorn and the Chinese phoenix) are scoped and unbuilt.",
      "Chapters I to V \u2014 Gould's geological argument \u2014 are not printed in any planned volume. The apparatus supplies what a reader needs of them, which is a deliberate choice and is recorded as one.",
    ],
  },

  {
    slug: "games-ancient-and-oriental",
    title: "Games Ancient and Oriental: The Egyptian Games",
    subtitle:
      "Edward Falkener's 1892 Reconstruction, Annotated \u2014 with Dr Samuel Birch's 1864 Paper, a Register of Reconstructions, Five Original Diagrams and the Move Tables Rebuilt from the Scan",
    language: "en",
    pageCount: 78,
    categories: ["games-and-play", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["GAM001000", "HIS002030"],
    series: { name: "Valice Classics", volume: 8 },
    // PHASE 2, BOOK 1. Built from an Internet Archive SCAN rather than a proof-read
    // transcription, which is a different kind of source and is treated as one: the
    // running heads are found structurally, the 1892 folios are validated against a
    // physical constraint before being printed, every correction was read off the page
    // image, and the move tables are rebuilt from the OCR's own word coordinates.
    // What could not be read is marked, not smoothed. QA/parse-report.json has the counts.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    // The product and price are written and priced; creating them on the live
    // Paddle account is a write this environment's permission layer does not
    // allow, and routing around that block would defeat it. FOUNDER F-019 holds
    // the one command. Until it runs the ebook is `coming_soon`, not `available`,
    // because a buy button with no price behind it is a lie.
    directSaleBlockedBy: null,
    providerPriceId: "2142199",
    onelinePromise:
      "The first serious attempt to make a dead game playable again \u2014 with the seam marked, for the first time, between what the evidence shows and what Falkener supplied.",
    description:
      "In 1892 an English architect did what no antiquary had done: he wrote down the rules. Two centuries of scholars had collected every classical passage about ancient board games and left them, as Falkener complained, a skeleton \u2014 \u201cthe bones of the entire skeleton have been put together, but there they remained; the game was not played.\u201d So he supplied the play. The ancient sources do not contain those rules. They are his, inferred from a board, a piece count and a few lines of Latin verse, and the book prints them in the imperative with worked games played to a finish and nothing marking where the evidence stops. This edition marks it. A Register of Reconstructions separates, for each of the three games, what the evidence shows, what Falkener supplies, and what is known now \u2014 which in every case includes that the rules are still not known. Sections I to VI complete: Falkener's introduction, the games of the ancient Egyptians, the Manchester relics, and Tau, Senat and Hab em Han. With the 1864 paper Dr Samuel Birch of the British Museum wrote for him \u2014 the best thing in the volume, and the place where a specialist marks his own uncertainty. Around them: five original diagrams, each marked EVIDENCE or RECONSTRUCTION on its face, a glossary of the terms, a chronology, an index of subjects generated from the text, and a note on the text that says exactly what a scan can and cannot give you. 78 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who likes ancient games and would rather be told which parts of a reconstruction are evidence and which are the reconstructor.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(7.99),
        pageCount: 78,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/games-ancient-and-oriental/master/v1/master.pdf",
        epubFileKey: "books/games-ancient-and-oriental/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-05, direct ebook, public domain: recommended $6.99, and $7.99 nets $7.09 after Paddle. The Valice Classics band is $7.99\u20139.99 for the minimum apparatus standard. This edition measures 28.0% original matter (QA/differentiation.json) \u2014 above the 20% floor \u2014 but it is 78 pages against the 154\u2013176 of the other Classics titles, so it is priced at the bottom of the band rather than at the $9.99 the longer volumes carry.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1299,
        pageCount: 78,
        amazonAsin: "B0HJ5KZH5J",
        amazonUrl: "https://www.amazon.com/dp/B0HJ5KZH5J",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-08 at $12.99. Earlier reasoning: price-engine.mjs 2026-09-05, 78 pp 6\u00d79 B&W: prints at $2.30 on the flat rate for 110 pages or under, KDP minimum list $3.84, recommended $9.99. $12.99 nets $5.49 (42.3%). The Classics band of $16.99\u201319.99 assumes a 150-page-plus volume and this is 78, so $12.99 is proposed instead. The Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "ON SALE HERE, NOT YET ON AMAZON. The Paddle product and price are live and the "
        + "price id is now bound to this row; the R2 masters are uploaded and verified \u2014 "
        + "object, byte size, sha256 and signed-URL retrieval, 2026-09-07. The Founder "
        + "signed GATE 2 (Rights) and GATE 5 (Facts) on 2026-09-07, and GATES 7, 8 and 10 "
        + "for the print package \u2014 gates.json records each as passed, approvedBy "
        + "founder. Gates 1, 3, 6 and 11 are agent gates that have not been run; gate 11 "
        + "(website product QA) can only be run once the page is live. Gate 12, the "
        + "publication approval, is STILL not_started: the book went on sale on the "
        + "Founder's written instruction of 2026-09-07, and recording that as a founder "
        + "signature is not an agent's to write. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "Not on KDP. The interior and wrap are built and packaged; the print upload is a Founder action \u2014 see the KDP upload handbook in PHASE-2-REPORT.",
      "Nine of Falkener's tables are described rather than reproduced. The bowl game's form of throws and entries is read at 88% wrong or absent by the scan's text layer, and setting it would be worse than leaving it out. Each omission is marked in place with its size and its 1892 page. This is stated in the Note on the Text and in the product description's honesty, not hidden.",
      "This is a short volume \u2014 78 pages against 154\u2013176 for the other Classics titles \u2014 because sections I to VI are where the Egyptian argument ends and section VII changes subject to the Greek hiera gramme. Both prices are set for the length rather than for the series.",
      "No Kindle edition planned at launch: KDP caps public-domain content at the 35% royalty tier, and the Kindle store already carries free scans of this title. No hardcover: 78 pages is at the very bottom of KDP's 75\u2013550 hardcover range and would bind badly. No large print: the move tables do not enlarge usefully. Each decision is recorded rather than assumed.",
    ],
  },

  {
    slug: "korean-games",
    title: "Korean Games: The Games of Chance and Divination",
    subtitle:
      "Stewart Culin's 1895 Survey, Annotated \u2014 with a Register of Record and Inference, a Bridge to the Modern Spellings, Five Original Diagrams and Wilkinson's Chess Game Rebuilt from the Page",
    language: "en",
    pageCount: 144,
    categories: ["games-and-play", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["GAM001000", "SOC002010"],
    series: { name: "Valice Classics", volume: 9 },
    // PHASE 2, BOOK 2. Built from a Google scan on the Internet Archive, which is a
    // poorer source than book 1's: no per-word confidence, tissue guards ghosting the
    // facing page into the text layer, and a third of the book in Korean, Chinese and
    // Japanese script the OCR cannot read at all. All three are handled explicitly.
    // The single-character-confusion detector that found real errors on Falkener
    // proposed 137 substitutions here and was SWITCHED OFF as a candidate list: it
    // cannot tell a misread English word from a correctly read Korean one. Only closed
    // fault classes were applied. QA/parse-report.json and QA/debris.json have the counts.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    // As book 1: the product and price are written and priced, but creating them on the
    // live Paddle account is a write this environment's permission layer blocks, and
    // routing around that block would defeat it. FOUNDER F-022 holds the one command.
    // Until it runs the ebook is `coming_soon`, not `available`.
    directSaleBlockedBy: null,
    providerPriceId: "2142203",
    onelinePromise:
      "The book that made games evidence \u2014 with the line drawn, for the first time, between what Culin watched and what he concluded, and his Korean made searchable again.",
    description:
      "In 1893 a young Philadelphian who had never left America put on an exhibition of the world's games in Chicago, and two years later published the book that came out of it. Stewart Culin was thirty-seven and had never been to Korea. He says so himself, in his second paragraph, without apology: the collection was made in America, from museum specimens, from Chinese and Japanese shopkeepers in Eastern cities, and from Korean informants he names. Out of it he built a thesis \u2014 that games are not amusements but the wreckage of divination \u2014 and pressed it hard enough that a reader cannot always tell which sentences are the record and which are the argument. This edition draws the line. A Register of Record and Inference gives, part by part, what Culin sets down at first hand, what he is told, and what he concludes. A Note on the Spellings bridges his 1895 romanisation to the two in use today, sixteen words at a time, so that a reader who wants to look anything up can: nyout is yut, tjyang-keui is janggi, pa-tok is baduk. His introduction and games LXX to XCVII complete, in six parts \u2014 the games of the throw, the two board games, the games drawn on the ground, the tablets and the divinations, the cards, and the lottery and the riddles. W. H. Wilkinson's chapter on Korean chess is here with its thirty-move illustrative game rebuilt from the position of every word on the page: read as prose, which is what every other digital text of this book does with it, that page comes out as gibberish. Around them: five original diagrams marked EVIDENCE or RECONSTRUCTION on their faces, a playing guide that says plainly which games you can sit down and play and which you cannot, a glossary, a who's-who, a chronology, an index of subjects generated from the text, and a note on the text that says exactly what this scan can and cannot give you. 144 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who came for the games and stays for the question of how much a careful observer's theory should be allowed to colour what he wrote down.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(8.99),
        pageCount: 144,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/korean-games/master/v1/master.pdf",
        epubFileKey: "books/korean-games/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-05, direct ebook, public domain: recommended $6.99, and $8.99 nets $8.04 after Paddle. The Valice Classics band is $7.99\u20139.99. Book 8 of the series took the $7.99 floor because it is 78 pages; this is 144 with 23.0% original matter (QA/differentiation.json), five original diagrams and a rebuilt game table, so it sits in the middle of the band rather than at its floor.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1699,
        pageCount: 144,
        amazonAsin: "B0HJ7JGJ4P",
        amazonUrl: "https://www.amazon.com/dp/B0HJ7JGJ4P",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-09 at $16.99. Earlier reasoning: price-engine.mjs 2026-09-05, 144 pp 6\u00d79 B&W: prints at $2.73, KDP minimum list $4.55, recommended $10.99. $16.99 nets $7.46 (43.9%). The Classics print band is $16.99\u201319.99 and assumes a volume of about 150 pages; at 144 this is within a rounding of that assumption, so the band's floor applies rather than the short-volume exception made for book 8. The Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "ON SALE HERE, NOT YET ON AMAZON. The Paddle product and price are live and the "
        + "price id is now bound to this row; the R2 masters are uploaded and verified \u2014 "
        + "object, byte size, sha256 and signed-URL retrieval, 2026-09-07. The Founder "
        + "signed GATE 2 (Rights) and GATE 5 (Facts) on 2026-09-07, and GATES 7, 8 and 10 "
        + "for the print package \u2014 gates.json records each as passed, approvedBy "
        + "founder. Gates 1, 3, 6 and 11 are agent gates that have not been run; gate 11 "
        + "(website product QA) can only be run once the page is live. Gate 12, the "
        + "publication approval, is STILL not_started: the book went on sale on the "
        + "Founder's written instruction of 2026-09-07, and recording that as a founder "
        + "signature is not an agent's to write. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "Not on KDP. The interior and wrap are built and packaged; the print upload is a Founder action \u2014 see the KDP upload handbook in PHASE-2-REPORT.",
      "About a third of Culin's text quotes Korean, Chinese and Japanese in their own scripts, and this scan's text layer reads none of it. Those runs are marked where they stand rather than guessed at: 502 markers in the finished book. The page images are free and are the place to go for them. This is stated in the Note on the Text, not hidden.",
      "Thirty-six passages \u2014 about 598 words \u2014 are the scanner's reading of a line figure, or of the ghost a tissue guard prints onto the facing page, and are marked rather than set as Culin's prose. Every one is listed with what the scanner made of it in QA/debris.json, so the refusal can be checked. Three of Culin's tables are described rather than reproduced for the same reason.",
      "Games I to LXIX are not in this volume. They are 20,648 words of children's amusements in one-paragraph entries, and they carry none of the argument the book is built on. The scope was decided and recorded before any apparatus was written, which is the order Phase 1 taught.",
      "No Kindle edition planned at launch: KDP caps public-domain content at the 35% royalty tier, and the Kindle store already carries free scans of this title. No hardcover and no large print at launch: both are open decisions rather than refusals, and neither is claimed as planned until it is built.",
    ],
  },

  {
    slug: "kwaidan",
    title: "Kwaidan: Stories and Studies of Strange Things",
    subtitle:
      "The Complete 1904 Text, Annotated \u2014 17 Stories, 3 Insect Studies and Hearn\u2019s Own Notes, with a Register of What He Took, Was Told and Lived, a Y\u014dkai Index and a Codex Concordance",
    language: "en",
    pageCount: 142,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["lafcadio-hearn", "emre-dogan"],
    bisac: ["FIC012000", "SOC011000"],
    series: { name: "Valice Classics", volume: 13 },
    // PHASE 3, BOOK 1 (2026-09-06), and the first of the Codex Bestiarium expansion.
    // The whole of Hearn is printed \u2014 seventeen tales, three insect studies, his own
    // notes and his own prefatory note. The ONE omission is a rights finding and not a
    // scope decision: the first edition's second prefatory piece, dated March 1904, is
    // unsigned and its author is named nowhere, so no death year can be established and
    // it is not printed. Both Takeuchi Keish\u016b plates ARE printed: the roadmap expected
    // them to be unattributable, and an authority record (Wikidata Q11545824) names and
    // dates him, which clears them.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142207",
    onelinePromise:
      "The book behind the film: seventeen Japanese ghost stories and three essays on insects, complete in the 1904 text and in Hearn's own notes \u2014 and only his.",
    description:
      "In January 1904 Lafcadio Hearn finished a book of ghost stories in Tokyo and signed the note in front of it with his initials. He had eight months to live. Seventeen tales came out of it \u2014 the blind lute-player who plays for the drowned Heik\u00e9, the woman who is a willow and dies when it is felled, the face on the Akasaka road with nothing on it \u2014 and then, without changing his tone, three essays on butterflies, mosquitoes and ants. Readers have been complaining about the ants since 1904 and they are wrong: the insect studies ask the same question as the tales, on a subject that cannot be dismissed as superstition. This edition prints all twenty pieces, both of Takeuchi Keish\u016b's 1904 plates, and Hearn's own forty-nine footnotes \u2014 and not the thirty-six further notes that later hands added to the electronic text and that other editions reprint as his. Around them: an introduction of nearly three thousand words; a head-note before every piece; a REGISTER OF PROVENANCE that does what no other edition does \u2014 it separates the three pieces whose origin Hearn actually states (one Chinese, one told him by a farmer in Musashi, one that happened to him) from the sixteen he leaves open, and marks a fourth as evident autobiography he never claims, instead of assigning each tale to one of his five named books on a guess; a glossary of fifty-one Japanese terms in which every entry says whether Hearn explains it himself \u2014 on the page, in a note at the back, or never, which is the answer for eleven of them; a Y\u014dkai Register naming the creatures by what folklore calls them rather than by his titles, which matters most for \u201cMujina\u201d, where the thing on the road is a noppera-b\u014d and the animal in the title never appears; a CODEX CONCORDANCE placing all fifteen in the six classes of Codex Bestiarium, in which not one of them appears \u2014 its smallest class, the restless dead, runs to eight entries from eight traditions and none of them is Japanese, and this is the book where Japan's answer is; a gazetteer of the thirteen old provinces against the prefectures they became, which catches an error the text has carried for a century (Niigata is in Echigo, not Echizen); a chronology; and a plain account of which of Hearn's claims have not survived \u2014 the Spencerian ant sociology, the racial explanations \u2014 and the one that was right, which is the mosquito. Readers arriving from Kobayashi's 1964 film are told, in the book, that only two of its four episodes are in it. 142 pages.",
    idealReader:
      "Someone who has seen Kobayashi's film or met Yuki-Onna in a game, wants the book behind them, and would rather be told plainly which of these tales Hearn found in a Japanese book, which one a farmer told him, and which one he watched happen.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(8.99),
        pageCount: 142,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/kwaidan/master/v1/master.pdf",
        epubFileKey: "books/kwaidan/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-08, direct ebook, public domain: recommended $6.99; $8.99 nets $8.04 after Paddle at an 89.4% margin, and the ebook net does not move with the page count. This is the roadmap's own price for book 06. Mid-band for Valice Classics \u2014 47,400 words, between Chess and Playing Cards at $7.99 and The Singing Games at $9.99.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(14.99),
        pageCount: 142,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-08 at the rebuilt 142 pp, 6\u00d79 B&W on white: prints at $2.70, KDP minimum list $4.51, recommended $10.99; $14.99 nets $6.29 (42.0%) at 60% royalty.",
      },
      {
        format: "hardcover",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(29.99),
        pageCount: 142,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-08 at the rebuilt 142 pp, 6\u00d79 hardcover: prints at $7.35 \u2014 case binding is expensive at this extent \u2014 KDP minimum list $12.26, recommended $29.99, which nets $10.64 (35.5%). $24.99 would net 30.6% and miss the 35% target; the format is priced as the gift object it is, with both period plates.",
      },
    ],
    blockers: [
      "REVISED 2026-09-08 AS ROADMAP BOOK 06 — 138 pp to 142 pp. The first impression printed "
        + "thirty-six notes that Project Gutenberg's transcribers wrote, under a heading saying "
        + "they were Hearn's, and thirty-six call-marks they had inserted into his sentences; the "
        + "gazetteer said ten provinces where Hearn names twelve; the glossary heading claimed he "
        + "leaves all forty-five of its terms unexplained when he explains most of them, and "
        + "twenty of its fifty cross-references pointed at the wrong tale. All of it is fixed, a "
        + "Codex Bestiarium concordance is added, and BUILD/check_apparatus.py plus a 30-claim "
        + "SOURCE_CLAIMS.json now assert the lot at every build. The R2 masters were re-cut and "
        + "read back byte-identical on 2026-09-08; nobody had bought the old ones (0 order_items, "
        + "0 entitlements, verified against the production database). "
        + "DEPLOYED 2026-09-07 (PR #22). The Paddle product and price are live "
        + "(pri_01m1v4n80k6g2tba6wt8882ehf, verified active against api.paddle.com). The R2 "
        + "masters were uploaded and verified in an earlier session and are recorded in "
        + "`masterFileKey`; BOTH WERE RE-VERIFIED ON 2026-09-07 \u2014 object, byte size, "
        + "sha256 of the retrieved bytes and a working signed URL. F-044, which reported the "
        + "R2 credentials as placeholders, was a misreading of `[SENSITIVE]` in one export "
        + "and has been withdrawn. "
        + "The companion page and its first four sheets resolve on production — verified by HTTP, "
        + "with the served PDFs byte-for-byte the built files. THE FIFTH SHEET (the Codex "
        + "Concordance, added 2026-09-08) IS BUILT AND COMMITTED BUT NOT DEPLOYED: it is a static "
        + "file under public/ and the companion page that lists it is code, so both reach readers "
        + "only on the next deploy of this branch. Until then the printed book names five sheets "
        + "and the page offers four. GATE 2 (RIGHTS) AND GATE 5 (FACTS) "
        + "WERE SIGNED BY THE FOUNDER ON 2026-09-07. The ebook is on sale here from 2026-09-07 "
        + "on the Founder's written publication instruction of that date. GATE 12 "
        + "(publication approval) IS STILL not_started \u2014 a founder signature no agent may "
        + "write. The earlier text here said Phase 3 was not merged; it is.",
      "PADDLE TAX CATEGORY is 'standard', not 'ebooks': the account is not approved for the "
        + "reduced-rate category, so VAT is over-collected in jurisdictions that tax books "
        + "lower. FOUNDER F-029.",
      "GATE 2 IS SIGNED (Founder, 2026-09-07). Two of its four rows are decisions that go against the roadmap's "
        + "expectation \u2014 the plates ARE printed because the artist is datable after all, and "
        + "the unsigned 1904 introduction is NOT printed because its author is not. FOUNDER F-030.",
      "COVER SERIES IDIOM: this is a painted cover where COVER_STANDARDS gives Valice Classics "
        + "as typographic with one engraved device, and \u00a72.6 makes a series identity a Founder "
        + "decision. The title band is 23.7% of cover height against a 25% rule; 150 px "
        + "thumbnail contrast is 1.0. FOUNDER F-031.",
      "NO KDP LISTING YET. Paperback and hardcover are built \u2014 interior, companion leaf and "
        + "both wraps \u2014 and neither has been uploaded; `kdp: \"not_created\"` says so and no "
        + "ASIN is invented.",
      "The apparatus is 25.2% of the volume against a 20% floor, measured from the content "
        + "files by COMMON-AREA/checks/differentiation.py. It was 21.3% before this revision; "
        + "the Codex Concordance, the rewritten glossary and two more provinces account for "
        + "the rest, and 412 words of transcriber's notes left the source side.",
    ],
  },

  {
    slug: "fairy-mythology-vol-1",
    title: "The Fairy Mythology, Volume I",
    subtitle:
      "Volume I · Persia, Romance, the Eddas, Scandinavia, Germany \u2014 Keightley\u2019s 1850 Text, Annotated, with a Register of What He Translated, Collected, Read and Only Concluded",
    language: "en",
    pageCount: 336,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["thomas-keightley", "emre-dogan"],
    bisac: ["SOC011000", "OCC036000"],
    series: { name: "Valice Classics", volume: 17 },
    // PHASE 3, BOOK 5 (2026-09-07). ONE ROADMAP TITLE, TWO PRODUCT VOLUMES. The work runs to
    // ~200,000 words; in one volume it would exceed KDP\u2019s 550-page hardcover limit and
    // price the paperback near $38. The seam is Keightley\u2019s own GREAT BRITAIN division
    // and the halves come out within three hundred words of each other. Nothing is abridged.
    // Volume II is fairy-mythology-vol-2.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142216",
    onelinePromise:
      "The first attempt in English to put the fairy beliefs of Europe side by side — the North, from the Persian peri to the Swiss Alps, with the collectors named.",
    description:
      "Thomas Keightley's 1850 Fairy Mythology, volume I of two: where the belief and the word come from, the Persian peri and the Arabian jinn, Oberon traced back to Alberich, the alfar and duergar of the Eddas, and the fairy beliefs of Denmark, Norway, Sweden, Iceland, Shetland, the Orkneys, Rügen, Germany and Switzerland. With a head-note and a criticism for every section, a Register of Evidence and Inference, a glossary of the northern words, a register of the beings, a who's-who of the collectors he translates, a concordance of motifs measured across both volumes, and a plain account of what has been established since 1850.",
    idealReader:
      "Someone who wants the Scandinavian and German fairy material in one place, in English, and would rather be told which collector each tale comes from than be handed it anonymously.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 336,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_applicable",
        masterFileKey: "books/fairy-mythology-vol-1/master/v1/master.pdf",
        epubFileKey: "books/fairy-mythology-vol-1/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-07, direct ebook, public domain: $9.99 nets $8.99 after Paddle at a 90% margin. Each volume is priced as a complete book because each is one; the pair at $19.98 sits below Codex Bestiarium at $12.99 for a comparable total length, which is the concession the two-volume format makes to the reader.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(19.99),
        pageCount: 336,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-07, 332 pp 6\u00d79 B&W on white: prints at $4.98, KDP minimum list $8.31; $19.99 is the engine\u2019s recommendation at the 35% target.",
      },
      {
        format: "hardcover",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(38.99),
        pageCount: 336,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-07, 332 pp 6\u00d79 hardcover: prints at $9.63, KDP minimum list $16.06; $38.99 is the engine\u2019s recommendation at the 35% target. FOUNDER F-036 applies here as to British Goblins: no book this press has sold is priced near it.",
      },
    ],
    blockers: [
      "DEPLOYED 2026-09-07 (PR #22). The companion page and every free sheet resolve on "
        + "production — verified by HTTP against valicepress.com, and the served PDFs are "
        + "byte-for-byte the built files. GATE 2 (RIGHTS) AND GATE 5 (FACTS) WERE SIGNED BY "
        + "THE FOUNDER ON 2026-09-07 and gates.json records both as passed, approvedBy "
        + "founder. The ebook is on sale here from 2026-09-07 on the Founder's written "
        + "publication instruction of that date. GATE 12 (publication approval) IS STILL "
        + "not_started: it is a founder signature and no agent may write one, so the record "
        + "says what is true rather than what would tidy the board. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "PADDLE AND R2 ARE LIVE AS OF 2026-09-07; KDP IS NOT. The Paddle product and price "
        + "were created on the live account and the id is bound to this row; both R2 masters "
        + "were uploaded and then verified \u2014 object, byte size, sha256 of the retrieved "
        + "bytes against the local file, and a signed URL that returns those same bytes. "
        + "There is still NO KDP LISTING: `kdp` is \"not_created\" and no ASIN is invented.",
      "GATE 2 IS SIGNED (Founder, 2026-09-07). Five rights rows \u2014 the most of any book in the phase \u2014 "
        + "including one that is REFUSED: the ~150 one-letter images the 2012 transcribers made "
        + "for the insular and Gaelic letterforms. FOUNDER F-037.",
      "THE APPARATUS IS BELOW THE 20% HISTORICAL FLOOR and is recorded rather than padded. "
        + "Article 2 forbids filler and the Founder\u2019s standing instruction is that the "
        + "floor is a quality floor, not a word-count target. Measured in "
        + "QA/differentiation-vol1.json.",
      "COVER SERIES IDIOM: a painted cover where COVER_STANDARDS gives Valice Classics as "
        + "typographic \u2014 the same open Founder decision as the rest of the phase (F-031).",
      "TWO VOLUMES, ONE ROADMAP TITLE. The pair must be sold and shelved as a pair: a reader "
        + "who buys one and not the other gets half of Keightley. The related-products link "
        + "between the two rows is DONE (2026-09-07): a book page's shelf was \"the six most "
        + "recently published books\", which gave a reader on Volume I no route to Volume II. "
        + "It now orders by shared author, discounting the house credit that sits on every "
        + "row, so each volume leads the other's shelf \u2014 src/lib/related-books.ts, eight "
        + "tests. What is still open here is the PRICE of the pair, which is a Founder call.",
    ],
  },

  {
    slug: "fairy-mythology-vol-2",
    title: "The Fairy Mythology, Volume II",
    subtitle:
      "Volume II · Britain, Ireland, Brittany, France and the South \u2014 Keightley\u2019s 1850 Text, Annotated, with a Register of What He Translated, Collected, Read and Only Concluded",
    language: "en",
    pageCount: 326,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["thomas-keightley", "emre-dogan"],
    bisac: ["SOC011000", "OCC036000"],
    series: { name: "Valice Classics", volume: 18 },
    // PHASE 3, BOOK 5 (2026-09-07). ONE ROADMAP TITLE, TWO PRODUCT VOLUMES. The work runs to
    // ~200,000 words; in one volume it would exceed KDP\u2019s 550-page hardcover limit and
    // price the paperback near $38. The seam is Keightley\u2019s own GREAT BRITAIN division
    // and the halves come out within three hundred words of each other. Nothing is abridged.
    // Volume I is fairy-mythology-vol-1.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142217",
    onelinePromise:
      "Britain, Ireland and the West — and the passage in which Keightley admits that some of the most admired traits of the Irish fairies were invented by their collectors, himself among them.",
    description:
      "Thomas Keightley's 1850 Fairy Mythology, volume II of two: England, the Scottish Lowlands and Highlands, Ireland, the Isle of Man, Wales, Brittany, Greece, Italy, Spain, France, the Finns and the Jews, with the Conclusion and the Appendix. It is the half of the book in which Keightley handles material he helped to make, and admits in print that some of the most admired traits of the Irish fairies were invented by their collectors. With a head-note and a criticism for every section, a Register of Evidence and Inference, a glossary, a register of the beings, a who's-who, a motif concordance, and a plain account of what has been established since 1850.",
    idealReader:
      "Someone interested in how a national folklore canon gets made — and unmade — and who wants the British, Irish and Breton material with its sourcing marked.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 326,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_applicable",
        masterFileKey: "books/fairy-mythology-vol-2/master/v1/master.pdf",
        epubFileKey: "books/fairy-mythology-vol-2/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-07, direct ebook, public domain: $9.99 nets $8.99 after Paddle at a 90% margin. Each volume is priced as a complete book because each is one; the pair at $19.98 sits below Codex Bestiarium at $12.99 for a comparable total length, which is the concession the two-volume format makes to the reader.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(19.99),
        pageCount: 326,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-07, 322 pp 6\u00d79 B&W on white: prints at $4.86, KDP minimum list $8.11; $19.99 is the engine\u2019s recommendation at the 35% target.",
      },
      {
        format: "hardcover",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(38.99),
        pageCount: 326,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-07, 322 pp 6\u00d79 hardcover: prints at $9.51, KDP minimum list $15.86; $38.99 is the engine\u2019s recommendation at the 35% target. FOUNDER F-036 applies here as to British Goblins: no book this press has sold is priced near it.",
      },
    ],
    blockers: [
      "DEPLOYED 2026-09-07 (PR #22). The companion page and every free sheet resolve on "
        + "production — verified by HTTP against valicepress.com, and the served PDFs are "
        + "byte-for-byte the built files. GATE 2 (RIGHTS) AND GATE 5 (FACTS) WERE SIGNED BY "
        + "THE FOUNDER ON 2026-09-07 and gates.json records both as passed, approvedBy "
        + "founder. The ebook is on sale here from 2026-09-07 on the Founder's written "
        + "publication instruction of that date. GATE 12 (publication approval) IS STILL "
        + "not_started: it is a founder signature and no agent may write one, so the record "
        + "says what is true rather than what would tidy the board. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "PADDLE AND R2 ARE LIVE AS OF 2026-09-07; KDP IS NOT. The Paddle product and price "
        + "were created on the live account and the id is bound to this row; both R2 masters "
        + "were uploaded and then verified \u2014 object, byte size, sha256 of the retrieved "
        + "bytes against the local file, and a signed URL that returns those same bytes. "
        + "There is still NO KDP LISTING: `kdp` is \"not_created\" and no ASIN is invented.",
      "GATE 2 IS SIGNED (Founder, 2026-09-07). Five rights rows \u2014 the most of any book in the phase \u2014 "
        + "including one that is REFUSED: the ~150 one-letter images the 2012 transcribers made "
        + "for the insular and Gaelic letterforms. FOUNDER F-037.",
      "THE APPARATUS IS BELOW THE 20% HISTORICAL FLOOR and is recorded rather than padded. "
        + "Article 2 forbids filler and the Founder\u2019s standing instruction is that the "
        + "floor is a quality floor, not a word-count target. Measured in "
        + "QA/differentiation-vol2.json.",
      "COVER SERIES IDIOM: a painted cover where COVER_STANDARDS gives Valice Classics as "
        + "typographic \u2014 the same open Founder decision as the rest of the phase (F-031).",
      "TWO VOLUMES, ONE ROADMAP TITLE. The pair must be sold and shelved as a pair: a reader "
        + "who buys one and not the other gets half of Keightley. The related-products link "
        + "between the two rows is DONE (2026-09-07): a book page's shelf was \"the six most "
        + "recently published books\", which gave a reader on Volume I no route to Volume II. "
        + "It now orders by shared author, discounting the house credit that sits on every "
        + "row, so each volume leads the other's shelf \u2014 src/lib/related-books.ts, eight "
        + "tests. What is still open here is the PRICE of the pair, which is a Founder call.",
    ],
  },

  {
    slug: "british-goblins",
    title: "British Goblins",
    subtitle:
      "Sikes\u2019s 1880 Book Complete, Annotated \u2014 All Four Books, Thirty-Two Chapters and Seventeen Drawings by T. H. Thomas, with a Register of What He Watched, Was Told and Only Read",
    language: "en",
    pageCount: 390,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["wirt-sikes", "t-h-thomas", "emre-dogan"],
    bisac: ["SOC011000", "OCC036000"],
    series: { name: "Valice Classics", volume: 16 },
    // PHASE 3, BOOK 4 (2026-09-06). The first book of the phase with an illustration layer
    // that is used, and the first with a layer that is refused: twenty of T. H. Thomas\u2019s
    // twenty-one drawings are set, and the six music engravings in the Gutenberg file are
    // NOT reproduced because they were made in 2010 by a named transcriber, Lesley Halamek.
    // The airs are named and placed in the apparatus instead. RIGHTS.md rows S-1 to S-4.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142219",
    onelinePromise:
      "The largest book on Welsh folklore in English, complete \u2014 with the sources marked at the point of use, which is the one thing its author never did.",
    description:
      "In June 1876 the United States sent a consul to Cardiff. Wirt Sikes was a New York journalist of thirty-nine who had written two novels and, by one account, used as many as thirty pseudonyms. He spent seven years in Wales as consul, and in 1880 — after the first three of them — he published the largest book on Welsh folklore in English \u2014 the book most of what English speakers know about the tylwyth teg still comes through, usually without their knowing it. This edition prints all four Books and all thirty-two chapters entire, with twenty of T. H. Thomas\u2019s drawings. Book I is the fairies and Sikes\u2019s five kinds of them; Book II is the spirit-world, where the book is at its strangest and its best \u2014 the corpse-candle, the cyhyraeth, the gwrach y rhibyn, the hounds of Annwn; Book III is the customs, from courtship to burial, including the most-quoted passage he ever wrote, on the sin-eater; Book IV is the bells, wells, stones and dragons. Richard Dorson called it the most substantial book of Welsh legendry in English and said in the same assessment what is wrong with it: Sikes leans on earlier compilations \u2014 above all on Edmund Jones\u2019s Monmouthshire collection of 1780 \u2014 and although he names them he almost never gives a page and never gives a date, so four hundred pages arrive in one voice and a reader cannot tell eighteenth-century Monmouthshire from the countryside he was living in. John Rh\u0177s and E. S. Hartland said the same in the 1880s, and cited him anyway. So the apparatus here does the marking for him: a head-note before every chapter ending in READING AGAINST HIM; an introduction to each of the four Books; a REGISTER OF EVIDENCE AND INFERENCE, by Book, separating what he watched from what he was told and what he read; a Welsh glossary and a register of the beings, some sixty terms between them, with how to say them; a descriptive list of every plate; a gazetteer of the parishes; a who\u2019s-who; the six airs named and placed; and a plain account, claim by claim, of what has been established since 1880. That account is not flattering and is not meant to be: the collection held and the argument did not. The sharpest instance is one he watched with his own eyes \u2014 the Druidic rites at the Pontypridd rocking stone, which he reports as an ancient survival and which had been started in about 1853 by Myfyr Morganwg, a living Welsh romantic, in a tradition invented a generation earlier by Iolo Morganwg. 390 pages.",
    idealReader:
      "Someone who wants the Welsh fairy material entire and in one place, and would rather be told which parts of it are 1780 Monmouthshire, which are Sikes standing in a room watching, and which are a theory that did not survive its century.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(11.99),
        pageCount: 390,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_applicable",
        masterFileKey: "books/british-goblins/master/v1/master.pdf",
        epubFileKey: "books/british-goblins/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-07, direct ebook, public domain: $11.99 nets $10.89 after Paddle at a 90.8% margin. Above every other Valice Classics title except Codex Bestiarium, and below it: 390 pages and 110,406 source words against Bestiarium\u2019s 435 pages, and against Traditional Games at 244 pages and $9.99.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(22.99),
        pageCount: 390,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-07, 390 pp 6\u00d79 B&W on white: prints at $5.68, KDP minimum list $9.47; $22.99 nets $8.12 (35.3%) at 60% royalty \u2014 the engine\u2019s recommendation, and the first list price on the ladder that clears the 35% target.",
      },
      {
        format: "hardcover",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(41.99),
        pageCount: 390,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-07, 390 pp 6\u00d79 hardcover: prints at $10.33, KDP minimum list $17.22; $41.99 is the engine\u2019s recommendation at the 35% target. It is a high number and it is a 390-page case-bound book; the Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "DEPLOYED 2026-09-07 (PR #22). The companion page and every free sheet resolve on "
        + "production — verified by HTTP against valicepress.com, and the served PDFs are "
        + "byte-for-byte the built files. GATE 2 (RIGHTS) AND GATE 5 (FACTS) WERE SIGNED BY "
        + "THE FOUNDER ON 2026-09-07 and gates.json records both as passed, approvedBy "
        + "founder. The ebook is on sale here from 2026-09-07 on the Founder's written "
        + "publication instruction of that date. GATE 12 (publication approval) IS STILL "
        + "not_started: it is a founder signature and no agent may write one, so the record "
        + "says what is true rather than what would tidy the board. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "PADDLE AND R2 ARE LIVE AS OF 2026-09-07; KDP IS NOT. The Paddle product and price "
        + "were created on the live account and the id is bound to this row; both R2 masters "
        + "were uploaded and then verified \u2014 object, byte size, sha256 of the retrieved "
        + "bytes against the local file, and a signed URL that returns those same bytes. "
        + "There is still NO KDP LISTING: `kdp` is \"not_created\" and no ASIN is invented.",
      "GATE 2 IS SIGNED (Founder, 2026-09-07). Four rows, and the first illustration layer of the phase that is "
        + "actually used \u2014 T. H. Thomas, died 1915 \u2014 plus one that is refused: the six "
        + "music engravings set in 2010 by Lesley Halamek, which are not reproduced. FOUNDER F-035.",
      "COVER SERIES IDIOM: a painted cover where COVER_STANDARDS gives Valice Classics as "
        + "typographic \u2014 the same open Founder decision as the other three books of the phase "
        + "(F-031). Title band 17.8% of cover height against a 25% rule; 150 px thumbnail "
        + "contrast 1.00.",
      "THE APPARATUS CLEARS THE FLOOR NARROWLY. 29,222 words, 20.45% of the volume against a 20% "
        + "floor, measured by COMMON-AREA/checks/differentiation.py \u2014 a margin of about 1,100 "
        + "words. It is recorded rather than widened: Article 2 forbids padding to reach the "
        + "number, and the book has twenty-one back-matter sections already. Any future cut to "
        + "the apparatus must re-measure.",
      "TWO CLAIMS ARE MARKED UNVERIFIABLE, not verified: that the aboriginal-race theory of "
        + "fairy origins has no evidential support, and that the sin-eater remains disputed. Both "
        + "are filed in the book as editorial interpretation under Article 6 rather than asserted "
        + "as current fact, and CLAIMS.jsonl records that no single citable "
        + "authority was read for either.",
      "PRICING IS HIGH AND UNTESTED. $22.99 paperback and $41.99 hardcover are the price "
        + "engine\u2019s own recommendations for 388 pages at the 35% target, but no book this "
        + "press has sold is priced anywhere near them. FOUNDER F-036.",
    ],
  },

  {
    slug: "book-of-were-wolves",
    title: "The Book of Were-Wolves",
    subtitle:
      "Baring-Gould\u2019s 1865 Account Complete, Annotated \u2014 with a Register of What He Construed, Transcribed and Only Theorised, and What Has Been Established Since",
    language: "en",
    pageCount: 198,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["sabine-baring-gould", "emre-dogan"],
    bisac: ["SOC011000", "OCC036000"],
    series: { name: "Valice Classics", volume: 15 },
    // PHASE 3, BOOK 3 (2026-09-06). All sixteen chapters entire, including the six that
    // describe murders from the trial records \u2014 Article 18 forbids abridging to hide
    // what a book contains, so the edition prints them and says at the front and again in
    // each head-note exactly what is in them. No illustration layer: the 1865 book has no
    // plates and this edition invents none.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142225",
    onelinePromise:
      "The Victorian clergyman who went and read the werewolf trial records \u2014 with a head-note on every chapter saying which of his explanations survived, and which of them are the reason the book is hard to read.",
    description:
      "In 1865 a young Devon curate could not hire anyone to walk him home across the fields: it was getting dark and there were loups-garoux abroad. Sabine Baring-Gould \u2014 antiquarian, folk-song collector, and the man who wrote the words of \u201cOnward, Christian Soldiers\u201d \u2014 went away and found out what those people were afraid of. What he produced is not the horror anthology it has been sold as; it is a piece of source criticism. He takes the werewolf backwards through the record \u2014 Herodotus and Petronius, then the Norse sagas, then the medieval chronicles, then the French trial transcripts \u2014 and at each step asks what the witnesses actually said. This edition prints all sixteen chapters entire. Around them: a head-note before each, every one ending in READING AGAINST HIM, which names the specific thing in that chapter to resist; a REGISTER OF EVIDENCE AND INFERENCE separating the four instruments he uses \u2014 a language he can construe, a document he transcribes, a story he repeats, and a theory he applies; a casebook of every trial; a who\u2019s-who; a glossary of the Norse his best chapters are built on; a chronology; and a plain account of what has been established since 1865. The verdict is uneven in a way worth knowing before you start: his philology held, his mythology was abandoned within his lifetime, and his medicine \u2014 an \u201cinnate cruelty\u201d \u2014 has been replaced by clinical lycanthropy, a rare delusional syndrome that explains the folklore well and the murders not at all. Six chapters describe murders, taken from the trial records: a note at the front says which and what is in them, and each of those head-notes opens by naming it. And the two most remarkable documents in the book are ones Baring-Gould prints without comment \u2014 in 1598 the Parlement of Paris sent a confessed werewolf to an asylum instead of the stake, and in 1603 the Parlement of Bordeaux held that lycanthropy existed only in a disordered brain and was not a punishable crime, sentencing a beggar boy of thirteen to perpetual imprisonment in a monastery instead. 198 pages.",
    idealReader:
      "Someone who came to werewolves through folklore, horror or true crime, and would rather read the Victorian who collected the trial records himself \u2014 and be told, chapter by chapter, which of his explanations survived.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(8.99),
        pageCount: 198,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_applicable",
        masterFileKey: "books/book-of-were-wolves/master/v1/master.pdf",
        epubFileKey: "books/book-of-were-wolves/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-06, direct ebook, public domain: $8.99 nets $8.04 after Paddle at an 89.4% margin. Mid-band for Valice Classics, with Kwaidan \u2014 54,300 source words against Sea Monsters\u2019 62,000.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(15.99),
        pageCount: 198,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-06, 198 pp 6\u00d79 B&W on white: prints at $3.38, KDP minimum list $5.63; $15.99 nets $6.23 (39.0%) at 60% royalty.",
      },
      {
        format: "hardcover",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(32.99),
        pageCount: 198,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-06, 198 pp 6\u00d79 hardcover: prints at $8.03, KDP minimum list $13.38; the engine\u2019s recommendation at the 35% target. $29.99 would net 33.3% and miss it.",
      },
    ],
    blockers: [
      "DEPLOYED 2026-09-07 (PR #22). The companion page and every free sheet resolve on "
        + "production — verified by HTTP against valicepress.com, and the served PDFs are "
        + "byte-for-byte the built files. GATE 2 (RIGHTS) AND GATE 5 (FACTS) WERE SIGNED BY "
        + "THE FOUNDER ON 2026-09-07 and gates.json records both as passed, approvedBy "
        + "founder. The ebook is on sale here from 2026-09-07 on the Founder's written "
        + "publication instruction of that date. GATE 12 (publication approval) IS STILL "
        + "not_started: it is a founder signature and no agent may write one, so the record "
        + "says what is true rather than what would tidy the board. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "PADDLE AND R2 ARE LIVE AS OF 2026-09-07; KDP IS NOT. The Paddle product and price "
        + "were created on the live account and the id is bound to this row; both R2 masters "
        + "were uploaded and then verified \u2014 object, byte size, sha256 of the retrieved "
        + "bytes against the local file, and a signed URL that returns those same bytes. "
        + "There is still NO KDP LISTING: `kdp` is \"not_created\" and no ASIN is invented.",
      "GATE 2 IS SIGNED (Founder, 2026-09-07). Three rows, and the simplest rights position of the phase: a text of "
        + "1865 by an author who died in 1924, no illustration layer at all, and the author\u2019s "
        + "own translations. FOUNDER F-033.",
      "CONTENT DECISION, RECORDED RATHER THAN TAKEN QUIETLY. Six chapters describe murders and "
        + "the killing of children, from the trial records. They are printed entire because "
        + "Article 18 forbids abridging to hide what a book contains and because Baring-Gould\u2019s "
        + "argument depends on them; the edition states this at the front and in each of the six "
        + "head-notes. If the Founder wants a different answer, this is the decision to revisit. "
        + "FOUNDER F-034.",
      "COVER SERIES IDIOM: a painted cover where COVER_STANDARDS gives Valice Classics as "
        + "typographic \u2014 the same open Founder decision as Kwaidan and Sea Monsters (F-031). "
        + "Title band 14.4% of cover height against a 25% rule; 150 px thumbnail contrast 0.92.",
      "The apparatus is 21.3% of the volume against a 20% floor, measured from the content files "
        + "by COMMON-AREA/checks/differentiation.py.",
    ],
  },

  {
    slug: "sea-monsters-unmasked",
    title: "Sea Monsters Unmasked, and Sea Fables Explained",
    subtitle:
      "Both 1883 Handbooks Complete, Annotated \u2014 All 68 Original Figures, a Register of What Lee Watched and What He Only Read, and What Has Been Established Since",
    language: "en",
    pageCount: 232,
    categories: ["myth-and-folklore", "classics-and-philosophy"],
    authors: ["henry-lee", "emre-dogan"],
    bisac: ["SOC011000", "NAT017000"],
    series: { name: "Valice Classics", volume: 14 },
    // PHASE 3, BOOK 2 (2026-09-06). Both of Lee's shilling handbooks for the International
    // Fisheries Exhibition, entire, with all 68 of his figures set where he set them \u2014
    // including the two PAIRS he prints side by side under one shared caption, and the one
    // that lives inside footnote 41. Nothing of his is dropped: the hundred footnotes are
    // printed as their own section because the transcription gathers them at the end of the
    // file, which had put every one of them inside the last chapter.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142228",
    onelinePromise:
      "The Victorian naturalist who explained the sea monsters away: the kraken is a giant squid, the mermaid a dugong, the hydra an octopus \u2014 and the sea serpent he could not solve, and says so.",
    description:
      "In the summer of 1883 the International Fisheries Exhibition filled the South Kensington grounds, and Henry Lee \u2014 sometime naturalist of the Brighton Aquarium, a man who had spent years watching octopus and cuttle through glass \u2014 wrote two shilling handbooks for the crowds going in. He took the sea monsters one at a time. The kraken is a giant squid, and Bishop Pontoppidan was mocked for a century for being right. The mermaid is a dugong. The hydra and Scylla are the octopus. Whales do not spout water; the blow is breath. The paper nautilus does not sail. And barnacle geese, believed for six hundred years to grow on trees, are geese. The great sea serpent he could not solve, and he says so \u2014 which is why that chapter has aged best of all. This edition prints both handbooks entire, with all 68 original figures in their places. Around them: an introduction; a head-note before each of the eight chapters, every one ending in READING AGAINST HIM, which names the specific thing in that chapter a modern reader should resist; a REGISTER OF EVIDENCE AND INFERENCE separating what Lee watched from what he was told, from what he read, from what he concluded, and closing on the two places where the instrument slipped; a descriptive list of all 68 plates saying of each whether it is evidence of an animal, evidence of a belief, or decoration; a note on the captions, because every figure is captioned twice and in nine places the two disagree \u2014 figure 24 is a skeleton, which only the List of Illustrations says; a casebook of the named sightings; a who's-who of his authorities; a glossary; a chronology; and a plain account of what has been established since 1883, including the first photograph of a living giant squid, taken a hundred and nineteen years after he wrote. Where this edition disagrees with Lee it says so and says why: the fish-god plates rest on a reading of Dagon that scholarship has abandoned, the dugong does not live in the seas most of the mermaid reports come from \u2014 and in his own footnote 41 he prints an engraving from the Roman catacombs and remarks that the creature in it is \u201capparently not a fish, but a seal\u201d, which is the mermaid's whole mechanism, noticed and filed under something else. 232 pages.",
    idealReader:
      "Someone who likes cryptids and would rather read the Victorian naturalist who explained most of them away \u2014 and be told, chapter by chapter, which of his explanations survived.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 232,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_applicable",
        masterFileKey: "books/sea-monsters-unmasked/master/v1/master.pdf",
        epubFileKey: "books/sea-monsters-unmasked/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-06, direct ebook, public domain: $9.99 nets $8.99 after Paddle at a 90.0% margin. Top of the Valice Classics band, with the 244 pp Singing Games at $9.99 \u2014 this is the second-longest annotated volume on the shelf.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(16.99),
        pageCount: 232,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-06, 232 pp 6\u00d79 B&W on white: prints at $3.78, KDP minimum list $6.31; $16.99 nets $6.41 (37.7%) at 60% royalty.",
      },
      {
        format: "hardcover",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(33.99),
        pageCount: 232,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-06, 232 pp 6\u00d79 hardcover: prints at $8.43, KDP minimum list $14.06; $33.99 nets $11.96 (35.2%). $29.99 would net 32% and miss the 35% target.",
      },
    ],
    blockers: [
      "DEPLOYED 2026-09-07 (PR #22). The companion page and every free sheet resolve on "
        + "production — verified by HTTP against valicepress.com, and the served PDFs are "
        + "byte-for-byte the built files. GATE 2 (RIGHTS) AND GATE 5 (FACTS) WERE SIGNED BY "
        + "THE FOUNDER ON 2026-09-07 and gates.json records both as passed, approvedBy "
        + "founder. The ebook is on sale here from 2026-09-07 on the Founder's written "
        + "publication instruction of that date. GATE 12 (publication approval) IS STILL "
        + "not_started: it is a founder signature and no agent may write one, so the record "
        + "says what is true rather than what would tidy the board. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "PADDLE AND R2 ARE LIVE AS OF 2026-09-07. The product and price were created on the "
        + "live account (id bound to this row) and both masters were uploaded and then "
        + "verified \u2014 object, byte size, sha256 of the retrieved bytes against the local "
        + "file, and a signed URL that returns those same bytes.",
      "GATE 2 IS SIGNED (Founder, 2026-09-07); its table was rewritten during review. The first draft had five "
        + "rows and got two wrong: it gave the FIELD's five cuts to the Illustrated London News, "
        + "omitted Longman and Tennent entirely, and said the book had one named artist when "
        + "Lee's preface names two. The corrected table has eleven rows, including Ellen Caroline "
        + "Woodward (1859\u20131943), who drew the squid figures and whose dates nobody had "
        + "looked up. FOUNDER F-032.",
      "COVER SERIES IDIOM: a painted cover where COVER_STANDARDS gives Valice Classics as "
        + "typographic with one engraved device \u2014 the same open Founder decision as Kwaidan "
        + "(F-031). The title band is 15.2% of cover height against a 25% rule; 150 px thumbnail "
        + "contrast is 0.99.",
      "NO KDP LISTING YET. Paperback and hardcover are built \u2014 interior, companion leaf and "
        + "both wraps, on calculator rows read for 232 pp \u2014 and neither has been uploaded; "
        + "`kdp: \"not_created\"` says so and no ASIN is invented.",
      "The apparatus is 22.2% of the volume against a 20% floor, measured from the content files "
        + "by COMMON-AREA/checks/differentiation.py.",
    ],
  },

  {
    slug: "traditional-games",
    title: "The Singing Games of England, Scotland, and Ireland",
    subtitle:
      "Alice Gomme's 1894 Collection, Annotated \u2014 43 Singing Games, 209 Versions of the Rhymes, and 78 Tunes Engraved for This Edition",
    language: "en",
    pageCount: 244,
    categories: ["games-and-play", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["GAM001000", "SOC002010"],
    series: { name: "Valice Classics", volume: 12 },
    // PHASE 2, BOOK 5, and the largest thing this press has made: 244 pages with
    // 78 engraved staves in them. The scope is the singing half of Gomme's first
    // volume \u2014 every entry that carries a tune \u2014 decided before a word of the
    // apparatus was written. The tunes are drawn from the notes by the edition's own
    // engraver; nothing is traced from her page and no page image is used.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142229",
    onelinePromise:
      "The book that wrote down the tunes: forty-three singing games as children sang them in the 1890s, with every version's county and collector, and seventy-eight melodies engraved for this edition.",
    description:
      "In January 1894 a woman in Barnes finished a book nobody had asked her to write. Alice Gomme had spent years collecting children's games by post \u2014 from village schoolmistresses, country clergymen, dialect scholars and her own friends \u2014 and she had done something nobody in England had done before: she wrote down the tunes. There were collections of children's rhymes before hers. What she added was the music, taken down as the children actually sang it and printed unaltered. A rhyme without its tune is a poem; a rhyme with its tune is a game you can still play. This edition is the singing half of her first volume: 43 games, from All the Soldiers in the Town to Nuts in May, with 209 versions of the rhymes \u2014 each one printed with the county it came from and the person who sent it, exactly as she printed them \u2014 and all 78 tunes. EVERY STAVE IN THIS BOOK WAS ENGRAVED FOR IT. The tunes were read as pitch and duration and then drawn, note by note, by the edition's own engraver: nothing is a photograph or a tracing of an 1894 page. Around them: a Register of Collection and Conjecture that keeps what Gomme gathered apart from what she concluded \u2014 the survivals theory of her generation, which held that a ring game about a dead lady was the wreckage of a funeral rite, and which nobody now believes; a guide to reading one of her entries; a playing guide that sets out eight of the games to be played this afternoon; head-notes to all 43 games; and a gazetteer of where every version was sung and who wrote it down, built by reading the 296 attribution lines under her versions. That gazetteer stands in for the one thing this edition could not reproduce: her husband's great comparative tables, up to eighteen columns wide, which will not go on a book page at a size anybody could read. What they encode is the geography, and the geography is here \u2014 42 counties and countries, 79 named collectors, most of them women whose names appear nowhere else. 244 pages.",
    idealReader:
      "Anyone who has stood in a playground and heard a ring form, and wants to know what was sung there a hundred and thirty years ago \u2014 and to sing it.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 244,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/traditional-games/master/v1/master.pdf",
        epubFileKey: "books/traditional-games/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-06, direct ebook, public domain: recommended $6.99, and $9.99 nets $8.99 after Paddle at a 90% margin. At the TOP of the Valice Classics band of $7.99\u20139.99 because it is the longest book in the series and the only one with 78 pieces of engraved music in it.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(16.99),
        pageCount: 244,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        priceBasis:
          "price-engine.mjs 2026-09-06, 244 pp 6\u00d79 B&W on white: prints at $3.61, KDP minimum list $6.02, recommended $12.99; $16.99 nets $6.58 (38.7%) at 60% royalty.",
      },
    ],
    blockers: [
      "ON SALE HERE, NOT YET ON AMAZON. The Paddle product and price are live and the "
        + "price id is now bound to this row; the R2 masters are uploaded and verified \u2014 "
        + "object, byte size, sha256 and signed-URL retrieval, 2026-09-07. The Founder "
        + "signed GATE 2 (Rights) and GATE 5 (Facts) on 2026-09-07, and GATES 7, 8 and 10 "
        + "for the print package \u2014 gates.json records each as passed, approvedBy "
        + "founder. Gates 1, 3, 6 and 11 are agent gates that have not been run; gate 11 "
        + "(website product QA) can only be run once the page is live. Gate 12, the "
        + "publication approval, is STILL not_started: the book went on sale on the "
        + "Founder's written instruction of 2026-09-07, and recording that as a founder "
        + "signature is not an agent's to write. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "NO KDP LISTING YET. The paperback is built \u2014 interior, companion leaf and wrap \u2014 and has never been uploaded; `kdp: \"not_created\"` says so and no ASIN is invented.",
      "The apparatus is 20.3% of the volume against a 20% floor, which is the tightest margin of the five books of this phase. It is measured from the manuscript by BUILD/measure.py at build time, not estimated.",
      "THE COMPARATIVE TABLES ARE NOT REPRODUCED. 23 of the 43 entries carry one in the original, up to eighteen columns wide and printed sideways; there is no honest way to set them on a 6\u00d79 page. The gazetteer prints what they encode and A Note on the Text says so plainly.",
    ],
  },
  {
    slug: "chess-and-playing-cards",
    title: "Chess and Playing Cards: The Chess, Divination and Card Collections",
    subtitle:
      "Stewart Culin's 1898 Catalogue, Annotated \u2014 with a Register of Object and Argument, the Nine Forms of Chess Compared, Five Original Diagrams and the Index the Original Never Printed",
    language: "en",
    pageCount: 120,
    categories: ["games-and-play", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["GAM001000", "SOC002010"],
    series: { name: "Valice Classics", volume: 10 },
    // PHASE 2, BOOK 3. An Internet Archive scan sponsored by the Library of Congress,
    // and a better one than book 2's Google derive: median junk 5.1% a leaf. It carries
    // a per-word confidence score which was MEASURED AND FOUND UNUSABLE \u2014 median 22
    // on a 0-100 scale, with "and", "of" and "four" scoring under 10 \u2014 and nothing
    // in the edition depends on it. Where each of the 76 entries begins is settled by
    // three readings that have to agree: Culin's own table of contents, the run-in
    // heading, and the printed page number validated against a physical rule.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142232",
    onelinePromise:
      "A museum catalogue whose ORDER is an argument \u2014 and the first edition to say so, entry group by entry group, so the objects can be read apart from the theory they were arranged to prove.",
    description:
      "A museum catalogue is normally the least argumentative thing a scholar writes. This one is a thesis from its first sentence. \u201cThe object of this collection,\u201d Culin begins, \u201cis to illustrate the probable origin, significance, and development of the games of chess and playing-cards\u201d \u2014 which, following a suggestion from Frank Hamilton Cushing, he takes to descend from the divinatory use of the arrow. Everything that follows is arranged to make that case: the chessboards first, then the quivers and divining splints and carved gambling sticks that are supposed to be arrows in disguise, then the cards, ending with a whist pack sold as a souvenir of the Chicago fair the collection was assembled for. Murray disbelieved the thesis and the field has left it alone since. But an object is not a claim: when Culin writes that sixty-two gambling sticks five inches long came in a leather pouch and were collected by Dr A. H. Hoff of the United States Army, that stays true whatever one thinks about arrows. This is a book whose evidence outlived its argument, and this edition is built to let the two be told apart. A Register of Object and Argument gives, part by part, what the objects are, what Culin says they show, what the claim actually rests on, and how to read the difference. The nine forms of chess he catalogues are compared on one table drawn entirely from his own descriptions. His introduction and entries 45 to 120 complete, in four parts \u2014 chess and the games of the board, the arrows and lots and gambling-sticks, the cards of Asia, and the tarots and the cards of Europe and America. Around them: five original diagrams marked EVIDENCE or RECONSTRUCTION, an account of how the divining procedures actually work, a playing guide, a who's-who, a glossary, a chronology, a note on tracing an object today, and an index of subjects generated from the text. 120 pages, 6 \u00d7 9 in.",
    idealReader:
      "Someone who wants the objects and can enjoy watching a good observer's theory being kept honestly at arm's length from them.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(7.99),
        pageCount: 120,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/chess-and-playing-cards/master/v1/master.pdf",
        epubFileKey: "books/chess-and-playing-cards/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-05, direct ebook, public domain: recommended $6.99, and $7.99 nets $7.09 after Paddle. The Valice Classics band is $7.99\u20139.99; at 120 pages and 21.5% original matter this sits at the band's floor, below the $8.99 of the 144-page volume 9.",
      },
      {
        format: "paperback",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: usd(14.99),
        pageCount: 120,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: null,
        priceBasis:
          "price-engine.mjs 2026-09-05, 120 pp 6\u00d79 B&W: prints at $2.44, KDP minimum list $4.07, recommended $9.99. $14.99 nets $6.31 (42.1%). The Classics print band of $16.99\u201319.99 assumes about 150 pages and this is 120, so it is priced between book 8's short-volume $12.99 and the band floor rather than at either. The Founder decides at Gate 8.",
      },
    ],
    blockers: [
      "ON SALE HERE, NOT YET ON AMAZON. The Paddle product and price are live and the "
        + "price id is now bound to this row; the R2 masters are uploaded and verified \u2014 "
        + "object, byte size, sha256 and signed-URL retrieval, 2026-09-07. The Founder "
        + "signed GATE 2 (Rights) and GATE 5 (Facts) on 2026-09-07, and GATES 7, 8 and 10 "
        + "for the print package \u2014 gates.json records each as passed, approvedBy "
        + "founder. Gates 1, 3, 6 and 11 are agent gates that have not been run; gate 11 "
        + "(website product QA) can only be run once the page is live. Gate 12, the "
        + "publication approval, is STILL not_started: the book went on sale on the "
        + "Founder's written instruction of 2026-09-07, and recording that as a founder "
        + "signature is not an agent's to write. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "Not on KDP. The interior and wrap are built and packaged; the print upload is a Founder action \u2014 see the KDP upload handbook in PHASE-2-REPORT.",
      "Five of the seventy-six entries could not have their headings recovered from the scan, so their descriptions stand within the entry above them. They are printed in their place with their number and title from Culin's own table of contents and a line saying so. Nothing is missing from the text; what is missing is the seam, and it is marked rather than guessed.",
      "Entries 1 to 44 \u2014 the dice, the boards and the race games, 68,849 words \u2014 are not in this volume. They carry the collection but not the thesis and are scoped as a second volume. The decision was recorded before any apparatus was written.",
      "Nine entries describe games already published in Valice Classics 9. That is not duplication and the edition says so in a dedicated section: Korean Games describes how a game is PLAYED, this catalogue describes the OBJECT \u2014 its size, its material, its museum number, who collected it.",
      "No Kindle edition planned at launch: KDP caps public-domain content at the 35% royalty tier. No hardcover and no large print at launch; both are open decisions rather than refusals.",
    ],
  },

  {
    slug: "mancala",
    title: "Mancala, the National Game of Africa",
    subtitle:
      "Stewart Culin's 1894 Paper, Annotated \u2014 with a Playing Guide to Three Complete Games, a Register of Record and Inference, Three Original Diagrams and What Has Been Established Since",
    language: "en",
    pageCount: 38,
    categories: ["games-and-play", "classics-and-philosophy"],
    authors: ["emre-dogan"],
    bisac: ["GAM001000", "SOC002010"],
    series: { name: "Valice Classics", volume: 11 },
    // PHASE 2, BOOK 4. The only book of the five NOT built from a scan: Project
    // Gutenberg 66220 is a proof-read human transcription, so none of the OCR
    // machinery the other four depend on is used or needed here. It is also the
    // shortest thing this press has published \u2014 a thirteen-page paper \u2014 and is
    // deliberately EBOOK ONLY: a 38-page perfect-bound paperback is a bad object
    // whatever is printed in it. Both decisions are on the product page, not buried.
    websiteStatus: "published",
    linkageDecision: null,
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142233",
    onelinePromise:
      "The paper that started the study of mancala \u2014 five thousand words, three complete games you can play tonight, and an informant who became the first African diplomat in modern Europe.",
    description:
      "In 1894 Stewart Culin went to Washington Street in New York and watched two Syrian men play a game with a board of fourteen cups and a handful of shells. A lad from Damascus explained the rules; Culin wrote them down; and the paper he read to the Oriental Club of Philadelphia that May became the first serious study of mancala in English. It is still cited. It is also thirteen printed pages, which is why this is the shortest book this press has made and why it says so on the cover of its own description rather than leaving a buyer to find out. What it contains is worth the length. Three COMPLETE games come out of these pages and this edition sets them out to be played from: the Syrian \u201ccrazy game\u201d, whose result Culin noticed is fixed before the first move; its companion the \u201crational game\u201d; and Chuba, the four-row version that Culin discovered, in a postscript, had already been on sale in America since 1891 \u2014 three years after he predicted the game might one day reach American firesides. A Register of Record and Inference separates what he watched from what he was told and what he read, which matters in a paper that moves between the three inside a single sentence. A who's-who identifies his named informants, including Prince Momolu Massaquoi, described here only as the son of a Vai king, who went on to become Liberia's consul-general in Hamburg and generally the first indigenous African diplomat accredited to modern Europe. A section on what has been established since 1894 gives the modern distribution figures, the archaeology \u2014 including one much-repeated claim this edition marks as disputed rather than repeating \u2014 and says plainly what has aged worst about the title. With three original diagrams, one of them three panels showing how a move works, because sowing is very hard to follow in prose. 38 pages, ebook only.",
    idealReader:
      "Someone who wants to play mancala tonight and to know where the game's written history begins.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(4.99),
        pageCount: 38,
        amazonAsin: null,
        amazonUrl: null,
        kdp: "not_created",
        masterFileKey: "books/mancala/master/v1/master.pdf",
        epubFileKey: "books/mancala/master/v1/master.epub",
        priceBasis:
          "price-engine.mjs 2026-09-05, direct ebook, public domain: recommended $6.99, and $4.99 nets $4.24 after Paddle at an 85% margin. Priced BELOW the Valice Classics band of $7.99\u20139.99 on purpose: at 38 pages this is about a quarter the length of the other volumes, and charging band price for it would be charging band price for a pamphlet. 54.8% of it is original editorial matter, which is what makes it a book at all.",
      },
    ],
    blockers: [
      "ON SALE HERE, NOT YET ON AMAZON. The Paddle product and price are live and the "
        + "price id is now bound to this row; the R2 masters are uploaded and verified \u2014 "
        + "object, byte size, sha256 and signed-URL retrieval, 2026-09-07. The Founder "
        + "signed GATE 2 (Rights) and GATE 5 (Facts) on 2026-09-07 \u2014 gates.json records "
        + "both as passed, approvedBy founder. Gates 7, 8 and 10 are NOT signed here and are "
        + "not needed: they are the print gates, and this volume has no print edition by "
        + "decision. Gates 1, 3, 6 and 11 are agent gates that have not been run; gate 11 "
        + "(website product QA) can only be run once the page is live. Gate 12, the "
        + "publication approval, is STILL not_started: the book went on sale on the "
        + "Founder's written instruction of 2026-09-07, and recording that as a founder "
        + "signature is not an agent's to write. The command is in "
        + "docs/execution/FOUNDER_GATE_COMMANDS.md.",
      "NO PAPERBACK, and that is a decision rather than an omission. The volume is 38 pages; with the blank leaf a printed edition needs to keep the block even it would run to 40, giving a spine of 0.090 in. A perfect-bound book that thin is a bad object, it cannot carry spine text, and it invites exactly the review it would deserve. The interior and a cover wrap are built so the arithmetic exists if this is ever revisited, and both are marked not for use.",
      "The source paper is 4,885 words and the apparatus is longer than it \u2014 54.8% of the finished volume against a 20% floor. That inversion is unusual for this series and is stated in the Note on the Text and here rather than discovered on the page.",
      "None of the paper's five plates or fifteen text figures is reproduced (22 captioned pictures in all, since Plates 2 and 4 carry two figures each): no photographer and no draughtsman is named for any of them. All 22 captions are printed where the figures stood, because the caption carries the provenance, and the three boards are drawn for this edition from Culin's descriptions.",
      "The title has aged badly. \u201cThe national game of Africa\u201d is a nineteenth-century way of speaking about a continent, and mancala is neither one game nor confined to Africa. The title is kept because it is the paper's title and this press does not rewrite the books it publishes; the edition says so in its own introduction.",
    ],
  },
  {
    slug: "codex-enigmatica",
    title: "Codex Enigmatica",
    subtitle:
      "One Hundred Engraved Enigmas and a Single Unbroken Mystery — A Puzzle Book Bound as a Grimoire",
    language: "en",
    pageCount: 274,
    categories: ["puzzle-and-challenge"],
    authors: ["emre-dogan"],
    bisac: ["GAM014000"],
    series: { name: "Codex", volume: 3 },
    websiteStatus: "published",
    // KDP → Valice Press linkage: what to do with the print interiors and why.
    // Read by scripts/factory/kdp-linkage-matrix.mjs; the audit itself is measured.
    linkageDecision: { decision: "rebuild_now", why: "Rebuilt 2026-09-03. The verification page already existed and already printed its address — it simply had no code and no presence. The paperback's p. 274 is now the house design with a 2.1-inch code; the hardcover's blank final leaf, p. 276, carries the same page while its original p. 275 stays as it is. No page count moved." },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142237",
    onelinePromise:
      "One hundred enigmas across five gates, converging on a single word that is printed nowhere in the book.",
    description:
      "One hundred engraved enigmas across five gates — The Threshold, The Menagerie, The Calendar, The Labyrinth, The Mirror — whose solutions converge on five sayings, and those five on a single word. That word is printed nowhere in the book. The reader enters it on a verification page whose address is printed on the last leaf, which levels case, spacing and punctuation before comparing. Built for the Cain's Jawbone and Journal 29 reader: 17 mechanism families, three tiers of hints, and self-referential puzzles in the final gate that bind to the book's own page count.",
    idealReader:
      "The reader who finished Cain's Jawbone or Journal 29 and wants the next one — and who would rather a puzzle book withhold its answer than print it upside down at the back.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 274,
        amazonAsin: "B0HGRZ3BRC",
        amazonUrl: amazon("B0HGRZ3BRC"),
        kdp: "live",
        masterFileKey: "books/codex-enigmatica/master/v1/master.pdf",
        priceBasis:
          "Matched to the live Kindle list price ($9.99, KDP 2026-08-31). Not in KDP Select.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(19.99),
        pageCount: 274,
        amazonAsin: "B0HGSVF15Q",
        amazonUrl: amazon("B0HGSVF15Q"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: usd(29.99),
        // 276, not 274: the live listing says so (verify-amazon.mjs,
        // 2026-09-02). The case binding adds two pages to the paperback's
        // 274; the catalogue had copied the paperback's count.
        pageCount: 276,
        amazonAsin: "B0HH3B4HQ7",
        amazonUrl: amazon("B0HH3B4HQ7"),
        kdp: "live",
        masterFileKey: null,
        priceBasis: "Live Amazon list price 2026-08-31 — matches the modelled figure.",
      },
      {
        format: "large_print",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 2699,
        pageCount: 439,
        isbn13: null,
        amazonAsin: "B0HK7ZXM4B",
        amazonUrl: "https://www.amazon.com/dp/B0HK7ZXM4B",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-18 at $26.99. The edition existed on Amazon and in no catalogue record, so the book page offered three formats where Amazon sells four.",
      },
    ],
    blockers: [
      "⚠ SHIPPING NOW WITH A DEAD ADDRESS. The paperback and hardcover went live on Amazon on 2026-08-27 and 2026-08-29. The last leaf directs the reader to valicepress.com/codex-enigmatica/verify to check the final answer. `valicepress.com` does not resolve — no DNS record exists. Every copy Amazon ships today carries an address that goes nowhere, and the book's central mechanic is unresolvable for that buyer. The page itself works, at the deployment hostname. This is now a live customer-facing failure rather than a pre-print risk, and registering the domain is the entire fix.",
      "The page count in the previous catalog revision (238) was wrong; the built interior is 274pp. Corrected from the PDF.",
      "The project's own kill gate (five external solvers, zero sessions recorded) was never passed. The book was published regardless. No puzzle in it has been solved by anyone other than its author.",
    ],
  },
  {
    /**
     * PENCIL & PAPER — Play Anywhere 1.
     *
     * The first original book from the Agent A line and the first Vâliçe title
     * at a 5 × 8 pocket trim. Built 2026-09-10.
     *
     * websiteStatus is "published" and BOTH formats are `unavailable`, which is
     * deliberate rather than contradictory: the companion QR is printed on page
     * 150 of the interior and decoded out of the built PDF, so the book's own
     * page and its companion must resolve from the day a proof is ordered — but
     * neither format is on sale until the KDP upload clears review, and a price
     * with no destination is a fabrication. The formats flip to `available` with
     * the ASIN in the same commit as the upload log.
     */
    slug: "pencil-and-paper",
    title: "Pencil & Paper",
    subtitle:
      "60 Games That Need Nothing but a Pencil — with Where Each One Came From and How to Win",
    language: "en",
    pageCount: 162,
    categories: ["games-and-play"],
    authors: ["emre-dogan"],
    bisac: ["GAM001000", "GAM019000", "REF000000"],
    series: { name: "Play Anywhere", volume: 1 },
    websiteStatus: "published",
    linkageDecision: {
      decision: "built_with_companion",
      why: "The companion leaf is in the typesetting, not spliced on: page 150 is a dedicated leaf carrying a 2.54 in code at 31.8 % of page height with valicepress.com/companion/play-anywhere beneath it. The code was decoded out of the BUILT PDF at 300 dpi with a real detector, not checked against the source artwork — QA/qr.json.",
    },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142239",
    onelinePromise:
      "Sixty pencil games with the history of each one sourced to a document, and the real strategy — including the solutions to the nine that are solved.",
    description:
      "Sixty games you can play with a pencil and whatever paper is nearest. Every game gets one opening: complete rules on the left, a diagram and two notes on the right. WHERE IT COMES FROM is the part the grid pads leave out and the part that took the longest — each claim is attached to a source, and six of them were read in the original: Dots and Boxes from Édouard Lucas's own text of 1883, where he says plainly that his students at the École Polytechnique devised it and not him; Hangman's ancestor from Alice Gomme's collection of 1894; Doublets from Lewis Carroll's own letter of 1879; Kayles from Dudeney's first edition of 1907; the hundred game and the magic square from Bachet in 1612. Where a game's origin is genuinely unrecorded, eight of them, the note says so and stops. HOW TO WIN is a real strategy note, and for the thirteen solved games it gives the solution, because a solved game is not a spoiled game — it is a game with a secret. Six parts, two indexes that sort every game by how many people you have and how long you have, and eight score sheets you may photocopy.",
    idealReader:
      "Someone who wants a real game on a train or at a table with the phones face down, and who would rather be told where a game came from and how to win it than handed a pad of pre-printed grids.",
    formats: [
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1299,
        pageCount: 162,
        isbn13: null,
        amazonAsin: "B0HK4T265V",
        amazonUrl: "https://www.amazon.com/dp/B0HK4T265V",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-17 at $12.99, the modelled price confirmed unchanged by the listing itself. Earlier reasoning: MODELED, not confirmed by KDP. 5 × 8 in, cream, B&W, 162 pp: KDP US printing is $0.85 + $0.012/page = $2.79, so $12.99 nets $5.00 at the 60 % rate (38.5 %), above the house floor. The figure KDP itself shows at upload replaces this line.",
      },
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: 699,
        pageCount: 162,
        isbn13: null,
        amazonAsin: "B0HJWTY45W",
        amazonUrl: "https://www.amazon.com/dp/B0HJWTY45W",
        kdp: "live",
        masterFileKey: "books/pencil-and-paper/master/v1/master.pdf",
        epubFileKey: "books/pencil-and-paper/master/v1/master.epub",
        priceBasis:
          "READ OFF KDP 2026-09-19. The Kindle edition went live on 2026-09-15 at $6.99, matching the direct price to the cent as the series rule requires. fulfillment stays 'direct': this store sells the file itself; the ASIN is recorded so the book page can link to Amazon too. Earlier reasoning: $6.99, the Series Bible price, provisioned in Paddle on 2026-09-10 as pro_01m25nyc7xwpmc82fga984tp2n / pri_01m25nycdntw031qg4sygyt4pw. This is the first direct-sale title with NO Kindle edition to match to the cent — the rule the rest of the list follows — so the number is set now and the Kindle listing will be set to match it, not the other way round. On Kindle the same $6.99 would sit in the 70 % band and net about $4.78 after delivery; direct it nets close to the whole $6.99 less Paddle's fee.",
      },
    ],
    blockers: [
      "NOT ON AMAZON, and blocked rather than merely undone. The paperback setup was attempted on 2026-09-10 and KDP refused the save: \"Title creation limit exceeded — You have reached the weekly title creation limit for this format.\" That is an account-level throttle, not a file problem: all four packages pass preflight, and the details form had accepted the whole metadata set before the refusal. No draft was created and the bookshelf holds no orphan record. The cause is on the same bookshelf — three other paperbacks went into review the same day. Retry after the weekly reset. Until then there is no ASIN and the paperback cannot be bought anywhere. The direct ebook IS live: masters are in R2 and the Paddle price exists.",
      "The direct checkout has been provisioned but NOT transacted. No test purchase has been put through, so the end-to-end till — Paddle → webhook → signed R2 URL — is verified by construction and by the catalogue cross-check, not by a completed order.",
      "No ISBN. The paperback will take a free KDP-assigned ISBN at upload, matching CDX-C1 and the World Games large print. The owned 978-625 number is queued as wave 5 of ISBN-QUEUE-PLAN.md and belongs to the IngramSpark edition, because KDP will not change an ISBN after publication.",
      "The 90-day commercial probe that decides whether Play Anywhere continues has not started. Series Bible gate: ≥ 30 units or ≥ 5 printable-pack sales.",
      "Hardcover is not eligible at a 5 × 8 trim on KDP and no large print is planned; both decisions are recorded with their reasons in the book's metadata.json rather than left as silent omissions.",
      "COVERS REPLACED 2026-09-10 with the Founder's artwork. Four defects were fixed before it was accepted — a fabricated, checksum-invalid ISBN barcode printed on the back; wrap geometry matching no printable book; the 60 GAMES badge sitting on the trim line; and PNG-with-alpha where KDP needs PDF and JPEG. One is reported and unfixed: the E in PAPER is set at x-height among full caps, baked into the raster. The cover artwork is AI-generated and is the only AI imagery in the product — the sixty interior diagrams are vector code. See PLA-01/docs/PLA-01-COVER-UPDATE-REPORT.md.",
    ],
  },
  {
    slug: "how-the-world-began",
    title: "How the World Began",
    subtitle:
      "Thirty Creation Myths from Every Corner of the Earth, Told Whole",
    language: "en",
    pageCount: 232,
    categories: ["myth-and-folklore"],
    authors: ["emre-dogan"],
    bisac: ["SOC011000", "REL051000", "HIS037000"],
    series: { name: "Under Every Sky", volume: 1 },
    websiteStatus: "published",
    linkageDecision: {
      decision: "built_with_companion",
      why: "The companion is in the typesetting, not spliced on: the final leaf carries a 1.05 in code beside the full-ledger note, and the code was DECODED OUT OF THE BUILT PDF at 300 dpi with a real detector (OpenCV) rather than checked against the source artwork — 04_BUILD/qa_qr.py. It resolves to valicepress.com/companion/under-every-sky, which serves the complete source ledger and all 726 typed claims as HTML, JSON and CSV.",
    },
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142242",
    onelinePromise:
      "Thirty creation myths told whole, each one with its source named, dated and taken apart — including the thirteen times the source turned out not to be what it claimed.",
    description:
      "Water that was there before anything. A void that is somebody's ancestor. An egg laid in the dark by Night. A giant taken apart and used for parts. A god who is sick and brings up the sun. A world made five times over, each attempt worse than the last. Thirty creation myths retold in full, from Egypt, Babylonia, Greece, India, Iran, China, Japan, Iceland, Finland, Aotearoa, the Society Islands, Samoa, the Congo, Yorubaland, Mexico, Guatemala, Peru and the forests of eastern North America. And with each one, the part other collections leave out: where it actually comes from. Who wrote it down, in what year, for which employer, and what that did to it. Sarmiento's chronicle was commissioned by the viceroy who beheaded the last Inca. Ellis was an army colonel in the country his regiment was subduing. The oldest surviving statement that the world was made by thought and speech was ground up as a millstone and then read backwards for a century. Every source is named, dated and described, including what is wrong with it — and where a source says it does not know, this book says so and supplies nothing. Thirteen corrections were logged while it was made, five of them because a file was not what its name claimed, and they are printed in the book.",
    idealReader:
      "Someone who has read a myth anthology and wanted to know who was actually talking — where the version came from, who wrote it down, and what they wanted out of it.",
    formats: [
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1699,
        pageCount: 232,
        isbn13: null,
        amazonAsin: "B0HJYDQ4Q4",
        amazonUrl: "https://www.amazon.com/dp/B0HJYDQ4Q4",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-15 at $16.99. Earlier reasoning: MODELED, not confirmed by KDP. 6 × 9 in, white, B&W, 232 pp: KDP US printing is $1.00 + $0.012/page = $3.78, so $16.99 nets $6.42 at the 60 % rate (37.8 %), above the house floor. The figure KDP itself shows at upload replaces this line.",
      },
      {
        format: "hardcover",
        availability: "coming_soon",
        fulfillment: "amazon",
        priceCents: 2699,
        pageCount: 232,
        // ASSIGNED BY KDP, READ OFF THE CONTENT PAGE 2026-09-20 — not chosen
        // here and not invented. KDP issued a free ISBN when the hardcover
        // title record was created; the imprint it forces is "Independently
        // published". The INTERIOR deliberately prints no identifier (the
        // copyright page says "ISBN to be assigned at registration"), so this
        // number lives on the cover barcode and in this row, and nowhere else.
        isbn13: "9798174550629",
        amazonAsin: null,
        amazonUrl: null,
        // "uploaded" is a new state and a narrow one: both files are on KDP
        // and the Print Previewer has been run and APPROVED, but nothing is
        // submitted and no ASIN exists. It is deliberately NOT "publishing" —
        // that word is reserved for a title Amazon has accepted, and the
        // ASIN test keys off it.
        kdp: "uploaded",
        masterFileKey: null,
        priceBasis:
          "MODELED, not confirmed by KDP. 6 × 9 in case laminate, 232 pp sits inside KDP's 76–550 hardcover range. VERIFIED 2026-09-20: the cover geometry was read again from the live KDP Cover Calculator (Hardcover · Black & white · White paper · Left to Right · Inches · 6 × 9 in · 232 pp) which returned Full Cover 14.286 × 10.417 in and Spine 0.711 × 9.236 in — an exact match to the built wrap (1028.59 × 750.024 pt) and to the figures KDP's own Previewer reports for this file. $26.99 is the house hardcover step over a $16.99 paperback and is still MODELLED: Rights & Pricing has not been reached, so KDP has quoted nothing.",
      },
      {
        format: "large_print",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 2299,
        pageCount: 386,
        isbn13: "9798174682702",
        amazonAsin: "B0HK7QRSKQ",
        amazonUrl: "https://www.amazon.com/dp/B0HK7QRSKQ",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-18 at $22.99. Its free KDP ISBN 9798174682702 is the one already recorded in ISBN-REGISTRY.md.",
      },
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: 999,
        pageCount: 232,
        isbn13: null,
        amazonAsin: "B0HJWXPJN6",
        amazonUrl: "https://www.amazon.com/dp/B0HJWXPJN6",
        kdp: "live",
        masterFileKey: "books/how-the-world-began/master/v1/master.pdf",
        epubFileKey: "books/how-the-world-began/master/v1/master.epub",
        priceBasis:
          "READ OFF KDP 2026-09-19 — Kindle live since 2026-09-15 at $9.99. Earlier reasoning: $9.99. The second original title sold direct before it exists on Amazon, so there is no Kindle list price to match — the number is set here and the Kindle listing will be set to match it. 232 pages and 74,489 words, of which 55 % is the source apparatus: the source note, the historical context and the comparative reading that no other creation-myth anthology carries. Buyers get a DRM-free watermarked PDF and a reflowable EPUB that passes EPUBCheck 5.1.0 with zero messages.",
      },
    ],
    blockers: [
      "CORRECTED 2026-09-20. The line here said \"NOT ON AMAZON. No KDP upload has been attempted for this title\" and had been false for some time: the paperback (B0HJYDQ4Q4) and the large print (B0HK7QRSKQ) are both LIVE, and both rows above have said so. What remains is the HARDCOVER, and it is no longer un-attempted either — see the next line.",
      "HARDCOVER COVER WAS REJECTED BY KDP AND IS NOW FIXED. KDP emailed \"Attention needed\" on 2026-09-16 for this exact ISBN: \"The front cover contains text/graphics that extend beyond the trim line ... all elements intended to be viewable [must] appear at least 0.716in (18.175mm) away from the outside edges.\" MEASURED 2026-09-20 on the built wrap: the \"Vâliçe Press\" imprint burned into the Founder's comp sat 0.624 in from the foot — 0.092 in inside the limit. ROOT CAUSE, in the source and not on the platform: covers_founder.py gave the SPINE an end-safety inset after an earlier rejection but never gave the PANELS one, so the comp's own foot margin was carried straight through. The builder now lifts the hardcover panels 0.117 in and repeats the panel's bottom row into the 0.591 in wrap, which folds around the board and is never seen. Rebuilt, re-stamped barcode-safe, re-uploaded and re-previewed: lowest type now 0.744 in clear, barcode zone 243/255, KDP's own previewer HasErrors:false, and its \"please preview and approve these changes\" warning cleared — which is the first positive evidence this house has that an approval actually persisted. The paperback was proved PIXEL-IDENTICAL before and after the change, so the live edition is untouched.",
      "HARDCOVER: UPLOADED AND APPROVED, NOT SUBMITTED. KDP title J4CX65CDZWM. On 2026-09-20 the interior (232 pp) and the barcode-safe wrap were both uploaded, the Print Previewer was run and APPROVED, and KDP's own previewer reported HasErrors:false. Geometry was re-read from the live KDP Cover Calculator that day — Full Cover 14.286 × 10.417 in, Spine 0.711 — and matches the built wrap (1028.59 × 750.024 pt) exactly. Details is complete (title, subtitle, author, 7 keywords, 3 categories, rights attested). REMAINING, AND OWNER-ONLY: the AI-content re-confirmation checkbox (\"By clicking this, I confirm that my answers are accurate\", which reappears whenever a new file is uploaded), then Save and Continue, then Rights & Pricing, then Publish.",
      "ISBN — RESOLVED for two of three print editions, and neither number was chosen here. KDP issued a free ISBN for the hardcover (9798174550629, imprint \"Independently published\", read off the content page 2026-09-20) and one for the large print (9798174682702). The interiors still print no identifier by design — the copyright page reads \"ISBN to be assigned at registration\" — so the number lives on the cover barcode and in this catalogue.",
      "The direct checkout is provisioned but NOT transacted. No test purchase has been put through, so provider → webhook → signed R2 URL is verified by construction and by the catalogue cross-check, not by a completed order. (Corrected 2026-09-20: this line named Paddle, which was retired on 2026-09-13. The provider is Lemon Squeezy.)",
      "The publishing-rights and AI-content declarations at KDP must be made by the account holder. Publishing rights ARE attested on the Details page (\"I own the copyright and I hold necessary publishing rights\", read 2026-09-20). All thirty sources are public domain and the retellings, apparatus and figures are original work.",
      "AI DISCLOSURE — CORRECTED 2026-09-20. This line used to say \"images: No\". That stopped being true on 2026-09-11, when the Founder supplied AI-generated cover artwork; the same line's neighbour still claimed the cover was typographic. Both were wrong and they contradicted the book's own printed copyright page, which names the cover as the exception. The truth, and what KDP now carries: TEXT — AI-assisted (\"Entire work, with extensive editing\"); IMAGES — \"One or a few AI-generated images, with extensive editing\", the cover and nothing else; TRANSLATIONS — none. The INTERIOR remains free of any image model: the four figures and six ornaments are deterministic vectors generated from the book's own records, and there is no figurative depiction of any deity, people or scene inside the book.",
      "The 90-day commercial probe that decides whether Under Every Sky continues has not started. Series gate: ≥ 40 units in 90 days after launch, or the series drops to one volume a year.",
    ],
  },
  {
    slug: "the-tricksters-table",
    title: "The Trickster's Table",
    subtitle:
      "Eighteen Trickster Tales from Eleven Traditions, and What Each One Cost",
    language: "en",
    pageCount: 112,
    categories: ["myth-and-folklore"],
    authors: ["emre-dogan"],
    bisac: ["SOC011000"],
    series: { name: "Under Every Sky", volume: 2 },
    // PUBLISHED 2026-09-11. The Founder opened the deployment window in the final
    // distribution directive. Writing "published" here IS the publication decision —
    // the loader's design is that publication is data, reviewable in a diff — and it
    // still does nothing on its own until load-catalog.mjs --commit runs.
    websiteStatus: "published",
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    providerPriceId: "2142244",
    blockers: [
      "KDP paperback: WAITING KDP WEEKLY TITLE LIMIT. Determined 2026-09-11 by a real save attempt, which KDP refused with \"You have reached the weekly title creation limit for this format.\" The Kindle slot was open the same day and a draft exists.",
      "KDP: the publishing-rights attestation and the three AI answers are the account holder's to make and have deliberately not been made.",
      "No ISBN. None has been fabricated.",
      "THERE IS NO HARDCOVER. Cancelled by the Founder 2026-09-11: 112 pages makes the spine too thin and destroys the economics. Do not add one back.",
    ],
    onelinePromise:
      "Eighteen tales of cunning, retold in full from named historical sources, with who wrote each one down and what that did to it.",
    description:
      "A spider borrows a coat and does not give it back. A god cuts off a woman's hair for no reason anyone wrote down, loses a bet about it, and has his mouth sewn shut with a thread that has a name. A day-old baby steals fifty cattle and reverses their hoofprints so the tracks point the wrong way. A wife bakes iron griddles into twenty-one loaves and waits for a giant.\n\nEighteen tales of cunning from the Akan of the Gold Coast, Jamaica, Norse Iceland, archaic Greece, Ireland, ancient Egypt, the Khoikhoi and Nama of Namaqualand, Türkiye, Japan, Māori Aotearoa and the Tamil country — each retold in full, and each followed by where it actually came from: who wrote it down, in what year, for which employer, and what that did to it.\n\nThe most famous trickster in the world is not in this book. Coyote is told only in winter across a great many nations, and a printed book is read in July. Every tradition this book declined is listed in the back with the reason.\n\nVolume Two of Under Every Sky.",
    formats: [
      {
        format: "ebook",
        availability: "available",
        fulfillment: "direct",
        priceCents: 699,
        pageCount: 112,
        amazonAsin: "B0HJWM4FG7",
        amazonUrl: "https://www.amazon.com/dp/B0HJWM4FG7",
        kdp: "live",
        masterFileKey: "books/the-tricksters-table/master/v1/master.pdf",
        epubFileKey: "books/the-tricksters-table/master/v1/master.epub",
        priceBasis:
          "READ OFF KDP 2026-09-19 — Kindle live since 2026-09-15 at $6.99. Earlier reasoning: $6.99, SET BY THE FOUNDER on 2026-09-11, replacing the $9.99 carried from the " +
          "production directive. The flag raised in the Stage-2 report is answered: $9.99 " +
          "was the same price as the 232-page Volume One on the same storefront and a buyer " +
          "can compare them in one glance. $9.99 must not reappear for this title.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1299,
        pageCount: 112,
        amazonAsin: "B0HJYHB14G",
        amazonUrl: "https://www.amazon.com/dp/B0HJYHB14G",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-15 at $12.99. Earlier reasoning: MODELLED, not confirmed by KDP. 6 x 9 in, white, B&W, 112 pp: KDP US printing is " +
          "$1.00 + $0.012/page = $2.34, so $12.99 nets $5.45 at the 60% rate. Not $16.99 like " +
          "Volume One, because that book is 232 pages. The $12.99 is the Founder's, set " +
          "2026-09-11. KDP's own printing figure at upload replaces the cost model, not the price.",
      },
    ],
  },
  {
    slug: "words-from-the-gods",
    title: "Words from the Gods",
    subtitle: "145 Everyday English Words, the Gods Inside Them, and How We Know",
    language: "en",
    pageCount: 334,
    categories: ["language-and-learning"],
    authors: ["emre-dogan"],
    bisac: ["LAN012000", "REF000000", "SOC011000"],
    series: { name: "Etymon", volume: 1 },
    // PUBLISHED 2026-09-17. The book's own KDP Kindle edition has been live since
    // 2026-09-15 (ASIN B0HJWRYQW5) and its companion page (/companion/etymon) has
    // linked to this exact slug since before this entry existed — the page was 404
    // and the companion's own link was dead. This entry closes that gap. Writing
    // "published" here IS the publication decision; it does nothing until
    // load-catalog.mjs --commit runs.
    websiteStatus: "published",
    kdpSelect: false,
    directSale: true,
    directSaleBlockedBy: null,
    // WIRED 2026-09-19. Lemon Squeezy product 1373115, variant 2145453, created in
    // the dashboard and read back from the live store: published, 999 cents,
    // test_mode false. This is what lets the ebook below say "direct".
    providerPriceId: "2145453",
    onelinePromise:
      "A hundred and forty-five everyday English words that still carry a god, a myth or a mistake inside them — and, for every one, the evidence.",
    description:
      "A hundred and forty-five everyday English words that still have a god, a myth or a mistake inside them — and, for every one, the evidence. Panic is Pan. Cereal is Ceres. Saturday is the one day of the week where the translators gave up. A clue is the ball of thread Ariadne handed Theseus. Hell means the covered place, and shares a root with the surname of a roofer.\n\nWhat separates this from the genre is the rule it was built on: an entry appears only if two independent authorities support it and at least one is a locatable entry in a dictionary of etymology. Not a passing mention — an entry, quoted so you can check it. Where the authorities disagree, both readings are printed. Where the origin is unknown, the book says unknown. And it lists the words it had to leave out, by name, with the reason.",
    idealReader:
      "Someone who has never trusted a one-line word-origin claim and wants the source quoted, not just asserted.",
    formats: [
      {
        format: "ebook",
        // CORRECTED 2026-09-17: this was filed as "coming_soon" / "direct" on
        // publication day, which was wrong on both counts — the Kindle
        // edition has been live and purchasable since 2026-09-15, so it is
        // available now, just not through this site yet. "direct" is for a
        // wired site checkout (see the puzzle book above for the pattern);
        // this book doesn't have one until providerPriceId is real.
        //
        // 2026-09-19: providerPriceId IS real now (variant 2145453), so the
        // sentence above has been satisfied rather than weakened — this flips
        // to "direct". The Kindle edition stays linked below; a reader can
        // still buy it from Amazon, and seven other titles already sit in
        // exactly this state (direct ebook, live Kindle ASIN, no Select).
        availability: "available",
        fulfillment: "direct",
        priceCents: usd(9.99),
        pageCount: 334,
        amazonAsin: "B0HJWRYQW5",
        amazonUrl: "https://www.amazon.com/dp/B0HJWRYQW5",
        kdp: "live",
        masterFileKey: "books/words-from-the-gods/master/v1/master.pdf",
        epubFileKey: "books/words-from-the-gods/master/v1/master.epub",
        priceBasis:
          "$9.99, matching the live KDP Kindle listing (B0HJWRYQW5, live since 2026-09-15) and " +
          "the Lemon Squeezy variant 2145453 that now takes the money here. " +
          "Master (62.58 MB PDF + 6.82 MB EPUB) uploaded to R2 2026-09-17. The direct sale is " +
          "live as of 2026-09-19, which is what fulfillment: \"direct\" now says truthfully.",
      },
      {
        format: "paperback",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 1599,
        pageCount: 334,
        amazonAsin: "B0HK4ZJWRK",
        amazonUrl: "https://www.amazon.com/dp/B0HK4ZJWRK",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-17 at $15.99. Earlier reasoning: MODELLED, not confirmed by KDP. 5.5 x 8.5 in, cream, B&W, 334 pp: KDP US printing " +
          "is $0.85 + $0.012/page = $4.62, netting $4.98 at the 60% rate. KDP shows a Draft " +
          "paperback as of 2026-09-16; no ASIN yet.",
      },
      {
        format: "hardcover",
        availability: "available",
        fulfillment: "amazon",
        priceCents: 3199,
        pageCount: 334,
        amazonAsin: "B0HK7SV712",
        amazonUrl: "https://www.amazon.com/dp/B0HK7SV712",
        kdp: "live",
        masterFileKey: null,
        priceBasis:
          "READ OFF KDP 2026-09-19 — live since 2026-09-18 at $31.99. The catalogue carried $24.99, which was the modelled figure and never the listed one; the KDP price wins because it is the price a reader is charged. Earlier reasoning: MODELLED, not confirmed by KDP. 334 pp sits inside KDP's 75-550 hardcover range at " +
          "5.5 x 8.5 in. KDP shows a Draft hardcover as of 2026-09-16; no ASIN yet.",
      },
    ],
    blockers: [
      "DIGITAL MASTERS ARE CONNECTED. `books/words-from-the-gods/master/v1/master.pdf` (62.58 MB) and `master.epub` (6.82 MB) are both in R2 and both are now wired to the record — the EPUB key was missing until 2026-09-19, so the web reader could not open a file that had been sitting in the bucket since 2026-09-17.",
      "62.58 MB is above the watermark worker's assumed 1–50 MB range (src/inngest/functions/watermark.ts) though well under its explicit >100 MB danger threshold; peak memory during stamping would be roughly 125–190 MB. Likely fine, not verified — flag before the first real order. Ghostscript's /ebook pass drops 1,828 non-ASCII characters on this book specifically (etymology diacritics), which build-digital-editions.mjs caught, which is why the PDF is the full interior rather than a compressed one.",
      "Turkish electronic ISBN 978-625-90964-7-6 was APPROVED and is EMBEDDED — the EPUB carries `urn:isbn:9786259096476` and passes EPUBCheck 0/0/0 (verified 2026-09-19). The earlier line here said the application was still BEKLİYOR under reference 1458898; that was true when written and stopped being true on 2026-09-18.",
      "CLEARED 2026-09-19. The direct-sale checkout exists: Lemon Squeezy product 1373115, variant 2145453, \$9.99, published, test_mode false. The product was created in the dashboard — `POST /v1/products` still answers 405 — and the earlier note that \"browser automation is refused on app.lemonsqueezy.com\" was wrong when it was written or has since stopped being true: the dashboard drove fine this session. The variant id was read back off the store's own product list, not typed.",
      "Paperback B0HK4ZJWRK ($15.99) and hardcover B0HK7SV712 ($31.99) went live on KDP on 2026-09-17 and 2026-09-18 and are recorded above. The LARGE PRINT paperback is still a KDP Draft at $26.99.",
    ],
  },
];

/* ===========================================================================
 * SALE ELIGIBILITY — what this storefront may charge for, and what it may say.
 *
 * Rewritten 2026-09-13, when Paddle was retired and Lemon Squeezy took over.
 *
 * WHAT WENT AWAY. The 2026-09-12 revision held the eighteen Valice Classics
 * editions out of the paid checkout and then, four hours later, out of the
 * storefront altogether, because Paddle declined valicepress.com twice, the
 * second time naming "reselling/redistribution of third party content". That
 * was a rule about one payment provider's appetite, not a rule about these
 * books. The provider is gone, so the rule goes with it: all eighteen are
 * published again, and all eighteen may be sold again.
 *
 * WHAT DID NOT GO AWAY, and must not:
 *
 *   RULE — do not advertise a print edition that does not exist. A format
 *   marked `coming_soon` with no ASIN is an intention, not an edition.
 *   `unavailable` is the value the loader deletes, so the storefront stops
 *   listing it rather than showing "not yet available" next to a buy button.
 *   This predates the Paddle finding and outlives it.
 *
 *   RULE — a book under an exclusivity term is not sellable here whatever the
 *   provider. Codex Mythologica's Kindle edition is in KDP Select until
 *   2026-11-03; that is a contract, and it is expressed per-book in
 *   `directSale` / `directSaleBlockedBy`, not here.
 *
 * WHAT PUBLIC DOMAIN MEANS ON THESE PAGES. Nothing in this file claims the
 * underlying historical texts as Valice Press property, and nothing should.
 * What is ours in a Valice Classics volume is the edition: the typesetting,
 * the introductions, the head-notes, the glossaries, the indexes and the
 * apparatus — measured at 20–22% of each book by the factory's own gate. The
 * source text, its translator and its edition are named in every description,
 * and `rights` records where the scan came from. Selling an edition of a
 * public-domain work is ordinary publishing; misrepresenting who wrote it
 * would not be, and is what the checks in `valice-catalog.test.ts` exist to
 * prevent.
 * =========================================================================== */

const PRINT_FORMATS = new Set(["paperback", "hardcover", "large_print"]);

/**
 * The Paddle price ids each title carried before the retirement, frozen as a
 * literal rather than derived from the rows — the rows no longer have them.
 *
 * Kept because an accounting question about an order taken through Paddle has
 * to be answerable, and because it is the evidence that these titles WERE
 * provisioned and sellable, which is a different fact from "they were never
 * ready". Nothing reads this at runtime. Do not re-use these ids: Paddle is
 * retired and the account is not the one taking money.
 */
export const RETIRED_PADDLE_PRICE_IDS = Object.freeze({
  meditations: "pri_01m1btwjzqvest52bwde6mqqam",
  "codex-bestiarium": "pri_01m1zbewy6v80k9r58qbsxz1r4",
  "the-great-book-of-world-myths": "pri_01m1hjdhhvq98v2pdxxenh8q1z",
  "the-great-book-of-world-games": "pri_01m1zbf17bapxg1hd2gtp1554a",
  "greek-alphabet-handwriting-workbook": "pri_01m1pmtds9p93zm735432kv98x",
  "codex-mythologica-the-puzzle-book": "pri_01m1sbkq3qsjyfx3tzwctay664",
  "the-puzzles-of-henry-dudeney": "pri_01m1ha3tdx5bbyfqhe8k6qrep4",
  "epictetus-discourses-and-enchiridion": "pri_01m1pttdvakbj8p0vb8tc86nj5",
  "seneca-selected-dialogues": "pri_01m1pttekkh73w3rjewmv1p2cy",
  "myths-and-legends-of-china": "pri_01m1pttfb8fj469accf8znvjb7",
  "indian-myth-and-legend": "pri_01m1pttg3r2nd796vhmh7t22j5",
  "mythical-monsters": "pri_01m1pttgx4axvwt4tzkz73tz68",
  "games-ancient-and-oriental": "pri_01m1v4n69wd2th3pf1cbw8an3n",
  "korean-games": "pri_01m1v4n6zery50yws32dpspqve",
  kwaidan: "pri_01m1v4n80k6g2tba6wt8882ehf",
  "fairy-mythology-vol-1": "pri_01m1ygdhj80yaesd4xzsf05hby",
  "fairy-mythology-vol-2": "pri_01m1ygdm5f4zfcsh3zd4a1pv1s",
  "british-goblins": "pri_01m1ygdfd1x5hv5ps20c5zzkg1",
  "book-of-were-wolves": "pri_01m1ygdddc64qsn9kervbdz2kk",
  "sea-monsters-unmasked": "pri_01m1ygdbp4rk8vb0b87tebaq09",
  "traditional-games": "pri_01m1v4n8mdw8dnnsdc2bqwf56d",
  "chess-and-playing-cards": "pri_01m1v4n991k3h8x20sbwp9455z",
  mancala: "pri_01m1v4n9ygd9z3vbgstcjbmvt0",
  "codex-enigmatica": "pri_01m1btjc0bp4phgs7vrqhq4g18",
  "pencil-and-paper": "pri_01m25nycdntw031qg4sygyt4pw",
  "how-the-world-began": "pri_01m26qf1088bc4fssshphw2x3m",
  "the-tricksters-table": "pri_01m285tsm54yf4tnme163800ga",
});

/**
 * Apply the print-format rule to the raw catalog.
 *
 * The `@template` is load-bearing, not decoration: without it this returns
 * `any[]`, every consumer of `BOOKS` loses inference, and TypeScript starts
 * reporting implicit-any in unrelated test files that only ever did
 * `BOOKS.filter(x => x.websiteStatus === "published")`.
 *
 * @template T
 * @param {T[]} books
 * @returns {T[]}
 */
function applySaleEligibility(books) {
  return books.map((book) => ({
    ...book,
    formats: (book.formats ?? []).map((f) =>
      PRINT_FORMATS.has(f.format) && f.availability === "coming_soon" && !f.amazonAsin
        ? { ...f, availability: "unavailable" }
        : f,
    ),
  }));
}

export const BOOKS = applySaleEligibility(RAW_BOOKS);


/**
 * Titles deliberately NOT loaded into the storefront, and why. Kept here so
 * the omission is a recorded decision rather than an oversight.
 */
export const EXCLUDED = [
  {
    title: "Before You Cut — Book 1: Measure & Diagnose",
    reason:
      "255-page interior exists but has no cover, no title page, no copyright page and no bibliography. Substantively: 0 of 43 fit signs and 0 of 129 cause claims are verified, and the series kill-gate fails by design on two hard stops (0/3 home sewers, 0/19 physical validations). Not a sellable product.",
  },
  {
    title: "Before You Cut — Books 2 and 3",
    reason: "Empty scaffolds — four and five files respectively, zero content.",
  },
  {
    title: "License & Launch: California Life & Health",
    reason:
      "Scaffolding only: 0 questions written, 0 manuscript words, 0 built files, no author name. Structurally unpublishable under its own architecture while decision K9 forbids hiring an SME and the SME kill-gate remains unpassable.",
  },
  {
    title:
      "Turkish web projects (tuzun-hafizasi, intikam-yemini, mendiran-vakayinamesi, solgun-kitabe, Fabl)",
    reason:
      "Web reader applications, not typeset books — no PDF or EPUB output exists for any of them. `tuzun-hafizasi` (63,541 words, v1.0 locked) is genuinely publication-grade prose and is the strongest future candidate, but would need a full typesetting pass first. All dormant since May–June 2026.",
  },
];
