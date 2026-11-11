import { DEFAULT_BAND_ID } from './bands.js';

/**
 * Collections that gain an additive `bandId` in Phase 1 (#605).
 * Document ids stay as they are. Phase 3 is the rename.
 */
export const BAND_SCOPED_COLLECTIONS = Object.freeze([
  'picks',
  'official_setlists',
  'live_setlist_automation',
  'rollup_audit',
  'pools',
]);

/**
 * Firestore `where('bandId', '==', band)` does not match documents that
 * have not been backfilled. Leave this false until
 * `node scripts/migrate-phish-to-bandid.mjs --confirm` has been verified.
 * Flip instructions: `docs/MULTI_BAND_MIGRATION.md` (Phase 1 follow-up).
 */
export const STRICT_BAND_ID_QUERIES = false;

/**
 * Copy a write payload and set `bandId`.
 * An explicit non-empty string already on the payload is kept, so a later
 * band is not overwritten when the caller passes the stored value.
 * Missing, blank, or non-string values become `fallback` (`phish`).
 *
 * @param {Record<string, unknown> | null | undefined} data
 * @param {string} [fallback]
 * @returns {Record<string, unknown>}
 */
export function stampBandId(data, fallback = DEFAULT_BAND_ID) {
  const base = data && typeof data === 'object' ? { ...data } : {};
  const existing = typeof base.bandId === 'string' ? base.bandId.trim() : '';
  base.bandId = existing || fallback;
  return base;
}

/**
 * Pre-backfill documents have no `bandId`. They still belong to the default
 * band, so Phish screens keep showing them. Any other non-empty id does not.
 *
 * @param {Record<string, unknown> | null | undefined} data
 * @param {string} [bandId]
 * @returns {boolean}
 */
export function docBelongsToBand(data, bandId = DEFAULT_BAND_ID) {
  const raw = data && typeof data.bandId === 'string' ? data.bandId.trim() : '';
  const effective = raw || DEFAULT_BAND_ID;
  return effective === bandId;
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} rows
 * @param {string} [bandId]
 */
export function rowsForBand(rows, bandId = DEFAULT_BAND_ID) {
  return (Array.isArray(rows) ? rows : []).filter((row) => docBelongsToBand(row, bandId));
}

/**
 * Extra query constraints. Empty until {@link STRICT_BAND_ID_QUERIES} is true.
 *
 * @param {(field: string, op: string, value: string) => unknown} whereFn
 * @param {string} [bandId]
 * @returns {unknown[]}
 */
export function bandIdQueryConstraints(whereFn, bandId = DEFAULT_BAND_ID) {
  if (!STRICT_BAND_ID_QUERIES) return [];
  return [whereFn('bandId', '==', bandId)];
}

/**
 * Plan one backfill write. Does not rename the document id.
 * `skip-other` leaves a non-phish value untouched.
 *
 * @param {Record<string, unknown> | null | undefined} data
 * @param {string} [bandId]
 * @returns {{ action: 'set' | 'skip-present' | 'skip-other', bandId: string }}
 */
export function planBandIdBackfill(data, bandId = DEFAULT_BAND_ID) {
  const raw = data && typeof data.bandId === 'string' ? data.bandId.trim() : '';
  if (!raw) return { action: 'set', bandId };
  if (raw === bandId) return { action: 'skip-present', bandId: raw };
  return { action: 'skip-other', bandId: raw };
}
