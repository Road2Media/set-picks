import { collection, getDocs, query, where } from 'firebase/firestore';

import { DEFAULT_BAND_ID } from '../../../shared/config/bands.js';
import { bandIdQueryConstraints, rowsForBand } from '../../../shared/config/bandScope.js';
import { db } from '../../../shared/lib/firebase';
import { reduceShowWinners } from '../../../shared/utils/showAggregation';

/**
 * Overall winner(s) for a single show across **all** players (not pool-scoped).
 *
 * Fetches every graded, non-empty pick for `showDate` and applies the shared
 * "global max per show, ties share, max===0 → skip" rule so the Standings
 * "winner of the night" banner (#218), Tour standings (#219), and Profile
 * `Wins` (#217) all agree.
 *
 * @param {string} showDate  YYYY-MM-DD, as stored on `picks.showDate`.
 * @returns {Promise<{
 *   max: number | null,
 *   winners: Array<{
 *     id: string,
 *     uid?: string,
 *     userId?: string,
 *     handle?: string,
 *     score: number,
 *   } & Record<string, unknown>>,
 * }>}
 *   `max === null` signals "no winner" (no eligible picks, or top score 0).
 */
export async function fetchGlobalShowWinners(showDate, bandId = DEFAULT_BAND_ID) {
  const date = showDate?.trim?.();
  if (!date) return { max: null, winners: [] };

  const snap = await getDocs(
    query(
      collection(db, 'picks'),
      where('showDate', '==', date),
      ...bandIdQueryConstraints(where, bandId),
    )
  );
  const rows = rowsForBand(
    snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    bandId,
  );
  return reduceShowWinners(rows);
}

/**
 * Convenience: just the global max score (or `null`). Used by cumulative
 * aggregators (Profile `Wins`, Tour standings `Wins`) where we only need the
 * threshold, not the winner identities.
 *
 * @param {string} showDate
 * @returns {Promise<number | null>}
 */
export async function fetchGlobalMaxScoreForShow(showDate) {
  const { max } = await fetchGlobalShowWinners(showDate);
  return max;
}
