import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import {
  sanitizeBustouts,
  sanitizeOfficialSongList,
  sanitizeSetlistSlots,
  sanitizeSongGaps,
} from '../../../shared/utils/officialSetlistSanitize.js';
import { reconcileOfficialSetlistSnapshot } from './reconcileOfficialSetlistSnapshot.js';

const OFFICIAL_SETLISTS_COLLECTION = 'official_setlists';

export { sanitizeBustouts, sanitizeOfficialSongList, sanitizeSetlistSlots, sanitizeSongGaps };

function encoreSongsFromOfficialDoc(data) {
  if (!data || typeof data !== 'object') return [];
  const raw = data.encoreSongs;
  if (Array.isArray(raw) && raw.length > 0) {
    return sanitizeOfficialSongList(raw);
  }
  const enc = data.setlist?.enc;
  return typeof enc === 'string' && enc.trim() ? [enc.trim()] : [];
}

export async function fetchOfficialSetlistByDate(showDate, slotFields) {
  const docRef = doc(db, OFFICIAL_SETLISTS_COLLECTION, showDate);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return {
      exists: false,
      setlist: sanitizeSetlistSlots({}, slotFields),
      officialSetlist: [],
      encoreSongs: [],
    };
  }

  const data = docSnap.data();
  return {
    exists: true,
    setlist: sanitizeSetlistSlots(data.setlist || {}, slotFields),
    officialSetlist: sanitizeOfficialSongList(data.officialSetlist),
    encoreSongs: encoreSongsFromOfficialDoc(data),
    bustouts: sanitizeBustouts(data.bustouts),
    songGaps: sanitizeSongGaps(data.songGaps),
    raw: data,
  };
}

/**
 * Persist an official setlist for a show date.
 *
 * `bustouts` is the per-show bustout snapshot (#214). Callers should derive
 * it from Phish.net row `gap` values (via the parser DTO or a live fetch) and
 * pass it explicitly. Omitting it preserves the prior snapshot on the doc so
 * a save triggered without fresh Phish.net data (e.g. pure slot edit) does
 * not erase bustouts captured earlier. Pass an empty array only when you
 * affirmatively know there are no bustouts.
 *
 * `songGaps` (#587 Phase B) follows the same explicit-wins / preserve-prior
 * policy: because this write replaces the whole doc, omitting `songGaps`
 * preserves any gap map frozen by live automation or a prior ingest.
 *
 * Both fields are then reconciled to `officialSetlist` (#626). Titles that
 * were not played are removed. A played song whose saved gap is still
 * >= 30 is written into `bustouts` even if the caller omitted it.
 */
export async function saveOfficialSetlistByDate({
  showDate,
  setlistData,
  officialSetlist,
  slotFields,
  updatedBy,
  encoreSongs: encoreSongsExplicit,
  bustouts: bustoutsExplicit,
  songGaps: songGapsExplicit,
}) {
  const cleanedSlots = sanitizeSetlistSlots(setlistData, slotFields);
  const cleanedOfficialSetlist = sanitizeOfficialSongList(officialSetlist);

  const docRef = doc(db, OFFICIAL_SETLISTS_COLLECTION, showDate);
  const snap = await getDoc(docRef);
  const prior = snap.exists() ? snap.data() : {};
  const priorList = Array.isArray(prior.encoreSongs)
    ? sanitizeOfficialSongList(prior.encoreSongs)
    : [];
  const priorBustouts = sanitizeBustouts(prior.bustouts);
  const priorSongGaps = sanitizeSongGaps(prior.songGaps);

  let encoreSongs;
  if (encoreSongsExplicit !== undefined) {
    encoreSongs = sanitizeOfficialSongList(encoreSongsExplicit);
  } else if (!cleanedSlots.enc) {
    encoreSongs = [];
  } else if (priorList.length > 0) {
    encoreSongs = priorList;
  } else {
    encoreSongs = [cleanedSlots.enc];
  }

  // Explicit bustouts/songGaps replace the prior snapshot. Omitting either
  // field keeps the prior value. Reconciliation then drops titles that are
  // not in officialSetlist and promotes played songs whose gap is still >= 30.
  const bustoutsInput =
    bustoutsExplicit !== undefined ? bustoutsExplicit : priorBustouts;
  const songGapsInput =
    songGapsExplicit !== undefined ? songGapsExplicit : priorSongGaps;
  const reconciled = reconcileOfficialSetlistSnapshot({
    playedTitles: cleanedOfficialSetlist,
    bustouts: bustoutsInput,
    songGaps: songGapsInput,
  });
  const bustouts = reconciled.bustouts;
  const songGaps = reconciled.songGaps;

  await setDoc(docRef, {
    showDate,
    status: 'COMPLETED',
    isScored: false,
    updatedAt: new Date().toISOString(),
    updatedBy,
    setlist: cleanedSlots,
    officialSetlist: cleanedOfficialSetlist,
    encoreSongs,
    bustouts,
    songGaps,
  });

  return {
    cleanedSlots,
    cleanedOfficialSetlist,
    encoreSongs,
    bustouts,
    songGaps,
  };
}
