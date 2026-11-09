import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { attachScoringShowDate, getSlotScoreBreakdown } from '../../../shared/utils/scoring';

/** Default top-N for the Profile frequency strip (#553). */
export const PROFILE_TOP_PICKS_N = 10;

/**
 * @typedef {{
 *   title: string,
 *   pickedCount: number,
 *   correctCount: number,
 *   exactSlotHits: number,
 *   wildcardHits: number,
 *   bustoutBoosts: number,
 * }} PickSongStatRow
 */

/**
 * Aggregate graded pick docs into per-song frequency stats.
 *
 * @param {Array<{
 *   picks?: Record<string, unknown>,
 *   showDate?: string,
 * }>} gradedPicks
 * @param {Map<string, Record<string, unknown>> | Record<string, Record<string, unknown>> | null | undefined} setlistsByDate
 * @param {{ topN?: number }} [options]
 * @returns {{
 *   rows: PickSongStatRow[],
 *   songTitles: string[],
 *   showsAggregated: number,
 * }}
 */
export function aggregatePickSongStats(gradedPicks, setlistsByDate, options = {}) {
  const topN =
    typeof options.topN === 'number' && options.topN > 0
      ? Math.trunc(options.topN)
      : PROFILE_TOP_PICKS_N;

  const lookup =
    setlistsByDate instanceof Map
      ? (d) => setlistsByDate.get(d)
      : setlistsByDate && typeof setlistsByDate === 'object'
        ? (d) => setlistsByDate[d]
        : () => undefined;

  /** @type {Map<string, PickSongStatRow>} */
  const byKey = new Map();

  const list = Array.isArray(gradedPicks) ? gradedPicks : [];
  for (const pick of list) {
    const slots = pick?.picks && typeof pick.picks === 'object' ? pick.picks : {};
    const showDate = typeof pick?.showDate === 'string' ? pick.showDate : '';
    const actual = showDate ? lookup(showDate) : undefined;

    for (const field of FORM_FIELDS) {
      const raw = slots[field.id];
      if (typeof raw !== 'string') continue;
      const title = raw.trim();
      if (!title) continue;
      const key = title.toLowerCase();
      let row = byKey.get(key);
      if (!row) {
        row = {
          title,
          pickedCount: 0,
          correctCount: 0,
          exactSlotHits: 0,
          wildcardHits: 0,
          bustoutBoosts: 0,
        };
        byKey.set(key, row);
      }
      row.pickedCount += 1;

      if (!actual) continue;
      const breakdown = getSlotScoreBreakdown(
        field.id,
        title,
        attachScoringShowDate(actual, showDate),
      );
      if (breakdown.points > 0) {
        row.correctCount += 1;
      }
      if (
        breakdown.kind === 'exact_slot' ||
        breakdown.kind === 'encore_exact'
      ) {
        row.exactSlotHits += 1;
      }
      if (breakdown.kind === 'wildcard_hit') {
        row.wildcardHits += 1;
      }
      if (breakdown.bustoutBoost) {
        row.bustoutBoosts += 1;
      }
    }
  }

  const rows = [...byKey.values()].sort((a, b) => {
    if (b.pickedCount !== a.pickedCount) return b.pickedCount - a.pickedCount;
    return a.title.localeCompare(b.title);
  });

  return {
    rows: rows.slice(0, topN),
    songTitles: rows.map((r) => r.title),
    showsAggregated: list.length,
  };
}
