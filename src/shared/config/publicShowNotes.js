/**
 * Public show notes (#684).
 *
 * The route family exists so a night that clears the richness gate can render.
 * Crawl stays off until live notes are in `public_show_notes` and a follow-up
 * flips {@link PUBLIC_SHOW_NOTES_INDEXABLE}. Until then the hub is prerendered
 * `noindex` and neither the hub nor a night URL is a sitemap target.
 */

export const PUBLIC_SHOW_NOTES_PATH = '/tour-notes';

export const PUBLIC_SHOW_NOTES_COLLECTION = 'public_show_notes';

export const PUBLIC_SHOW_NOTES_INDEX_ID = '_index';

/**
 * `false` keeps `/tour-notes` and `/tour-notes/:showDate` at `noindex, follow`
 * and out of `sitemap.xml` / `llms.txt`.
 */
export const PUBLIC_SHOW_NOTES_INDEXABLE = false;

export const PUBLIC_SHOW_NOTES_HUB = Object.freeze({
  path: PUBLIC_SHOW_NOTES_PATH,
  title: "Phish show notes | Setlist Pick 'Em",
  description:
    'Short notes on Phish nights with a bustout or a song new to the tour. Opener, encore, and that fact.',
  h1: 'Phish show notes',
  paragraphs: Object.freeze([
    'Tour notes are short write-ups of Phish nights that had a bustout or a song new to the tour. Each note names the opener, the encore, and that fact.',
    'A bustout gap is the pre-show count from Phish.net. Song totals for the whole tour stay on the tour stats page.',
    'Lock six slots before the next show. The note stops after the opener, the encore, and that one fact.',
  ]),
});

/**
 * @returns {'index, follow' | 'noindex, follow'}
 */
export function publicShowNotesRobots() {
  return PUBLIC_SHOW_NOTES_INDEXABLE ? 'index, follow' : 'noindex, follow';
}

/**
 * @param {string} [showDate]
 * @returns {string}
 */
export function publicShowNotePath(showDate) {
  if (typeof showDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(showDate)) {
    return `${PUBLIC_SHOW_NOTES_PATH}/${showDate}`;
  }
  return PUBLIC_SHOW_NOTES_PATH;
}
