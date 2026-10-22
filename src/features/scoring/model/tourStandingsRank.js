/**
 * Official tour rank for the tour standings board (#1135).
 *
 * Competition rank on total points. Same points share a rank. The next rank
 * skips. Nightly wins, then handle, only order names inside a tie — they do
 * not award a sole place. Shows played do not order a tie.
 *
 * The input is already in that list order (`aggregateTourStandings`). This
 * function does not re-sort. Mirrors `assignDisplayRanks` in
 * `functions/tourRankingsDailyCore.js`.
 */

/**
 * @param {Array<{ uid?: string, handle?: string, totalPoints?: number }>} sortedRows
 * @returns {Array<Record<string, unknown> & { rank: number, tiedCount: number, tiedHandles: string[] }>}
 */
export function assignTourDisplayRanks(sortedRows) {
  const rows = Array.isArray(sortedRows) ? sortedRows : [];
  /** @type {Map<number, Array<{ index: number, handle: string }>>} */
  const groupByRank = new Map();
  /** @type {number[]} */
  const ranks = [];
  let rank = 0;
  let prevPoints = null;

  for (let i = 0; i < rows.length; i++) {
    const points = rows[i].totalPoints;
    if (prevPoints === null || points < prevPoints) {
      rank = i + 1;
      prevPoints = points;
    }
    ranks.push(rank);
    const group = groupByRank.get(rank) || [];
    const handle =
      typeof rows[i].handle === 'string' && rows[i].handle.trim()
        ? rows[i].handle.trim()
        : 'Anonymous';
    group.push({ index: i, handle });
    groupByRank.set(rank, group);
  }

  return rows.map((row, i) => {
    const place = ranks[i];
    const group = groupByRank.get(place) || [];
    return {
      ...row,
      rank: place,
      tiedCount: group.length,
      tiedHandles: group.filter((member) => member.index !== i).map((member) => member.handle),
    };
  });
}

/**
 * Badge for one tour-standings row. The number is the official rank.
 * A tie is marked in the label; the row index is not a rank.
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
