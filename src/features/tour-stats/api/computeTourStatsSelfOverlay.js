import { doc, getDoc } from 'firebase/firestore';

import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { db } from '../../../shared/lib/firebase';
import { whenFirebaseReady } from '../../../shared/lib/firebaseAppCheck';
import { attachScoringShowDate, calculateSlotScore } from '../../../shared/utils/scoring';

import { TOUR_SETLIST_READ_CHUNK } from './fetchTourOfficialSetlists';

/**
 * @param {string} showDate
 * @param {string} uid
 * @returns {string}
 */
function pickDocId(showDate, uid) {
  return `${showDate}_${uid}`;
}

/**
 * Minimal private overlay: how the signed-in user's tour picks stack up (#555).
 *
 * Read budget: up to N `picks/{showDate}_{uid}` point reads (chunked).
 *
 * @param {string} uid
 * @param {Array<{ showDate: string, setlist: Record<string, unknown> | null }>} setlistDocs
 * @param {{
 *   topSongTitles?: string[],
 *   chunkSize?: number,
 * }} [options]
 * @returns {Promise<{
 *   showsPicked: number,
 *   slotsFilled: number,
 *   slotsCorrect: number,
 *   bustoutHits: number,
 *   topSongOverlap: number,
 *   pickReads: number,
 * }>}
 */
export async function computeTourStatsSelfOverlay(uid, setlistDocs, options = {}) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  const docs = Array.isArray(setlistDocs) ? setlistDocs : [];
  const topKeys = new Set(
    (Array.isArray(options.topSongTitles) ? options.topSongTitles : [])
      .map((t) => String(t ?? '').trim().toLowerCase())
      .filter(Boolean),
  );
  const chunkSize =
    typeof options.chunkSize === 'number' && options.chunkSize > 0
      ? Math.trunc(options.chunkSize)
      : TOUR_SETLIST_READ_CHUNK;

  if (!id || docs.length === 0) {
    return {
      showsPicked: 0,
      slotsFilled: 0,
      slotsCorrect: 0,
      bustoutHits: 0,
      topSongOverlap: 0,
      pickReads: 0,
    };
  }

  await whenFirebaseReady();

  const dates = docs.map((d) => d.showDate).filter(Boolean);
  /** @type {Map<string, Record<string, unknown>>} */
  const picksByDate = new Map();
  let pickReads = 0;

  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    const snaps = await Promise.all(
      chunk.map((showDate) => getDoc(doc(db, 'picks', pickDocId(showDate, id)))),
    );
    pickReads += chunk.length;
    for (let j = 0; j < chunk.length; j += 1) {
      const snap = snaps[j];
      if (!snap.exists()) continue;
      const data = snap.data() || {};
      const picks = data.picks && typeof data.picks === 'object' ? data.picks : null;
      if (picks) picksByDate.set(chunk[j], picks);
    }
  }

  let showsPicked = 0;
  let slotsFilled = 0;
  let slotsCorrect = 0;
  let bustoutHits = 0;
  const pickedTop = new Set();

  for (const entry of docs) {
    const picks = picksByDate.get(entry.showDate);
    if (!picks) continue;
    const filled = FORM_FIELDS.some((f) => {
      const v = picks[f.id];
      return typeof v === 'string' && v.trim().length > 0;
    });
    if (!filled) continue;
    showsPicked += 1;

    const setlist = entry.setlist;
    const bustoutSet = new Set(
      Array.isArray(setlist?.bustouts)
        ? setlist.bustouts.map((t) => String(t ?? '').trim().toLowerCase()).filter(Boolean)
        : [],
    );

    for (const field of FORM_FIELDS) {
      const raw = picks[field.id];
      const title = typeof raw === 'string' ? raw.trim() : '';
      if (!title) continue;
      slotsFilled += 1;
      const key = title.toLowerCase();
      if (topKeys.has(key)) pickedTop.add(key);

      if (setlist) {
        const score = calculateSlotScore(
          field.id,
          title,
          attachScoringShowDate(setlist, entry.showDate),
        );
        if (score > 0) slotsCorrect += 1;
        if (bustoutSet.has(key) && score > 0) bustoutHits += 1;
      }
    }
  }

  return {
    showsPicked,
    slotsFilled,
    slotsCorrect,
    bustoutHits,
    topSongOverlap: pickedTop.size,
    pickReads,
  };
}
