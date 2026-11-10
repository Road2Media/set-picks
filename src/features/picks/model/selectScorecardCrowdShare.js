import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { aggregateCrowdNightSongs, formatCrowdShare } from '../../crowd-picks';

/**
 * Title key used by {@link aggregateCrowdNightSongs} (trim + lower case).
 * Scorecard looks songs up with the same key so crowd % is not a second tally.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function crowdSongKey(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

/**
 * Live crowd share for the player's songs (#1043).
 * `pctOfPickers` is the share of submitted cards that include the title
 * anywhere on the card — the same night aggregate as Standings and Make Picks.
 * It is not model `playProb`, and it is not the slot overlap count.
 *
 * @param {Array<Record<string, unknown>> | null | undefined} pickDocs
 * @param {Record<string, unknown> | null | undefined} selfPayload
 * @returns {Array<{
 *   fieldId: string,
 *   song: string,
 *   pctOfPickers: number,
 *   cardCount: number,
 *   label: string,
 * }> | null}
 */
export function selectScorecardCrowdShare(pickDocs, selfPayload) {
  const night = aggregateCrowdNightSongs('', pickDocs);
  if (!night.pickers) return null;

  /** @type {Map<string, { pctOfPickers: number, cardCount: number }>} */
  const byKey = new Map();
  for (const row of night.songs) {
    const key = crowdSongKey(row.title);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, {
      pctOfPickers: row.pctOfPickers,
      cardCount: row.cardCount,
    });
  }

  /** @type {Array<{ fieldId: string, song: string, pctOfPickers: number, cardCount: number, label: string }>} */
  const rows = [];
  for (const field of FORM_FIELDS) {
    const song = String(selfPayload?.[field.id] ?? '').trim();
    const hit = byKey.get(crowdSongKey(song));
    if (!song || !hit) continue;
    const label = formatCrowdShare(hit.pctOfPickers);
    if (!label) continue;
    rows.push({
      fieldId: field.id,
      song,
      pctOfPickers: hit.pctOfPickers,
      cardCount: hit.cardCount,
      label,
    });
  }

  return rows.length ? rows : null;
}
