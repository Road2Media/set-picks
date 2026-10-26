/**
 * Aggregate-only Phish at Madison Square Garden stats (#1139).
 * Input is normalized shows (songs + bustout gaps). Output never includes
 * a night's setlist. Canceled shows and empty setlists do not count.
 */

export const MSG_GARDEN_VENUE_ID = 157;
export const MSG_GARDEN_HUNDREDTH_DATE = '2027-01-02';
export const MSG_GARDEN_SOURCE_URL =
  'https://phish.net/venue/157/Madison_Square_Garden.html';
export const MSG_GARDEN_CREDIT =
  'Data courtesy of Phish.net / The Mockingbird Foundation';

const TOP_SONG_LIMIT = 10;
const OPENER_LIMIT = 8;
const NYE_OPENER_LIMIT = 5;
const VISIT_GAP_LIMIT = 5;
const BUSTOUT_LIMIT = 8;
const BUSTOUT_MIN_GAP = 30;

/**
 * @param {unknown} title
 * @returns {string}
 */
export function cleanMsgSongTitle(title) {
  return String(title ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function msgSetKey(raw) {
  const set = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!set) return '';
  if (set === 'e' || set === 'encore' || set.startsWith('encore')) return 'e';
  if (set === 's' || set === 'soundcheck' || set.startsWith('soundcheck')) {
    return 'soundcheck';
  }
  const numbered = set.match(/^(?:set\s*)?(\d+)$/);
  if (numbered) return numbered[1];
  return set;
}

/**
 * @param {string} fromDate
 * @param {string} toDate
 * @returns {number}
 */
export function daysBetweenShowDates(fromDate, toDate) {
  const from = parseYmd(fromDate);
  const to = parseYmd(toDate);
  if (!from || !to) return 0;
  const ms = Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d);
  return Math.round(ms / 86400000);
}

/**
 * @param {unknown} ymd
 * @returns {{ y: number, m: number, d: number } | null}
 */
function parseYmd(ymd) {
  if (typeof ymd !== 'string') return null;
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/**
 * @param {Map<string, number>} counts
 * @param {number} limit
 * @returns {Array<{ title: string, timesPlayed: number }>}
 */
function rankCounts(counts, limit) {
  return [...counts.entries()]
    .map(([title, timesPlayed]) => ({ title, timesPlayed }))
    .sort(
      (a, b) => b.timesPlayed - a.timesPlayed || a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/**
 * First song of set 1. Phish.net `position` is show-wide, so the opener is
 * the lowest position in set 1, not a hard-coded position of 1.
 *
 * @param {Array<{ title?: string, set?: string, position?: number }>} songs
 * @returns {string}
 */
export function msgSetOneOpener(songs) {
  const setOne = (Array.isArray(songs) ? songs : [])
    .map((song) => ({
      title: cleanMsgSongTitle(song?.title),
      set: msgSetKey(song?.set),
      position: Number(song?.position),
    }))
    .filter(
      (song) =>
        song.title && song.set === '1' && Number.isFinite(song.position),
    )
    .sort((a, b) => a.position - b.position);
  return setOne[0]?.title || '';
}

/**
 * @param {Array<{
 *   showDate?: string,
 *   canceled?: boolean,
 *   songs?: Array<{ title?: string, set?: string, position?: number, debut?: boolean, gap?: number }>,
 *   bustouts?: Array<{ title?: string, gap?: number, showDate?: string }>,
 * }>} shows
 * @param {{
 *   upcomingShows?: Array<{ showDate?: string, canceled?: boolean }>,
 *   asOf?: string,
 *   lastShowOrdinal?: number | null,
 * }} [opts]
 */
export function aggregateMsgGardenStats(shows, opts = {}) {
  const counted = (Array.isArray(shows) ? shows : [])
    .filter((show) => {
      if (!show || show.canceled) return false;
      if (!parseYmd(show.showDate)) return false;
      return Array.isArray(show.songs) && show.songs.length > 0;
    })
    .map((show) => ({
      showDate: String(show.showDate),
      songs: show.songs,
      bustouts: Array.isArray(show.bustouts) ? show.bustouts : [],
    }))
    .sort((a, b) => a.showDate.localeCompare(b.showDate));

  /** @type {Map<string, number>} */
  const songCounts = new Map();
  /** @type {Map<string, number>} */
  const openerCounts = new Map();
  /** @type {Map<string, number>} */
  const nyeOpenerCounts = new Map();
  /** @type {Map<string, string>} */
  const debuts = new Map();
  /** @type {Map<string, { title: string, gap: number, showDate: string }>} */
  const bustouts = new Map();

  let nyeShowCount = 0;
  let openerShowCount = 0;

  for (const show of counted) {
    const isNye = show.showDate.slice(5) === '12-31';
    if (isNye) nyeShowCount += 1;
    const opener = msgSetOneOpener(show.songs);
    if (opener) {
      openerShowCount += 1;
      openerCounts.set(opener, (openerCounts.get(opener) || 0) + 1);
      if (isNye) {
        nyeOpenerCounts.set(opener, (nyeOpenerCounts.get(opener) || 0) + 1);
      }
    }
    const seenThisShow = new Set();
    for (const song of show.songs) {
      if (msgSetKey(song?.set) === 'soundcheck') continue;
      const title = cleanMsgSongTitle(song?.title);
      if (!title) continue;
      songCounts.set(title, (songCounts.get(title) || 0) + 1);
      if (song?.debut && !seenThisShow.has(title)) {
        seenThisShow.add(title);
        const prior = debuts.get(title);
        if (!prior || show.showDate < prior) debuts.set(title, show.showDate);
      }
      const gap = Number(song?.gap);
      if (Number.isFinite(gap) && gap >= BUSTOUT_MIN_GAP) {
        rememberBustout(bustouts, title, gap, show.showDate);
      }
    }
    for (const row of show.bustouts) {
      const title = cleanMsgSongTitle(row?.title);
      const gap = Number(row?.gap);
      if (!title || !Number.isFinite(gap) || gap < BUSTOUT_MIN_GAP) continue;
      rememberBustout(
        bustouts,
        title,
        gap,
        parseYmd(row?.showDate) ? String(row.showDate) : show.showDate,
      );
    }
  }

  const visitGaps = [];
  for (let i = 1; i < counted.length; i += 1) {
    visitGaps.push({
      fromDate: counted[i - 1].showDate,
      toDate: counted[i].showDate,
      days: daysBetweenShowDates(counted[i - 1].showDate, counted[i].showDate),
    });
  }
  visitGaps.sort(
    (a, b) => b.days - a.days || a.fromDate.localeCompare(b.fromDate),
  );

  const upcomingShowDates = [
    ...new Set(
      (Array.isArray(opts.upcomingShows) ? opts.upcomingShows : [])
        .filter((show) => show && !show.canceled && parseYmd(show.showDate))
        .map((show) => String(show.showDate)),
    ),
  ].sort();

  const milestoneIndex = upcomingShowDates.indexOf(MSG_GARDEN_HUNDREDTH_DATE);
  const milestoneShowNumber =
    milestoneIndex >= 0 ? counted.length + milestoneIndex + 1 : null;

  const ordinal = Number(opts.lastShowOrdinal);
  const checkedOn = parseYmd(opts.asOf) ? String(opts.asOf) : '';

  return {
    venueId: MSG_GARDEN_VENUE_ID,
    venueName: 'Madison Square Garden',
    city: 'New York, NY',
    showCount: counted.length,
    uniqueSongs: songCounts.size,
    firstShowDate: counted[0]?.showDate || '',
    lastShowDate: counted[counted.length - 1]?.showDate || '',
    lastShowOrdinal: Number.isFinite(ordinal) && ordinal > 0 ? ordinal : null,
    nyeShowCount,
    openerShowCount,
    milestoneShowDate:
      milestoneShowNumber != null ? MSG_GARDEN_HUNDREDTH_DATE : '',
    milestoneShowNumber,
    upcomingShowDates,
    topSongs: rankCounts(songCounts, TOP_SONG_LIMIT),
    openers: rankCounts(openerCounts, OPENER_LIMIT),
    nyeOpeners: rankCounts(nyeOpenerCounts, NYE_OPENER_LIMIT),
    debuts: [...debuts.entries()]
      .map(([title, showDate]) => ({ title, showDate }))
      .sort(
        (a, b) =>
          a.showDate.localeCompare(b.showDate) || a.title.localeCompare(b.title),
      ),
    longestVisitGaps: visitGaps.slice(0, VISIT_GAP_LIMIT),
    longestBustouts: [...bustouts.values()]
      .sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title))
      .slice(0, BUSTOUT_LIMIT),
    checkedOn,
    credit: MSG_GARDEN_CREDIT,
    sourceUrl: MSG_GARDEN_SOURCE_URL,
  };
}

/**
 * @param {Map<string, { title: string, gap: number, showDate: string }>} map
 * @param {string} title
 * @param {number} gap
 * @param {string} showDate
 */
function rememberBustout(map, title, gap, showDate) {
  const prior = map.get(title);
  if (!prior || gap > prior.gap) {
    map.set(title, { title, gap, showDate });
  }
}
