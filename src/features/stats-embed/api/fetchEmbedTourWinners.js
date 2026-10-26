import { fetchFirestoreRestDocument } from '../../../shared/lib/firestoreRestDecode';
import { isEmbedTourSlug } from '../model/embedPaths';

const PROJECT_ID = 'set-picks';

/** Top-level fields the embed is allowed to read. No song or venue stats. */
export const EMBED_WINNER_FIELD_PATHS = Object.freeze([
  'tourSlug',
  'tourLabel',
  'tourWinners',
]);

/**
 * @param {string} slug
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchEmbedTourWinners(slug, opts = {}) {
  if (!isEmbedTourSlug(slug)) return null;
  return fetchFirestoreRestDocument(PROJECT_ID, `public_tour_stats/${slug}`, {
    signal: opts.signal,
    fieldPaths: [...EMBED_WINNER_FIELD_PATHS],
  });
}

/**
 * Current tour slug from the public index. The mask omits show counts.
 *
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchEmbedDefaultTourSlug(opts = {}) {
  const doc = await fetchFirestoreRestDocument(PROJECT_ID, 'public_tour_stats/_index', {
    signal: opts.signal,
    fieldPaths: ['defaultTourSlug'],
  });
  const slug = doc && typeof doc.defaultTourSlug === 'string' ? doc.defaultTourSlug : '';
  return isEmbedTourSlug(slug) ? slug : '';
}
