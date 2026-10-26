/**
 * Live read for `/tour-stats/2026` (#1141).
 *
 * Prefer `public_tour_stats/_year_2026` (CDN, then Firestore REST). That doc
 * is the calendar-year slice, so a New Year's Run that crosses January 1
 * contributes only its 2026 shows.
 *
 * Until that doc exists, add the published tour pages whose show dates all
 * sit inside 2026. No App Check and no Firestore SDK on the happy path.
 */
import { fetchFirestoreRestDocument } from '../../../shared/lib/firestoreRestDecode';
import {
  fetchPublicTourStatsDoc,
  fetchPublicTourStatsIndex,
} from './fetchPublicTourStats';
import {
  PUBLIC_TOUR_STATS_FIRESTORE_PROJECT_ID,
  publicTourStatsCdnUrl,
} from '../model/publicTourStatsCdn';
import {
  ANNUAL_TOUR_STATS_YEAR,
  annualYearDocId,
  normalizePublishedYearStats,
  rollUpAnnualTourStats,
} from '../model/rollUpAnnualTourStats';

/**
 * @param {string} docId
 * @param {AbortSignal} [signal]
 * @returns {Promise<unknown | null>}
 */
async function fetchCdnJson(docId, signal) {
  try {
    const res = await fetch(publicTourStatsCdnUrl(docId), {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const data = await res.json();
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * @param {number} [year]
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<ReturnType<typeof rollUpAnnualTourStats>>}
 */
export async function fetchAnnualTourStats(year = ANNUAL_TOUR_STATS_YEAR, opts = {}) {
  const target = Math.trunc(Number(year)) || ANNUAL_TOUR_STATS_YEAR;
  const docId = annualYearDocId(target);
  const signal = opts.signal;

  const fromCdn = normalizePublishedYearStats(await fetchCdnJson(docId, signal), target);
  if (fromCdn) return fromCdn;

  try {
    const rest = normalizePublishedYearStats(
      await fetchFirestoreRestDocument(
        PUBLIC_TOUR_STATS_FIRESTORE_PROJECT_ID,
        `public_tour_stats/${docId}`,
        { signal },
      ),
      target,
    );
    if (rest) return rest;
  } catch {
    // Tour-page rollup still paints.
  }

  const index = await fetchPublicTourStatsIndex({ signal });
  const slugs = (Array.isArray(index?.tours) ? index.tours : [])
    .map((tour) => (typeof tour?.tourSlug === 'string' ? tour.tourSlug.trim() : ''))
    .filter((slug) => slug && !slug.startsWith('_'));
  const docs = (
    await Promise.all(slugs.map((slug) => fetchPublicTourStatsDoc(slug, { signal })))
  ).filter(Boolean);
  return rollUpAnnualTourStats(docs, target);
}
