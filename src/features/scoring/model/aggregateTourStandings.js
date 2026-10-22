import {
  pickCountsTowardSeason,
  reduceShowWinners,
} from '../../../shared/utils/showAggregation';
import { assignTourDisplayRanks } from './tourStandingsRank';

/**
 * Reduce a list of `{ date, picks: PickLike[] }` into a sorted tour
 * leaderboard. The exported pure function powers `useTourStandings` and any
 * non-React caller that needs the same math (future pool-tour aggregation
 * can reuse this, layering a member-set filter on top).
 *
 * Rules (shared with Profile `Wins` and Standings #218):
 *   - Points: sum of `score` across every graded, non-empty pick the user
 *     submitted for a show in the tour.
 *   - Shows: count of graded non-empty picks the user submitted in the tour.
 *   - Wins: one per show where they tied/beat the global max (across every
 *     graded, non-empty pick for that show). Ties share. `max === 0 → skip`.
 *
 * Sort: `totalPoints` desc, then `wins` desc, then `handle` asc. That order
 * only sequences names inside a points tie. It does not award a sole place.
 * Shows played do not order a tie. Official place is competition rank on
 * points (`assignTourDisplayRanks`, #1135). Issue #73 §3.5's timestamp
 * tie-break never landed; handle order is the shipped list order.
 *
 * @typedef {{
 *   uid: string,
 *   handle: string,
 *   totalPoints: number,
 *   wins: number,
 *   shows: number,
 *   rank: number,
 *   tiedCount: number,
 *   tiedHandles: string[],
 * }} TourStandingsRow
 *
 * @param {Array<{ date: string, picks: Array<Record<string, unknown>> }>} picksByDate
 * @returns {TourStandingsRow[]}
 */
export function aggregateTourStandings(picksByDate) {
  /** @type {Map<string, TourStandingsRow>} */
  const perUser = new Map();

  for (const entry of picksByDate || []) {
    const picks = Array.isArray(entry?.picks) ? entry.picks : [];
    const { max, winners } = reduceShowWinners(picks);
    const winnerUids = new Set(
      winners.map((w) => String(w.userId || w.uid || '')).filter(Boolean)
    );

    for (const row of picks) {
      if (!pickCountsTowardSeason(row)) continue;
      const uid = String(row.userId || row.uid || '').trim();
      if (!uid) continue;

      const prev = perUser.get(uid);
      const score = typeof row.score === 'number' ? row.score : 0;
      const handle =
        typeof row.handle === 'string' && row.handle.trim()
          ? row.handle.trim()
          : prev?.handle || 'Anonymous';

      const next = prev || {
        uid,
        handle,
        totalPoints: 0,
        wins: 0,
        shows: 0,
      };
      next.handle = handle;
      next.totalPoints += score;
      next.shows += 1;
      if (max != null && winnerUids.has(uid)) next.wins += 1;
      perUser.set(uid, next);
    }
  }

  const sorted = [...perUser.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.handle.localeCompare(b.handle);
  });
  return assignTourDisplayRanks(sorted);
}
