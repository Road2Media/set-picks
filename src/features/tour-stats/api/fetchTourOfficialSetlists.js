import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../../shared/lib/firebase';
import { whenFirebaseReady } from '../../../shared/lib/firebaseAppCheck';
import { normalizeOfficialSetlistDocData } from '../../scoring';

/** Concurrent point-read chunk size (mirrors profile heatmap / tour standings). */
export const TOUR_SETLIST_READ_CHUNK = 8;

/**
 * @param {string[]} showDates
 * @param {{ chunkSize?: number }} [options]
 * @returns {Promise<{
 *   docs: Array<{ showDate: string, setlist: ReturnType<typeof normalizeOfficialSetlistDocData> }>,
 *   setlistReads: number,
 *   missingDates: string[],
 * }>}
 */
export async function fetchTourOfficialSetlists(showDates, options = {}) {
  const dates = Array.isArray(showDates)
    ? [...new Set(showDates.map((d) => String(d ?? '').trim()).filter(Boolean))].sort()
    : [];
  const chunkSize =
    typeof options.chunkSize === 'number' && options.chunkSize > 0
      ? Math.trunc(options.chunkSize)
      : TOUR_SETLIST_READ_CHUNK;

  await whenFirebaseReady();

  /** @type {Array<{ showDate: string, setlist: ReturnType<typeof normalizeOfficialSetlistDocData> }>} */
  const docs = [];
  /** @type {string[]} */
  const missingDates = [];
  let setlistReads = 0;

  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    const snaps = await Promise.all(
      chunk.map((showDate) => getDoc(doc(db, 'official_setlists', showDate))),
    );
    setlistReads += chunk.length;
    for (let j = 0; j < chunk.length; j += 1) {
      const showDate = chunk[j];
      const snap = snaps[j];
      if (!snap.exists()) {
        missingDates.push(showDate);
        docs.push({ showDate, setlist: null });
        continue;
      }
      docs.push({
        showDate,
        setlist: normalizeOfficialSetlistDocData(snap.data(), showDate),
      });
    }
  }

  return { docs, setlistReads, missingDates };
}
