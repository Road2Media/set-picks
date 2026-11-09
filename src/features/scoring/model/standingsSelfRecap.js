import { calculateTotalScore } from '../../../shared/utils/scoring';

import { getPickPayloadFromEntry, sortPicksForLeaderboard } from './useLeaderboard';

/**
 * Live leaderboard snapshot for the signed-in user (same sort + rank rules as
 * {@link LeaderboardList} / {@link LeaderboardRow}).
 *
 * @param {Array<Record<string, unknown>> | null | undefined} displayedPicks
 * @param {unknown[] | null} actualSetlist
 * @param {string | null | undefined} selfUserId
 * @returns {{
 *   handle: string,
 *   userId: string,
 *   displayRank: number | null,
 *   rankNumber: number,
 *   totalPlayers: number,
 *   totalScore: number | null,
 *   selfAnchorId: string,
 * } | null}
 */
export function computeStandingsSelfRecap(displayedPicks, actualSetlist, selfUserId) {
  if (!selfUserId || !Array.isArray(displayedPicks) || displayedPicks.length === 0) {
    return null;
  }
  const sorted = sortPicksForLeaderboard(displayedPicks, actualSetlist, selfUserId);
  const idx = sorted.findIndex((p) => (p.userId || p.uid) === selfUserId);
  if (idx < 0) return null;

  const entry = sorted[idx];
  const picksPayload = getPickPayloadFromEntry(entry);
  const ranked = Number(entry.rank);
  const rankNumber = Number.isFinite(ranked) && ranked >= 1 ? ranked : idx + 1;
  const isSelf = (entry.userId || entry.uid) === selfUserId;
  const displayRank = isSelf && !actualSetlist ? null : rankNumber;
  const totalScore = actualSetlist ? calculateTotalScore(picksPayload, actualSetlist) : null;

  return {
    handle: entry.handle || 'Anonymous',
    userId: selfUserId,
    displayRank,
    rankNumber,
    totalPlayers: sorted.length,
    totalScore,
    selfAnchorId: `standings-player-${selfUserId}`,
  };
}
