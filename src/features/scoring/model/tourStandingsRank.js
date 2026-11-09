/**
 * Official place on tour and year boards (#1218).
 *
 * Full tie-break: points, then exact slots, then correct picks, then nightly
 * wins, then handle. The helper also supports shared ranks and a
 * display-order breaker. Those policies are not the live rule.
 */

import { LIVE_RANK_POLICY, rankScoredRows } from './pointsTieRanking';

/**
 * @param {Array<Record<string, unknown>> | null | undefined} rows
 * @param {{ policy?: string, surface?: 'show' | 'tour' | 'year' }} [options]
 * @returns {Array<Record<string, unknown> & { rank: number, tiedCount: number, tiedHandles: string[] }>}
 */
export function assignTourDisplayRanks(rows, options = {}) {
  const ranked = rankScoredRows(rows, {
    policy: options.policy || LIVE_RANK_POLICY,
    surface: options.surface || 'tour',
  });
  return ranked.rows;
}

/**
 * Badge for one standings row. The number is the official rank.
 * A tie is marked only when the cascade did not separate those rows.
 *
 * @param {{ rank?: number, tiedCount?: number } | null | undefined} row
 * @returns {{ text: string, tied: boolean, ariaLabel: string } | null}
 */
export function tourStandingsBadge(row) {
  const rank = Number(row?.rank);
  if (!Number.isFinite(rank) || rank < 1) return null;
  const tied = Number(row?.tiedCount) > 1;
  return {
    text: String(rank),
    tied,
    ariaLabel: tied ? `Tied for rank ${rank}` : `Rank ${rank}`,
  };
}
