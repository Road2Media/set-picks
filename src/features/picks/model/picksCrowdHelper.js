import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { resolveCatalogSongTitle } from '../../../shared/lib/resolveCatalogSongTitle';

import { resolvePickerOddsLabel } from './selectScorecardOdds';

/** @typedef {'chalk' | 'consensus'} PicksHelperMode */

export const PICKS_CROWD_HELPER_EYEBROW = 'Crowd helper';
export const PICKS_CROWD_CHALK_TITLE = 'Tour chalk';
export const PICKS_CROWD_LEAN_TITLE = 'Crowd lean';
export const PICKS_CROWD_STATS_LINK = 'Full crowd stats';
export const PICKS_CROWD_CHALK_HINT =
  "Songs the room locked most often on earlier nights of this tour. Tonight's picks stay private until showtime. Use fills an open slot and does not save until you lock picks. Odds are the play guess from recent shows, not tonight's room.";
export const PICKS_CROWD_LEAN_HINT =
  'Songs on at least 25% of cards, or on at least 3 cards, plus the favorite in each slot. A long gap is how many shows since that song was played. This opens after picks lock.';
export const PICKS_CROWD_CHALK_EMPTY =
  'Tour chalk shows up after earlier nights on this tour have locked picks.';
export const PICKS_CROWD_CHALK_NO_PICKS =
  'No submitted picks on earlier nights of this tour yet.';
export const PICKS_CROWD_CHALK_QUIET =
  'No song has been on two cards yet this tour.';
export const PICKS_CROWD_LEAN_EMPTY = 'No submitted picks for this show yet.';
export const PICKS_CROWD_LEAN_QUIET =
  'No song is on a quarter of the cards, or on 3 cards, yet.';
export const PICKS_CROWD_LOAD_ERROR =
  "Crowd helper didn't load. Your card still works.";
export const PICKS_CROWD_SECTION_CONSENSUS = 'Consensus';
export const PICKS_CROWD_SECTION_SLOTS = 'Slot favorites';
export const PICKS_CROWD_SECTION_GAPS = 'Highest gaps';

const COPY = [
  PICKS_CROWD_HELPER_EYEBROW,
  PICKS_CROWD_CHALK_TITLE,
  PICKS_CROWD_LEAN_TITLE,
  PICKS_CROWD_STATS_LINK,
  PICKS_CROWD_CHALK_HINT,
  PICKS_CROWD_LEAN_HINT,
  PICKS_CROWD_CHALK_EMPTY,
  PICKS_CROWD_CHALK_NO_PICKS,
  PICKS_CROWD_CHALK_QUIET,
  PICKS_CROWD_LEAN_EMPTY,
  PICKS_CROWD_LEAN_QUIET,
  PICKS_CROWD_LOAD_ERROR,
  PICKS_CROWD_SECTION_CONSENSUS,
  PICKS_CROWD_SECTION_SLOTS,
  PICKS_CROWD_SECTION_GAPS,
];

/**
 * Player-facing helper strings. Exact pick positions say slot, never chair.
 * @returns {string[]}
 */
export function picksCrowdHelperCopy() {
  return COPY;
}

/**
 * Live crowd names stay off this helper until showtime.
 * NEXT and FUTURE stay on historical tour chalk, including an admin lock
 * that is still before showtime. LIVE and PAST show tonight’s consensus.
 *
 * @param {string | null | undefined} showStatus
 * @returns {PicksHelperMode}
 */
export function resolvePicksHelperMode(showStatus) {
  if (showStatus === 'LIVE' || showStatus === 'PAST') return 'consensus';
  return 'chalk';
}

/**
 * @param {Record<string, string> | null | undefined} formData
 * @param {string} title
 * @returns {{ state: 'invalid' | 'on_card' | 'card_full' | 'open', slotId: string | null }}
 */
export function findOpenSlotForTitle(formData, title) {
  const key = String(title || '').trim().toLowerCase();
  if (!key) return { state: 'invalid', slotId: null };
  const onCard = FORM_FIELDS.some(
    (field) => String(formData?.[field.id] || '').trim().toLowerCase() === key
  );
  if (onCard) return { state: 'on_card', slotId: null };
  const empty = FORM_FIELDS.find(
    (field) => !String(formData?.[field.id] || '').trim()
  );
  if (!empty) return { state: 'card_full', slotId: null };
  return { state: 'open', slotId: empty.id };
}

/**
 * @param {{ nights?: number, cardCount?: number }} song
 * @returns {string}
 */
export function tourChalkMeta(song) {
  const nights = typeof song?.nights === 'number' ? song.nights : 0;
  const cards = typeof song?.cardCount === 'number' ? song.cardCount : 0;
  if (nights > 1) return `${nights} nights`;
  if (cards === 1) return '1 card';
  return `${cards} cards`;
}

/**
 * Keep chalk titles the catalog will accept on save. Drops anything else.
 *
 * @param {Array<{ title?: string, nights?: number, cardCount?: number }> | null | undefined} songs
 * @param {Array<string | { name?: string }> | null | undefined} catalogSongs
 */
export function catalogChalkSongs(songs, catalogSongs) {
  if (!Array.isArray(songs) || !Array.isArray(catalogSongs)) return [];
  /** @type {Array<{ title: string, nights: number, cardCount: number }>} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const song of songs) {
    const canonical = resolveCatalogSongTitle(song?.title, catalogSongs);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: canonical,
      nights: typeof song?.nights === 'number' ? song.nights : 0,
      cardCount: typeof song?.cardCount === 'number' ? song.cardCount : 0,
    });
  }
  return out;
}

/**
 * Model odds for a chalk chip when the prediction artifact matches this night.
 * Omits the unknown floor so a missing title does not read as crowd share.
 *
 * @param {object | null | undefined} artifact
 * @param {string | null | undefined} selectedDate
 * @param {string} title
 * @returns {string | null}
 */
export function tourChalkOddsLabel(artifact, selectedDate, title) {
  const resolved = resolvePickerOddsLabel(artifact, selectedDate, title);
  if (!resolved?.label || resolved.label.startsWith('<')) return null;
  return `Odds ${resolved.label}`;
}

/**
 * @param {string} showDate
 * @returns {string}
 */
export function crowdStatsHref(showDate) {
  const date = typeof showDate === 'string' ? showDate.trim() : '';
  if (!date) return '/dashboard/stats/night';
  return `/dashboard/stats/night?showDate=${encodeURIComponent(date)}`;
}
