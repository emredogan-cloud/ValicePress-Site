/**
 * Which Wikimedia Commons file is each author's portrait, and how it is cropped.
 *
 * The pipeline is `fetch-portraits.mjs` (check licence, download to a scratch folder, contact sheet) then
 * `ingest-portraits.mjs` (crop to 3:4, never enlarge, write /public/images/authors/<slug>.webp, record
 * provenance in the author's JSON). An author who is not here has NO photograph on this site: the page
 * shows the designed identity mark (initials in an emerald ring), and `portraitNote` says why.
 *
 * `crop` is [x0, y0, x1, y1] in the SOURCE file's pixels (as served at `width`, 1600 at most), chosen by
 * looking at the picture; it must be 3:4 within a pixel or two, or the ingest refuses it.
 */
export const PORTRAITS = {
  "lafcadio-hearn": { file: "Lafcadio Hearn portrait.jpg", key: "Gutekunst", alt: "Photograph of Lafcadio Hearn, 1889", credit: "Frederick Gutekunst, 1889 · public domain" },
  "marcus-aurelius": { file: "Marcus Aurelius Glyptothek Munich.jpg", key: "Bibi Saint-Pol", alt: "Marble bust of Marcus Aurelius in the Glyptothek, Munich", credit: "Bust in the Glyptothek, Munich · photograph by Bibi Saint-Pol, public domain" },
  "sabine-baring-gould": { file: "Portret van Sabine Baring-Gould, RP-F-2001-7-232D-15.jpg", key: "Rijksmuseum", crop: [332, 640, 1126, 1699], alt: "Photographic portrait of Sabine Baring-Gould, between 1883 and 1893", credit: "W. & D. Downey, between 1883 and 1893 · Rijksmuseum, CC0" },
  "hans-christian-andersen": { file: "HCA by Thora Hallager 1869 crop.jpg", key: "Hallager", alt: "Photograph of Hans Christian Andersen, 1869", credit: "Thora Hallager, 1869 · public domain" },
  "mary-shelley": { file: "Mary Wollstonecraft Shelley Rothwell.tif", key: "Rothwell", alt: "Portrait of Mary Shelley by Richard Rothwell, exhibited 1840", credit: "Richard Rothwell, exhibited 1840 · National Portrait Gallery, London · public domain" },
  "edgar-allan-poe": { file: "Edgar Allan Poe, circa 1849, restored, squared off.jpg", key: "Cuerden", alt: "Daguerreotype portrait of Edgar Allan Poe, June 1849", credit: "Daguerreotype, June 1849 · restored by Yann Forget and Adam Cuerden · public domain" },
  "virginia-woolf": { file: "George Charles Beresford - Virginia Woolf in 1902 - Restoration.jpg", key: "Beresford", alt: "Photograph of Virginia Woolf, 1902", credit: "George Charles Beresford, 1902 · restored by Adam Cuerden · public domain" },
  "oscar-wilde": { file: "Oscar Wilde by Napoleon Sarony. Three-quarter-length photograph, seated (cropped).jpg", key: "Sarony", alt: "Photograph of Oscar Wilde, 1882", credit: "Napoleon Sarony, 1882 · restored by Adam Cuerden · public domain" },
  "ovid": { file: "Ovid by an anonymous sculptor.jpg", key: "Lucasaw", alt: "Marble bust in the Uffizi, assumed to be Ovid", credit: "Bust of Ovid (assumed), Uffizi Gallery, Florence · photograph by Lucasaw, CC BY-SA 4.0" },
  "henry-dudeney": { file: "Henry Dudeney.jpg", key: "Unknown author", alt: "Photograph of Henry Dudeney, c. 1910", credit: "Unknown photographer, c. 1910 · public domain" },
  "sam-loyd": { file: "Loyd, Sam - DPLA - 66711e1d8fb86a674b6a34e6031d7254.jpg", key: "Pearsall", alt: "Photograph of Sam Loyd", credit: "Frank Pearsall, New York · Cleveland Public Library · public domain" },
  "martin-gardner": { file: "Author Martin Gardner at a CSICOP Executive Council Meeting in 1979.jpg", key: "RobertoTenore", crop: [24, 0, 534, 680], alt: "Photograph of Martin Gardner at a CSICOP meeting, 1979", credit: "RobertoTenore · CC BY-SA 3.0" },
  "h-j-r-murray": { file: "Harold James Ruthven Murray.jpg", key: "Kidd and Baker", alt: "Photograph of H. J. R. Murray, 1907", credit: "Kidd and Baker, 1907 · public domain" },
  "ian-livingstone": { file: "Ian Livingstone.jpg", key: ["FrankBoyd", "Frédéric MICHEL"], crop: [95, 0, 815, 960], alt: "Photograph of Ian Livingstone at the 2006 BAFTA Awards", credit: "FrankBoyd (Flickr), retouched by Frédéric Michel · CC BY-SA 2.0" },
  "karin-kallmaker": { file: "Karin Kallmaker.jpg", key: "Franseconi", alt: "Photograph of Karin Kallmaker", credit: "Judy Franseconi · CC0, released by the subject" },
  "ann-bannon": { file: "Ann Bannon in 1983.jpg", key: "Corrine", alt: "Photograph of Ann Bannon, 1983", credit: "Tee Corinne, 1983 · CC BY-SA 3.0" },
  "patricia-highsmith": { file: "Patricia-Highsmith-1962.jpg", key: "Harper", alt: "Publicity photograph of Patricia Highsmith, c. 1962", credit: "Harper & Brothers publicity photograph, c. 1962 · public domain" },
  "sarah-waters": { file: "Sarah Waters.jpg", key: "Annie_C_2", crop: [119, 0, 635, 688], alt: "Photograph of Sarah Waters at a book signing, 2006", credit: "Annie_C_2, 2006 · CC BY 2.0" },
  "emma-donoghue": { file: "Irish-Canadian author Emma Donoghue.JPG", key: "Afonso", alt: "Photograph of Emma Donoghue", credit: "Katrina Afonso · CC BY-SA 4.0" },
  "jeanette-winterson": { file: "Installation of Chancellor Professor Jackie Kay MBE - University of Salford, Peel Hall (17136470459) (cropped 2).jpg", key: "Salford", alt: "Photograph of Jeanette Winterson speaking", credit: "University of Salford Press Office · CC BY 2.0" },
  "nicola-griffith": { file: "Nicola Griffith in 2014.png", key: "Njgriffith", crop: [270, 0, 1710, 1920], alt: "Photograph of Nicola Griffith, 2014", credit: "Njgriffith · CC BY-SA 4.0" },
  "t-h-thomas": { file: "TH Thomas.jpg", key: "Goscombe", crop: [0, 60, 449, 659], alt: "Plaster bust of T. H. Thomas by Sir William Goscombe John, shown at the Royal Academy in 1903", credit: "Bust by Sir William Goscombe John, Royal Academy 1903 · reproduced in Royal Academy Pictures 1903 · public domain" },
  "malinda-lo": { file: "Malinda Lo 2017.jpg", key: "", alt: "", credit: "", refusedNote: "The only freely licensed photograph on Wikimedia Commons carries a personality-rights flag, so it is not used here." },
};

/** Authors with no photograph, and the true reason. */
export const NO_PORTRAIT = {
  "thomas-keightley": "No freely licensed portrait has been located.",
  "radclyffe": "No freely licensed photograph has been located.",
  "katherine-v-forrest": "No freely licensed photograph has been located.",
  "wirt-sikes": "No freely licensed portrait has been located.",
  "henry-lee": "No freely licensed portrait has been located.",
};

/** Free licences only. Anything else is refused, and so is any Commons "restrictions" flag. */
export const FREE_LICENCE = /^(public domain|pd[- ]|cc0|cc[- ]by(?:[- ]sa)?[- ][0-9.]+(?:[- ][a-z]{2,3})?$)/i;
export const NON_FREE = /\b(nc|nd|non-?commercial|no ?deriv|fair use)\b/i;
