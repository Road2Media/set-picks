/**
 * Public Rewind reads (#1142). Firestore REST only — no App Check, no SDK.
 * The week doc is aggregate counts. Song titles are not on it.
 */

import { fetchFirestoreRestDocument } from '../../../shared/lib/firestoreRestDecode';
import {
  REWIND_CURRENT_ID,
  REWIND_STATE_COLLECTION,
  REWIND_WEEKS_COLLECTION,
  toPublicRewindWeek,
} from '../model/rewindContract';

const FIRESTORE_PROJECT_ID = 'set-picks';

/**
 * @param {string | undefined} weekId
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchPublicRewindWeek(weekId, opts = {}) {
  let id = String(weekId || '').trim();
  if (!id) {
    const pointer = await fetchFirestoreRestDocument(
      FIRESTORE_PROJECT_ID,
      `${REWIND_STATE_COLLECTION}/${REWIND_CURRENT_ID}`,
      opts,
    );
    id = pointer && typeof pointer.weekId === 'string' ? pointer.weekId : '';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  const raw = await fetchFirestoreRestDocument(
    FIRESTORE_PROJECT_ID,
    `${REWIND_WEEKS_COLLECTION}/${id}`,
    opts,
  );
  return toPublicRewindWeek(raw);
}
