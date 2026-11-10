/**
 * Fan-facing night count for a tour song (#1285).
 * Nights the song was performed. Total times played go in parentheses
 * only when that total is higher. The footnote marker uses the same case.
 */

export const SONG_PLAY_COUNT_NOTE_ID = 'song-play-count-note';

export const SONG_PLAY_COUNT_MARKER = '*';

export const SONG_PLAY_COUNT_FOOTNOTE =
  'Songs played more than once in a show are counted toward total times played, per phish.net. Our stats count the nights a song was performed separately from the total times it was played.';

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteInt(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * @param {number} n
 * @returns {string}
 */
function formatCount(n) {
  return n.toLocaleString('en-US');
}

/**
 * Older public docs omit `showAppearances`. Those rows show the stored
 * play count as nights and do not invent a second number.
 *
 * @param {{ showAppearances?: unknown, timesPlayed?: unknown } | null | undefined} row
 * @returns {{
 *   nights: number,
 *   plays: number | null,
 *   label: string,
 *   showMarker: boolean,
 * }}
 */
export function formatSongNightCount(row) {
  const appearances = finiteInt(row?.showAppearances);
  const plays = finiteInt(row?.timesPlayed);
  const hasNights = appearances != null;
  const nights = hasNights ? appearances : plays != null ? plays : 0;
  const showMarker = hasNights && plays != null && plays > nights;
  const nightWord = nights === 1 ? 'night' : 'nights';
  const label = showMarker
    ? `${formatCount(nights)} ${nightWord} (${formatCount(plays)})`
    : `${formatCount(nights)} ${nightWord}`;
  return {
    nights,
    plays,
    label,
    showMarker,
  };
}

/**
 * @param {Array<{ showAppearances?: unknown, timesPlayed?: unknown }> | null | undefined} rows
 * @returns {boolean}
 */
export function songListNeedsPlayFootnote(rows) {
  return (Array.isArray(rows) ? rows : []).some(
    (row) => formatSongNightCount(row).showMarker,
  );
}
