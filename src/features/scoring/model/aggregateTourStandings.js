import {
  pickCountsTowardSeason,
  reduceShowWinners,
} from '../../../shared/utils/showAggregation';
import { countCorrectPicks, countExactHits } from '../../../shared/utils/scoring';
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
 * Official place is the live full tie-break (`assignTourDisplayRanks`,
 * #1218): points, then exact slots and correct picks totaled across nights,
 * then nightly wins, then handle. Shows played do not order a tie. A nightly
 * win is still a share of that night's top score.
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
 * @param {Record<string, Record<string, unknown> | null | undefined> | Map<string, Record<string, unknown> | null | undefined> | null} [setlistsByDate]
 * @returns {TourStandingsRow[]}
 */
export function aggregateTourStandings(picksByDate, setlistsByDate = null) {
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
        exactHits: 0,
        correctPicks: 0,
      };
      const setlist = setlistForDate(setlistsByDate, entry?.date);
      const payload = row.picks && typeof row.picks === 'object' ? row.picks : null;
      const tie = nightTieStats(row, payload, setlist, entry?.date);
      next.handle = handle;
      next.totalPoints += score;
      next.shows += 1;
      next.exactHits += tie.exactHits;
      next.correctPicks += tie.correctPicks;
      if (max != null && winnerUids.has(uid)) next.wins += 1;
      perUser.set(uid, next);
    }
  }

  return assignTourDisplayRanks([...perUser.values()], { surface: 'tour' });
}

/**
 * @param {Record<string, unknown> | Map<string, unknown> | Array<Record<string, unknown>> | null | undefined} setlistsByDate
 * @param {unknown} date
 * @returns {Record<string, unknown> | null}
 */
function setlistForDate(setlistsByDate, date) {
  if (!setlistsByDate || typeof date !== 'string' || !date) return null;
  if (typeof setlistsByDate.get === 'function') {
    const hit = setlistsByDate.get(date);
    return hit && typeof hit === 'object' ? hit : null;
  }
  if (Array.isArray(setlistsByDate)) {
    const row = setlistsByDate.find((entry) => entry && entry.date === date);
    const hit = row?.setlist || row?.doc || null;
    return hit && typeof hit === 'object' ? hit : null;
  }
  const hit = setlistsByDate[date];
  return hit && typeof hit === 'object' ? hit : null;
}

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown> | null} payload
 * @param {Record<string, unknown> | null} setlist
 * @param {unknown} date
 * @returns {{ exactHits: number, correctPicks: number }}
 */
function nightTieStats(row, payload, setlist, date) {
  if (setlist && payload) {
    return {
      exactHits: countExactHits(payload, setlist),
      correctPicks: countCorrectPicks(payload, setlist, date),
    };
  }
  const exact = typeof row.exactHits === 'number' && Number.isFinite(row.exactHits) ? row.exactHits : 0;
  const stored =
    typeof row.correctPicks === 'number' && Number.isFinite(row.correctPicks)
      ? row.correctPicks
      : typeof row.correctSlots === 'number' && Number.isFinite(row.correctSlots)
        ? row.correctSlots
        : 0;
  return { exactHits: exact, correctPicks: stored };
}
