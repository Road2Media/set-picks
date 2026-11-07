/**
 * Public tour-stats index helpers (#665) — current tour = newest lastShowDate.
 */

/**
 * Path for a public tour filter selection (#929).
 * Always use the slug URL — including the current/default tour — so Summer
 * (and future defaults) share an address bar with their SEO prerender page.
 *
 * @param {string} slug
 * @returns {string}
 */
export function publicTourStatsPathForSlug(slug) {
  const next = String(slug ?? '').trim();
  if (!next) return '/tour-stats';
  return `/tour-stats/${encodeURIComponent(next)}`;
}

/**
 * @param {{ tourSlug?: string, tourLabel?: string, lastShowDate?: string | null }} a
 * @param {{ tourSlug?: string, tourLabel?: string, lastShowDate?: string | null }} b
 * @returns {number}
 */
export function comparePublicTourIndexEntries(a, b) {
  const la = typeof a?.lastShowDate === 'string' ? a.lastShowDate : '';
  const lb = typeof b?.lastShowDate === 'string' ? b.lastShowDate : '';
  if (lb !== la) return lb > la ? 1 : -1;
  return String(a?.tourLabel || a?.tourSlug || '').localeCompare(
    String(b?.tourLabel || b?.tourSlug || ''),
  );
}

/**
 * @param {Array<{ tourSlug?: string, tourLabel?: string, lastShowDate?: string | null }>} tours
 * @returns {Array<{ tourSlug: string, tourLabel?: string, lastShowDate?: string | null }>}
 */
export function sortPublicTourIndex(tours) {
  const list = Array.isArray(tours)
    ? tours.filter((t) => t && typeof t.tourSlug === 'string' && t.tourSlug.trim())
    : [];
  return [...list].sort(comparePublicTourIndexEntries);
}

/**
 * Not a tour. Phish at MSG is `/phish-at-msg` (#1192) and must stay out of
 * this switcher even if a stale index row names the slug.
 */
export const PUBLIC_TOUR_SWITCHER_EXCLUDED_SLUGS = new Set(['msg']);

/**
 * Tours the public `<select>` may offer. Drops MSG, year rollups, and the
 * index doc. Order matches `sortPublicTourIndex`.
 *
 * @param {Array<{ tourSlug?: string, tourLabel?: string, lastShowDate?: string | null }>} tours
 * @returns {Array<{ tourSlug: string, tourLabel?: string, lastShowDate?: string | null }>}
 */
export function toursForPublicSwitcher(tours) {
  return sortPublicTourIndex(tours).filter((tour) => {
    const slug = String(tour.tourSlug || '').trim().toLowerCase();
    if (!slug || slug.startsWith('_')) return false;
    return !PUBLIC_TOUR_SWITCHER_EXCLUDED_SLUGS.has(slug);
  });
}

/**
 * Current / most-recent tour for the public filter default.
 * Prefers newest `lastShowDate`; falls back to `preferredSlug` only when dates
 * are missing and that slug is in the list.
 *
 * @param {Array<{ tourSlug?: string, tourLabel?: string, lastShowDate?: string | null }>} tours
 * @param {string} [preferredSlug]
 * @returns {string}
 */
export function resolveDefaultPublicTourSlug(tours, preferredSlug = '') {
  const sorted = toursForPublicSwitcher(tours);
  if (sorted.length === 0) return '';

  const hasAnyDate = sorted.some(
    (t) => typeof t.lastShowDate === 'string' && t.lastShowDate.trim(),
  );
  if (hasAnyDate) {
    return sorted[0].tourSlug;
  }

  const preferred = String(preferredSlug ?? '').trim();
  if (preferred && sorted.some((t) => t.tourSlug === preferred)) {
    return preferred;
  }
  return sorted[0].tourSlug;
}
