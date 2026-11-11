import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { hasNonEmptyPicksObject } from '../../../shared/utils/showAggregation';

/** A song is consensus at this share of submitted cards, or at the card floor. */
export const CONSENSUS_MIN_PCT = 25;
export const CONSENSUS_MIN_CARDS = 3;

/**
 * Scored show slots. Wildcard is a pick slot and stays out of the
 * crowd-vs-show comparison — it is not an official setlist slot.
 */
export const OFFICIAL_CROWD_SLOT_IDS = Object.freeze([
  's1o',
  's1c',
  's2o',
  's2c',
  'enc',
]);

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeTitle(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

/**
 * Songs on ≥25% of cards or on ≥3 cards (Phase B consensus strip).
 *
 * @param {Array<{ title?: string, cardCount?: number, pctOfPickers?: number }> | null | undefined} songs
 */
export function selectConsensusSongs(songs) {
  return (Array.isArray(songs) ? songs : []).filter((row) => {
    const cards = typeof row?.cardCount === 'number' ? row.cardCount : 0;
    const pct = typeof row?.pctOfPickers === 'number' ? row.pctOfPickers : 0;
    return cards >= CONSENSUS_MIN_CARDS || pct >= CONSENSUS_MIN_PCT;
  });
}

/**
 * Favorite title in each pick slot (including wildcard).
 * Ties break on title so the row does not shuffle.
 *
 * @param {Array<Record<string, unknown>> | null | undefined} pickDocs
 * @param {number} [pickers] submitted-card denominator; falls back to filtered docs
 */
export function aggregateBySlotFavorites(pickDocs, pickers) {
  const submitted = (Array.isArray(pickDocs) ? pickDocs : []).filter((doc) =>
    hasNonEmptyPicksObject(doc?.picks)
  );
  const denom =
    typeof pickers === 'number' && pickers > 0
      ? pickers
      : submitted.length > 0
        ? submitted.length
        : 1;

  return FORM_FIELDS.map((field) => {
    /** @type {Map<string, { title: string, count: number }>} */
    const byKey = new Map();
    for (const doc of submitted) {
      const slots =
        doc.picks && typeof doc.picks === 'object' && !Array.isArray(doc.picks)
          ? doc.picks
          : {};
      const title = normalizeTitle(slots[field.id]);
      if (!title) continue;
      const key = title.toLowerCase();
      let row = byKey.get(key);
      if (!row) {
        row = { title, count: 0 };
        byKey.set(key, row);
      }
      row.count += 1;
    }
    const ranked = [...byKey.values()].sort(
      (a, b) => b.count - a.count || a.title.localeCompare(b.title)
    );
    const top = ranked[0] || null;
    return {
      slotId: field.id,
      label: field.label,
      title: top ? top.title : null,
      count: top ? top.count : 0,
      pctOfPickers: top ? Math.round((1000 * top.count) / denom) / 10 : 0,
    };
  });
}

/**
 * Crowd favorite vs the official song in that slot.
 * Misses do not include the official title — this is not a setlist.
 *
 * @param {Array<{ slotId: string, label: string, title: string | null }>} slotFavorites
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 */
export function compareCrowdSlotHits(slotFavorites, actualSetlist) {
  const byId = new Map(
    (Array.isArray(slotFavorites) ? slotFavorites : []).map((row) => [
      row.slotId,
      row,
    ])
  );
  const setlist =
    actualSetlist && typeof actualSetlist === 'object' ? actualSetlist : null;

  /** @type {Array<{ slotId: string, label: string, crowdTitle: string, hit: boolean }>} */
  const rows = [];
  let pending = 0;

  for (const slotId of OFFICIAL_CROWD_SLOT_IDS) {
    const fav = byId.get(slotId);
    const label = typeof fav?.label === 'string' ? fav.label : slotId;
    const official =
      setlist && typeof setlist[slotId] === 'string' ? setlist[slotId].trim() : '';
    if (!official) {
      pending += 1;
      continue;
    }
    const crowdTitle = normalizeTitle(fav?.title);
    rows.push({
      slotId,
      label,
      crowdTitle,
      hit: Boolean(crowdTitle) && crowdTitle.toLowerCase() === official.toLowerCase(),
    });
  }

  const hits = rows.filter((row) => row.hit).length;
  const compared = rows.length;
  const hitPct =
    compared > 0 ? Math.round((1000 * hits) / compared) / 10 : 0;

  return { hits, compared, pending, hitPct, rows };
}

/**
 * One-line surprise framing. Does not name songs the room missed.
 *
 * @param {{ hits?: number, compared?: number }} slotHit
 * @returns {string}
 */
export function crowdSlotSurpriseCopy(slotHit) {
  const hits = typeof slotHit?.hits === 'number' ? slotHit.hits : 0;
  const compared = typeof slotHit?.compared === 'number' ? slotHit.compared : 0;
  if (compared <= 0) return '';
  if (hits === 0) {
    return "None of the room's favorite slot calls matched. The band went another way.";
  }
  const matched = `The room's favorite slot calls matched ${hits} of ${compared}.`;
  if (hits * 2 < compared) return `${matched} Mostly a surprise.`;
  return matched;
}

/**
 * @param {{
 *   songs?: Array<{ title?: string, cardCount?: number, pctOfPickers?: number }>,
 *   pickers?: number,
 *   submittedDocs?: Array<Record<string, unknown>>,
 *   actualSetlist?: Record<string, unknown> | null,
 * }} input
 */
export function buildCrowdNightDeepDive(input = {}) {
  const pickers = typeof input.pickers === 'number' ? input.pickers : 0;
  const consensus = selectConsensusSongs(input.songs);
  const bySlot = aggregateBySlotFavorites(input.submittedDocs, pickers);
  const slotHit = compareCrowdSlotHits(bySlot, input.actualSetlist);
  return { consensus, bySlot, slotHit };
}
