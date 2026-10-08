/**
 * The reference authors directory: WHO is on it and which Wikipedia article is the first source for each.
 *
 * This file is the roster only. What is *said* about each person lives in
 * `src/content/reference-authors.json`, written from the sources fetched by `fetch-research.mjs`
 * and checked by `verify-sources.mjs`. Nothing here is a claim about a person.
 *
 * `catalogue` marks the people Valice Press actually publishes (an edition of their work is in
 * `scripts/catalog/valice-catalog.mjs`); every other entry is a REFERENCE author — a thematic
 * neighbour of the shelf — and is presented as exactly that.
 */
export const ROSTER = [
  // ---- historically significant (10) ----
  { slug: "lafcadio-hearn", category: "historical", wiki: "Lafcadio Hearn", catalogue: true },
  { slug: "marcus-aurelius", category: "historical", wiki: "Marcus Aurelius", catalogue: true },
  { slug: "thomas-keightley", category: "historical", wiki: "Thomas Keightley", catalogue: true },
  { slug: "sabine-baring-gould", category: "historical", wiki: "Sabine Baring-Gould", catalogue: true },
  { slug: "hans-christian-andersen", category: "historical", wiki: "Hans Christian Andersen" },
  { slug: "mary-shelley", category: "historical", wiki: "Mary Shelley" },
  { slug: "edgar-allan-poe", category: "historical", wiki: "Edgar Allan Poe" },
  { slug: "virginia-woolf", category: "historical", wiki: "Virginia Woolf" },
  { slug: "oscar-wilde", category: "historical", wiki: "Oscar Wilde" },
  { slug: "ovid", category: "historical", wiki: "Ovid" },
  // ---- games, puzzles, game-books (5) ----
  { slug: "henry-dudeney", category: "game-puzzle", wiki: "Henry Dudeney", catalogue: true },
  { slug: "sam-loyd", category: "game-puzzle", wiki: "Sam Loyd" },
  { slug: "martin-gardner", category: "game-puzzle", wiki: "Martin Gardner" },
  { slug: "h-j-r-murray", category: "game-puzzle", wiki: "H. J. R. Murray" },
  { slug: "ian-livingstone", category: "game-puzzle", wiki: "Ian Livingstone" },
  // ---- sapphic and lesbian romance (10) ----
  { slug: "radclyffe", category: "sapphic-romance", wiki: "Radclyffe" },
  { slug: "katherine-v-forrest", category: "sapphic-romance", wiki: "Katherine V. Forrest" },
  { slug: "karin-kallmaker", category: "sapphic-romance", wiki: "Karin Kallmaker" },
  { slug: "ann-bannon", category: "sapphic-romance", wiki: "Ann Bannon" },
  { slug: "patricia-highsmith", category: "sapphic-romance", wiki: "Patricia Highsmith" },
  { slug: "sarah-waters", category: "sapphic-romance", wiki: "Sarah Waters" },
  { slug: "emma-donoghue", category: "sapphic-romance", wiki: "Emma Donoghue" },
  { slug: "jeanette-winterson", category: "sapphic-romance", wiki: "Jeanette Winterson" },
  { slug: "nicola-griffith", category: "sapphic-romance", wiki: "Nicola Griffith" },
  { slug: "malinda-lo", category: "sapphic-romance", wiki: "Malinda Lo" },
  // ---- catalogue authors with a researched page, beyond the 25 (published here; public domain) ----
  { slug: "wirt-sikes", category: "historical", wiki: "Wirt Sikes", catalogue: true, extra: true },
  { slug: "henry-lee", category: "historical", wiki: "Henry Lee (naturalist)", catalogue: true, extra: true },
  { slug: "t-h-thomas", category: "historical", wiki: "Thomas Henry Thomas", catalogue: true, extra: true },
];
