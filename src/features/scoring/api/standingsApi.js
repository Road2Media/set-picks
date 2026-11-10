import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

import { DEFAULT_BAND_ID } from '../../../shared/config/bands.js';
import {
  bandIdQueryConstraints,
  docBelongsToBand,
  rowsForBand,
} from '../../../shared/config/bandScope.js';
import { db } from '../../../shared/lib/firebase';
import {
  sanitizeBustouts,
  sanitizeOfficialSongList,
  sanitizeSongGaps,
} from '../../../shared/utils/officialSetlistSanitize.js';
import { normalizeShowDate } from '../../../shared/utils/scoring.js';

/**
 * Normalizes `official_setlists/{showDate}` document data for scoring UIs.
 * Shared by one-shot reads and realtime snapshots (#311).
 *
 * @param {Record<string, unknown> | undefined} data
 * @param {unknown} [showDate] Document id (`official_setlists/{showDate}`).
 * @returns {null | { officialSetlist: unknown[] } & Record<string, unknown>}
 */
export function normalizeOfficialSetlistDocData(data, showDate) {
  if (!data || typeof data !== 'object') return null;

  const rawEnc = data.encoreSongs;
  const encoreSongs =
    Array.isArray(rawEnc) && rawEnc.length > 0
      ? sanitizeOfficialSongList(rawEnc)
      : [];
  const bustouts = sanitizeBustouts(data.bustouts);
  const songGaps = sanitizeSongGaps(data.songGaps);
  const date = normalizeShowDate(showDate);
  return {
    ...(data.setlist || {}),
    officialSetlist: Array.isArray(data.officialSetlist) ? data.officialSetlist : [],
    ...(encoreSongs.length > 0 ? { encoreSongs } : {}),
    bustouts,
    ...(Object.keys(songGaps).length > 0 ? { songGaps } : {}),
    ...(date ? { showDate: date } : {}),
  };
}

/**
 * @param {string} showDate
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function fetchPicksForShowDate(showDate, bandId = DEFAULT_BAND_ID) {
  if (!showDate) return [];

  const picksQuery = query(
    collection(db, 'picks'),
    where('showDate', '==', showDate),
    ...bandIdQueryConstraints(where, bandId),
  );
  const snapshot = await getDocs(picksQuery);

  return rowsForBand(
    snapshot.docs.map((pickDoc) => ({
      id: pickDoc.id,
      ...pickDoc.data(),
    })),
    bandId,
  );
}

/**
 * @param {string} showDate
 * @returns {Promise<null | { officialSetlist: unknown[] } & Record<string, unknown>>}
 */
export async function fetchOfficialSetlistForShow(showDate, bandId = DEFAULT_BAND_ID) {
  if (!showDate) return null;

  const setlistRef = doc(db, 'official_setlists', showDate);
  const setlistSnap = await getDoc(setlistRef);

  if (!setlistSnap.exists()) return null;
  const data = setlistSnap.data();
  if (!docBelongsToBand(data, bandId)) return null;

  return normalizeOfficialSetlistDocData(data, showDate);
}

/**
 * LIVE standings: subscribe to all picks for a show (same query as fetch).
 *
 * @param {string} showDate
 * @param {(picks: Array<{ id: string } & Record<string, unknown>>) => void} onNext
 * @param {(err: Error) => void} onError
 * @returns {() => void}
 */
export function subscribePicksForShowDate(showDate, onNext, onError, bandId = DEFAULT_BAND_ID) {
  if (!showDate) {
    return () => {};
  }
  const picksQuery = query(
    collection(db, 'picks'),
    where('showDate', '==', showDate),
    ...bandIdQueryConstraints(where, bandId),
  );
  return onSnapshot(
    picksQuery,
    (snapshot) => {
      onNext(
        rowsForBand(
          snapshot.docs.map((pickDoc) => ({
            id: pickDoc.id,
            ...pickDoc.data(),
          })),
          bandId,
        )
      );
    },
    onError
  );
}

/**
 * LIVE standings: subscribe to official setlist doc for a show.
 *
 * @param {string} showDate
 * @param {(setlist: null | ReturnType<typeof normalizeOfficialSetlistDocData>) => void} onNext
 * @param {(err: Error) => void} onError
 * @returns {() => void}
 */
export function subscribeOfficialSetlistForShow(
  showDate,
  onNext,
  onError,
  bandId = DEFAULT_BAND_ID,
) {
  if (!showDate) {
    return () => {};
  }
  const setlistRef = doc(db, 'official_setlists', showDate);
  return onSnapshot(
    setlistRef,
    (snap) => {
      if (!snap.exists()) onNext(null);
      else if (!docBelongsToBand(snap.data(), bandId)) onNext(null);
      else onNext(normalizeOfficialSetlistDocData(snap.data(), showDate));
    },
    onError
  );
}
