/**
 * Public aggregate reads for `/tour-stats` (#665 / #853 / #869).
 *
 * Happy path does **not** load App Check or the Firestore SDK:
 * 1. Same-origin CDN JSON (`/tour-stats-data/*.json`, written at build)
 * 2. Firestore REST (world-readable `public_tour_stats`, no App Check)
 * 3. SDK + `ensureAppCheckNow()` last resort (dashboard / REST blocked)
 *
 * #869: Safari Private stays on the data-gate skeleton because reCAPTCHA
 * Enterprise + WebChannel serialize much worse on WebKit than Chrome mobile.
 * CDN / REST clear that gate. Do not statically import `firebase/*`.
 */

import { fetchFirestoreRestDocument } from '../../../shared/lib/firestoreRestDecode';
import {
  PUBLIC_TOUR_STATS_FIRESTORE_PROJECT_ID,
  publicTourStatsCdnUrl,
} from '../model/publicTourStatsCdn';

/**
 * @returns {Promise<{
 *   db: import('firebase/firestore').Firestore,
 *   doc: typeof import('firebase/firestore').doc,
 *   getDoc: typeof import('firebase/firestore').getDoc,
 *   getDocs: typeof import('firebase/firestore').getDocs,
 *   collection: typeof import('firebase/firestore').collection,
 *   query: typeof import('firebase/firestore').query,
 *   where: typeof import('firebase/firestore').where,
 * }>}
 */
async function readyPublicTourStatsFirestore() {
  const [{ ensureAppCheckNow }, { ensureFirebase }, firestore] =
    await Promise.all([
      import('../../../shared/lib/firebaseAppCheck.js'),
      import('../../../shared/lib/ensureFirebase.js'),
      import('firebase/firestore'),
    ]);
  await ensureAppCheckNow();
  const { db } = await ensureFirebase();
  return {
    db,
    doc: firestore.doc,
    getDoc: firestore.getDoc,
    getDocs: firestore.getDocs,
    collection: firestore.collection,
    query: firestore.query,
    where: firestore.where,
  };
}

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
 * @typedef {{
 *   tourSlug: string,
 *   tourLabel: string,
 *   lastShowDate?: string | null,
 *   firstShowDate?: string | null,
 *   showCount?: number,
 * }} PublicTourIndexEntry
 */

/**
 * @param {unknown} data
 * @returns {{ tours: PublicTourIndexEntry[], defaultTourSlug: string } | null}
 */
export function normalizePublicTourStatsIndex(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tours)) {
    return null;
  }
  const tours = data.tours;
  const defaultTourSlug =
    typeof data.defaultTourSlug === 'string' && data.defaultTourSlug
      ? data.defaultTourSlug
      : tours[0]?.tourSlug || '';
  return { tours, defaultTourSlug };
}

/**
 * @param {string} slug
 * @param {unknown} data
 * @returns {Record<string, unknown> | null}
 */
export function normalizePublicTourStatsDoc(slug, data) {
  if (!data || typeof data !== 'object') return null;
  const hasRows =
    Array.isArray(data.topSongs) ||
    Array.isArray(data.bustouts) ||
    Array.isArray(data.gapHighlights);
  const hasLabel =
    typeof data.tourLabel === 'string' || typeof data.tourSlug === 'string';
  if (!hasRows && !hasLabel) return null;
  return { id: slug, ...data };
}

/**
 * @param {{ signal?: AbortSignal, skipCdn?: boolean }} [opts]
 * @returns {Promise<{
 *   tours: PublicTourIndexEntry[],
 *   defaultTourSlug: string,
 * }>}
 */
export async function fetchPublicTourStatsIndex(opts = {}) {
  const signal = opts.signal;
  if (!opts.skipCdn) {
    const cdn = normalizePublicTourStatsIndex(await fetchCdnJson('_index', signal));
    if (cdn) return cdn;
  }
  try {
    const rest = normalizePublicTourStatsIndex(
      await fetchFirestoreRestDocument(
        PUBLIC_TOUR_STATS_FIRESTORE_PROJECT_ID,
        'public_tour_stats/_index',
        { signal },
      ),
    );
    if (rest) return rest;
  } catch {
    // SDK last resort.
  }
  return fetchPublicTourStatsIndexViaSdk();
}

/**
 * @returns {Promise<{
 *   tours: PublicTourIndexEntry[],
 *   defaultTourSlug: string,
 * }>}
 */
async function fetchPublicTourStatsIndexViaSdk() {
  const { db, doc, getDoc } = await readyPublicTourStatsFirestore();
  const snap = await getDoc(doc(db, 'public_tour_stats', '_index'));
  if (!snap.exists()) {
    return { tours: [], defaultTourSlug: '' };
  }
  return (
    normalizePublicTourStatsIndex(snap.data() || {}) || {
      tours: [],
      defaultTourSlug: '',
    }
  );
}

/**
 * @param {string} tourSlug
 * @param {{ signal?: AbortSignal, skipCdn?: boolean }} [opts]
 * @returns {Promise<null | Record<string, unknown>>}
 */
export async function fetchPublicTourStatsDoc(tourSlug, opts = {}) {
  const slug = String(tourSlug ?? '').trim();
  if (!slug || slug.startsWith('_')) return null;
  const signal = opts.signal;
  if (!opts.skipCdn) {
    const cdn = normalizePublicTourStatsDoc(
      slug,
      await fetchCdnJson(slug, signal),
    );
    if (cdn) return cdn;
  }
  try {
    const rest = normalizePublicTourStatsDoc(
      slug,
      await fetchFirestoreRestDocument(
        PUBLIC_TOUR_STATS_FIRESTORE_PROJECT_ID,
        `public_tour_stats/${slug}`,
        { signal },
      ),
    );
    if (rest) return rest;
  } catch {
    // SDK last resort.
  }
  return fetchPublicTourStatsDocViaSdk(slug);
}

/**
 * @param {string} slug
 * @returns {Promise<null | Record<string, unknown>>}
 */
async function fetchPublicTourStatsDocViaSdk(slug) {
  const { db, doc, getDoc } = await readyPublicTourStatsFirestore();
  const snap = await getDoc(doc(db, 'public_tour_stats', slug));
  if (!snap.exists()) return null;
  return normalizePublicTourStatsDoc(slug, { id: snap.id, ...snap.data() });
}

/**
 * Tour picker docs only. `_index` and `_year_YYYY` are not tours (#1141).
 *
 * @param {unknown} id
 * @returns {boolean}
 */
export function isPublicTourPickerDocId(id) {
  const docId = String(id ?? '').trim();
  return Boolean(docId) && !docId.startsWith('_');
}

/**
 * Fallback if `_index` is missing: list non-index docs (bounded).
 * @returns {Promise<PublicTourIndexEntry[]>}
 */
export async function listPublicTourStatsDocs() {
  const { db, collection, getDocs, query, where } =
    await readyPublicTourStatsFirestore();
  // Accept both payload schema generations: 1 (pre-enrichment) and 2
  // (#666 phish.net enrichment). A hard `== 1` here silently emptied the
  // fallback once the refresh started writing schemaVersion 2.
  const q = query(
    collection(db, 'public_tour_stats'),
    where('schemaVersion', 'in', [1, 2]),
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => isPublicTourPickerDocId(d.id))
    .map((d) => {
      const data = d.data() || {};
      return {
        tourSlug: d.id,
        tourLabel: typeof data.tourLabel === 'string' ? data.tourLabel : d.id,
        lastShowDate: data.lastShowDate ?? null,
        firstShowDate: data.firstShowDate ?? null,
        showCount: data.tourShowCount ?? data.showCount ?? null,
      };
    });
}
