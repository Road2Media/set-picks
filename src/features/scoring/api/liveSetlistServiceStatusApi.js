import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../../../shared/lib/firebase';
import { liveSetlistServiceStatusDocId } from '../model/liveSetlistServiceStatus';

const PUBLIC_SERVICE_STATUS_COLLECTION = 'public_service_status';

/**
 * Realtime sanitized status for one show date. Authenticated read.
 * Missing docs call back with null.
 *
 * @param {string} showDate
 * @param {(data: Record<string, unknown> | null) => void} onChange
 * @returns {() => void}
 */
export function subscribeLiveSetlistServiceStatus(showDate, onChange) {
  const ref = doc(
    db,
    PUBLIC_SERVICE_STATUS_COLLECTION,
    liveSetlistServiceStatusDocId(showDate),
  );
  return onSnapshot(
    ref,
    (snap) => {
      onChange(snap.exists() ? snap.data() || null : null);
    },
    (error) => {
      console.error('live setlist service status listener failed', error);
      onChange(null);
    },
  );
}
