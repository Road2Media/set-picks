import { doc, getDoc } from 'firebase/firestore';

import { DEFAULT_BAND_ID } from '../../../shared/config/bands.js';
import { docBelongsToBand } from '../../../shared/config/bandScope.js';
import { db } from '../../../shared/lib/firebase';
import { GAME_LAUNCH_SHOW_DATE } from '../../../shared/config/gameLaunch';
import { pickCountsTowardSeason } from '../../../shared/utils/showAggregation';
import { fetchGlobalMaxScoreForShow } from '../../scoring';
import {
  memberJoinedOnForUser,
  pickDataCountsForPool,
} from './poolFirestore';

/**
 * @typedef {Object} PoolStandingsRow
 * @property {number} totalScore  Sum of graded pick scores eligible for the pool.
 * @property {number} showsPlayed Graded non-empty picks eligible for the pool.
 * @property {number} wins        Shows the user won using the **global**
 *                                "winner of the night" rule — global max
 *                                across every graded, non-empty pick for
 *                                that show; ties share; `max === 0`
 *                                credits no one. Same rule as Standings
 *                                #218 / Profile #217 / Tour standings #219
 *                                so the wins column is consistent across
 *                                every surface a user sees.
 */

/**
 * @typedef {Object} PoolStandingsTelemetry
 * @property {number} memberCount   Total members the load was asked about.
 * @property {number} showsScanned  Show dates iterated (post game-launch floor).
 * @property {'all-time' | 'tour'} scope  Surface scope.
 */

/** @type {PoolStandingsRow} */
export const EMPTY_POOL_STANDINGS_ROW = Object.freeze({
  totalScore: 0,
  showsPlayed: 0,
  wins: 0,
});

const PICK_READ_CHUNK_SIZE = 24;
const WIN_FETCH_CHUNK_SIZE = 10;

/**
 * Pure aggregation step factored out of {@link loadPoolStandings} so the
 * scoring rules (points sum, shows count, global wins per night) can be
 * unit-tested without mocking Firestore.
 *
 * `picks` must already be filtered to the rows that count for this pool
 * + season (i.e. `pickDataCountsForPool(data, poolId)` and
 * `pickCountsTowardSeason(data)` returned `true`). `globalMaxByShow` is
 * the global "max score across **every** graded non-empty pick for that
 * show" — the same value `fetchGlobalMaxScoreForShow` returns. A `null`
 * (or absent) entry means nobody is credited for that night
 * (`max === 0`, hollow show). When `globalMaxByShow` is omitted, no
 * wins are credited.
 *
 * Wins rule: `pick.score === globalMaxByShow.get(showDate)` (and the
 * max is `> 0`). Ties share, identical to Standings / Profile / Tour
 * standings.
 *
 * @param {string[]} memberIds
 * @param {Array<{ userId: string, showDate: string, score: number }>} picks
 * @param {Map<string, number | null> | null | undefined} [globalMaxByShow]
 * @returns {Map<string, PoolStandingsRow>}
 */
export function aggregatePoolStandings(memberIds, picks, globalMaxByShow) {
  /** @type {Map<string, PoolStandingsRow>} */
  const totals = new Map();
  const allowed = new Set();
  for (const uid of Array.isArray(memberIds) ? memberIds : []) {
    if (!uid) continue;
    totals.set(uid, { ...EMPTY_POOL_STANDINGS_ROW });
    allowed.add(uid);
  }

  for (const p of Array.isArray(picks) ? picks : []) {
    if (!p || typeof p !== 'object') continue;
    if (!allowed.has(p.userId)) continue;
    if (typeof p.showDate !== 'string' || !p.showDate) continue;
    if (typeof p.score !== 'number') continue;
    const row = totals.get(p.userId);
    if (!row) continue;
    row.totalScore += p.score;
    row.showsPlayed += 1;
    if (globalMaxByShow instanceof Map) {
      const max = globalMaxByShow.get(p.showDate);
      if (typeof max === 'number' && max > 0 && p.score === max) {
        row.wins += 1;
      }
    }
  }

  return totals;
}

/**
 * Pool-scoped standings totals (points, shows, global-rule wins) for
 * every member across `effectiveShowDates`.
 *
 * Scoring rules:
 *   - **Inclusion gate:** `pickDataCountsForPool` (`pick.pools` snapshot,
 *     with the legacy "no snapshot → counts everywhere" fallback) +
 *     `pickCountsTowardSeason` (graded + non-empty). A pick that fails
 *     either gate contributes nothing — points, shows, and wins all
 *     reset against the per-pool inclusion check.
 *   - **Wins:** the same global "winner of the night" rule the rest of
 *     the app reports (Standings #218, Profile #217, Tour standings
 *     #219). For each show with at least one eligible pick by a pool
 *     member, we look up the global max via
 *     `fetchGlobalMaxScoreForShow` (cached) and credit a win whenever a
 *     pool member's eligible pick equals that max. This keeps the wins
 *     column consistent across every surface — the pool view used to
 *     report a pool-internal max, which produced different numbers
 *     than Standings for the same user; that divergence was confusing
 *     and is now gone.
 *
 * Read cost (cold mount, no React Query cache):
 *   - `|members| × |effectiveShowDates|` Firestore point reads on
 *     `picks/{date}_{uid}`.
 *   - `≤ |distinct shows pool members played|` calls to
 *     `fetchGlobalMaxScoreForShow` for the wins pass (cached upstream
 *     so repeated lookups across users for the same show are free).
 *
 * `effectiveShowDates` is floored to {@link GAME_LAUNCH_SHOW_DATE} as a
 * defensive cap so we never iterate pre-launch upstream tour dates.
 *
 * @param {string} poolId
 * @param {string[]} memberIds
 * @param {Array<{ date: string }>} effectiveShowDates
 * @param {{
 *   onTelemetry?: (t: PoolStandingsTelemetry) => void,
 *   scope?: 'all-time' | 'tour',
 *   standingsScope?: string | null,
 *   memberJoinedAt?: Record<string, string> | null,
 *   bandId?: string,
 * }} [options]
 * @returns {Promise<Map<string, PoolStandingsRow>>}
 */
export async function loadPoolStandings(
  poolId,
  memberIds,
  effectiveShowDates,
  options = {}
) {
  const {
    onTelemetry,
    scope = 'all-time',
    standingsScope = null,
    memberJoinedAt = null,
    bandId = DEFAULT_BAND_ID,
  } = options;

  const pid = poolId?.trim();
  const members = Array.isArray(memberIds) ? memberIds.filter(Boolean) : [];
  /** @type {Map<string, PoolStandingsRow>} */
  const totals = new Map();
  for (const uid of members) {
    totals.set(uid, { ...EMPTY_POOL_STANDINGS_ROW });
  }

  const flooredShowDates = Array.isArray(effectiveShowDates)
    ? effectiveShowDates
        .filter(
          (s) =>
            s &&
            typeof s.date === 'string' &&
            s.date >= GAME_LAUNCH_SHOW_DATE
        )
        .map((s) => s.date)
    : [];

  /** @type {PoolStandingsTelemetry} */
  const telemetry = {
    memberCount: members.length,
    showsScanned: flooredShowDates.length,
    scope,
  };
  const emit = () => {
    if (typeof onTelemetry === 'function') {
      try {
        onTelemetry(telemetry);
      } catch (err) {
        console.warn('loadPoolStandings telemetry callback failed:', err);
      }
    }
  };

  if (!pid || members.length === 0 || flooredShowDates.length === 0) {
    emit();
    return totals;
  }

  /** @type {Array<{ showDate: string, userId: string, score: number }>} */
  const eligiblePicks = [];

  /** @type {Array<{ showDate: string, userId: string }>} */
  const tasks = [];
  for (const showDate of flooredShowDates) {
    for (const userId of members) {
      tasks.push({ showDate, userId });
    }
  }

  for (let i = 0; i < tasks.length; i += PICK_READ_CHUNK_SIZE) {
    const slice = tasks.slice(i, i + PICK_READ_CHUNK_SIZE);
    const snaps = await Promise.all(
      slice.map(({ showDate, userId }) =>
        getDoc(doc(db, 'picks', `${showDate}_${userId}`))
      )
    );
    for (let j = 0; j < slice.length; j += 1) {
      const snap = snaps[j];
      const { showDate, userId } = slice[j];
      if (!snap.exists()) continue;
      const data = snap.data() || {};
      if (!docBelongsToBand(data, bandId)) continue;
      if (
        !pickDataCountsForPool(data, pid, {
          standingsScope,
          memberJoinedOn: memberJoinedOnForUser(memberJoinedAt, userId),
          showDate,
        })
      ) {
        continue;
      }
      if (!pickCountsTowardSeason(data)) continue;
      const score = typeof data.score === 'number' ? data.score : 0;
      eligiblePicks.push({ showDate, userId, score });
    }
  }

  // Wins pass: fetch the global max for every show that had at least one
  // eligible pick. `fetchGlobalMaxScoreForShow` is cached upstream so
  // requesting the same show across users is free; no need to dedupe at
  // this layer beyond the show-set we build below.
  const showsWithEligiblePicks = [
    ...new Set(eligiblePicks.map((p) => p.showDate)),
  ];
  /** @type {Map<string, number | null>} */
  const globalMaxByShow = new Map();
  for (let i = 0; i < showsWithEligiblePicks.length; i += WIN_FETCH_CHUNK_SIZE) {
    const slice = showsWithEligiblePicks.slice(i, i + WIN_FETCH_CHUNK_SIZE);
    const maxes = await Promise.all(
      slice.map((d) => fetchGlobalMaxScoreForShow(d))
    );
    for (let j = 0; j < slice.length; j += 1) {
      globalMaxByShow.set(slice[j], maxes[j]);
    }
  }

  const aggregated = aggregatePoolStandings(
    members,
    eligiblePicks,
    globalMaxByShow
  );
  for (const [uid, row] of aggregated) totals.set(uid, row);

  emit();
  return totals;
}
