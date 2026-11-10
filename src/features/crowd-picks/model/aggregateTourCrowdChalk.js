import { aggregateCrowdNightSongs } from './aggregateCrowdNightSongs';

/** How many chalk songs the picks helper shows. */
export const TOUR_CHALK_TOP_N = 8;

/**
 * Fold per-night C1 aggregates into tour chalk (#694 P2).
 *
 * Callers pass locked nights only. This function does not know lock state.
 * A title is chalk when it was on at least 2 cards across those nights — the
 * same multi-picker floor as the night card — so a one-card title stays off.
 * Rank is nights present, then total cards, then title.
 *
 * @param {Array<{ showDate?: string, pickDocs?: Array<Record<string, unknown>> }> | null | undefined} nights
 * @param {{ topN?: number }} [options]
 * @returns {{
 *   nightsCounted: number,
 *   songs: Array<{ title: string, nights: number, cardCount: number, slotFills: number }>,
 * }}
 */
export function aggregateTourCrowdChalk(nights, options = {}) {
  const topN =
    typeof options.topN === 'number' && options.topN > 0
      ? Math.trunc(options.topN)
      : TOUR_CHALK_TOP_N;

  /** @type {Map<string, { title: string, nights: number, cardCount: number, slotFills: number }>} */
  const byKey = new Map();
  /** @type {Set<string>} */
  const seenDates = new Set();
  let nightsCounted = 0;

  for (const night of Array.isArray(nights) ? nights : []) {
    const showDate = typeof night?.showDate === 'string' ? night.showDate : '';
    if (showDate) {
      if (seenDates.has(showDate)) continue;
      seenDates.add(showDate);
    }
    const stats = aggregateCrowdNightSongs(showDate, night?.pickDocs);
    if (stats.pickers <= 0) continue;
    nightsCounted += 1;
    for (const song of stats.songs) {
      const title = typeof song.title === 'string' ? song.title.trim() : '';
      if (!title) continue;
      const key = title.toLowerCase();
      let row = byKey.get(key);
      if (!row) {
        row = { title, nights: 0, cardCount: 0, slotFills: 0 };
        byKey.set(key, row);
      }
      row.nights += 1;
      row.cardCount += song.cardCount;
      row.slotFills += song.slotFills;
    }
  }

  const songs = [...byKey.values()]
    .filter((row) => row.cardCount >= 2)
    .sort(
      (a, b) =>
        b.nights - a.nights ||
        b.cardCount - a.cardCount ||
        a.title.localeCompare(b.title)
    )
    .slice(0, topN);

  return { nightsCounted, songs };
}
