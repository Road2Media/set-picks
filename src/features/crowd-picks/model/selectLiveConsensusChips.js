import {
  CONSENSUS_MIN_CARDS,
  CONSENSUS_MIN_PCT,
} from './crowdNightDeepDive';

/** Consensus songs on the picks helper after lock. */
export const LIVE_CONSENSUS_SONG_LIMIT = 6;

/** Long-gap chips on the picks helper after lock. */
export const LIVE_CONSENSUS_GAP_LIMIT = 3;

/**
 * Compact post-lock chips from the night deep dive and gap table (#694 P2).
 * Same rows the stats page already built — this does not re-aggregate.
 *
 * A slot favorite is included only when that title meets the consensus floor
 * (at least 25% of cards, or at least 3 cards).
 *
 * @param {{
 *   consensus?: Array<{ title?: string, cardCount?: number, pctOfPickers?: number }>,
 *   bySlot?: Array<{ slotId?: string, label?: string, title?: string | null, count?: number, pctOfPickers?: number }>,
 * } | null | undefined} deepDive
 * @param {Array<{ title?: string, gap?: number | null, cardCount?: number }> | null | undefined} highestGap
 * @param {{ songLimit?: number, gapLimit?: number }} [options]
 */
export function selectLiveConsensusChips(deepDive, highestGap, options = {}) {
  const songLimit =
    typeof options.songLimit === 'number' && options.songLimit > 0
      ? Math.trunc(options.songLimit)
      : LIVE_CONSENSUS_SONG_LIMIT;
  const gapLimit =
    typeof options.gapLimit === 'number' && options.gapLimit > 0
      ? Math.trunc(options.gapLimit)
      : LIVE_CONSENSUS_GAP_LIMIT;

  const songs = (Array.isArray(deepDive?.consensus) ? deepDive.consensus : [])
    .filter((row) => typeof row?.title === 'string' && row.title.trim())
    .slice(0, songLimit)
    .map((row) => ({
      title: row.title.trim(),
      cardCount: typeof row.cardCount === 'number' ? row.cardCount : 0,
      pctOfPickers: typeof row.pctOfPickers === 'number' ? row.pctOfPickers : 0,
    }));

  const slots = (Array.isArray(deepDive?.bySlot) ? deepDive.bySlot : [])
    .filter((row) => {
      if (typeof row?.title !== 'string' || !row.title.trim()) return false;
      const count = typeof row.count === 'number' ? row.count : 0;
      const pct = typeof row.pctOfPickers === 'number' ? row.pctOfPickers : 0;
      return count >= CONSENSUS_MIN_CARDS || pct >= CONSENSUS_MIN_PCT;
    })
    .map((row) => ({
      slotId: typeof row.slotId === 'string' ? row.slotId : '',
      label: typeof row.label === 'string' ? row.label : '',
      title: row.title.trim(),
      count: typeof row.count === 'number' ? row.count : 0,
      pctOfPickers: typeof row.pctOfPickers === 'number' ? row.pctOfPickers : 0,
    }));

  const gaps = (Array.isArray(highestGap) ? highestGap : [])
    .filter(
      (row) =>
        typeof row?.title === 'string' &&
        row.title.trim() &&
        typeof row.gap === 'number' &&
        Number.isFinite(row.gap)
    )
    .slice(0, gapLimit)
    .map((row) => ({
      title: row.title.trim(),
      gap: row.gap,
      cardCount: typeof row.cardCount === 'number' ? row.cardCount : 0,
    }));

  return { songs, slots, gaps };
}

/**
 * @param {number | null | undefined} pct
 * @returns {string}
 */
export function formatCrowdShare(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return '';
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}
