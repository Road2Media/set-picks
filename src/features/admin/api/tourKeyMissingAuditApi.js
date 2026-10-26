import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';

const ROLLUP_AUDIT_COLLECTION = 'rollup_audit';
const TOUR_KEY_MISSING_LIMIT = 50;
const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Show dates whose latest rollup could not resolve a tour key (#298).
 * Query already filters `tourKeyMissing == true`; this also accepts the
 * document id when the stored `showDate` is missing.
 *
 * @param {Array<{ id?: string, data?: () => unknown }>} docs
 * @returns {string[]}
 */
export function tourKeyMissingShowsFromDocs(docs) {
  /** @type {string[]} */
  const dates = [];
  for (const docSnap of docs || []) {
    const raw = typeof docSnap?.data === 'function' ? docSnap.data() : null;
    const data = raw && typeof raw === 'object' ? raw : {};
    if (data.tourKeyMissing !== true) continue;
    const fromField = typeof data.showDate === 'string' ? data.showDate.trim() : '';
    const fromId = typeof docSnap.id === 'string' ? docSnap.id.trim() : '';
    const showDate = SHOW_DATE_RE.test(fromField) ? fromField : fromId;
    if (!SHOW_DATE_RE.test(showDate)) continue;
    dates.push(showDate);
  }
  return [...new Set(dates)].sort();
}

/**
 * Admin-only listener. Firestore rules allow `rollup_audit` reads for admins.
 *
 * @param {(shows: string[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void}
 */
export function subscribeTourKeyMissingAudits(onChange, onError) {
  const missingQuery = query(
    collection(db, ROLLUP_AUDIT_COLLECTION),
    where('tourKeyMissing', '==', true),
    limit(TOUR_KEY_MISSING_LIMIT),
  );
  return onSnapshot(
    missingQuery,
    (snap) => {
      try {
        onChange(tourKeyMissingShowsFromDocs(snap?.docs));
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Could not read rollup audit.');
        onError?.(err);
      }
    },
    (error) => {
      const err = error instanceof Error ? error : new Error('Could not read rollup audit.');
      onError?.(err);
    },
  );
}
