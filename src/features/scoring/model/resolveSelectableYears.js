import { GAME_LAUNCH_SHOW_DATE } from '../../../shared/config/gameLaunch';

/**
 * Calendar year of a show date (#1110).
 *
 * A year is the `YYYY` of the show's calendar date. A Dec 31 show stays in
 * that year even when the music runs past midnight. A Jan 1 show is the next
 * year. There is no end-time or timezone shift — `show.date` is already the
 * night the schedule calls that show.
 *
 * @param {unknown} date
 * @returns {string | null} four-digit year, or null when `date` is not `YYYY-MM-DD`
 */
export function calendarYearOfShowDate(date) {
  if (typeof date !== 'string') return null;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return match ? match[1] : null;
}

/**
 * @typedef {{ year: string, shows: Array<{ date: string }> }} YearGroup
 */

/**
 * Years the Standings year picker can offer.
 *
 * A year is selectable when it has at least one show on or after
 * {@link GAME_LAUNCH_SHOW_DATE} and on or before `today`. Shows are the
 * dates the board will read: same window, de-duplicated, oldest first.
 * Future nights in that year are omitted — they cannot be graded yet, and
 * the board updates as soon as a night's date is today and its picks grade.
 * Newest year first so the in-progress year is the default.
 *
 * @param {Array<{ date?: string }> | null | undefined} showDates
 * @param {string} today `YYYY-MM-DD`
 * @returns {YearGroup[]}
 */
export function resolveSelectableYears(showDates, today) {
  if (!Array.isArray(showDates) || typeof today !== 'string' || !today) return [];

  /** @type {Map<string, Set<string>>} */
  const datesByYear = new Map();
  for (const show of showDates) {
    const date = show?.date;
    if (typeof date !== 'string') continue;
    if (date < GAME_LAUNCH_SHOW_DATE || date > today) continue;
    const year = calendarYearOfShowDate(date);
    if (!year) continue;
    const dates = datesByYear.get(year) || new Set();
    dates.add(date);
    datesByYear.set(year, dates);
  }

  return [...datesByYear.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([year, dates]) => ({
      year,
      shows: [...dates].sort().map((date) => ({ date })),
    }));
}

/**
 * @param {YearGroup[] | null | undefined} years
 * @param {string | null | undefined} yearKey
 * @returns {YearGroup | null}
 */
export function getYearByKey(years, yearKey) {
  if (!Array.isArray(years) || typeof yearKey !== 'string') return null;
  const key = yearKey.trim();
  if (!/^\d{4}$/.test(key)) return null;
  return years.find((group) => group && group.year === key) ?? null;
}

/**
 * Selected year for the standings year view.
 *
 * A known `?year=` wins. While the calendar snapshot is still loading, an
 * unknown year stays unresolved (caller must not swap in a fallback year or
 * drop the param). Once the calendar is ready, an unknown year falls back
 * to the newest selectable year.
 *
 * @param {YearGroup[] | null | undefined} years
 * @param {string | null | undefined} rawYear
 * @param {{ calendarReady?: boolean }} [opts]
 * @returns {YearGroup | null}
 */
export function deriveSelectedYear(years, rawYear, opts = {}) {
  const list = Array.isArray(years) ? years : [];
  const calendarReady = opts.calendarReady !== false;
  const key = typeof rawYear === 'string' ? rawYear.trim() : '';
  const found = key ? getYearByKey(list, key) : null;
  if (found) return found;
  if (key && !calendarReady) return null;
  return list[0] ?? null;
}

/**
 * True when `?year=` should be removed because it is not a selectable year
 * on a settled calendar. Never clears during calendar load.
 *
 * @param {YearGroup[] | null | undefined} years
 * @param {string | null | undefined} rawYear
 * @param {{ calendarReady?: boolean }} [opts]
 * @returns {boolean}
 */
export function shouldClearYearParam(years, rawYear, opts = {}) {
  if (opts.calendarReady === false) return false;
  const key = typeof rawYear === 'string' ? rawYear.trim() : '';
  if (!key) return false;
  return !getYearByKey(years, key);
}
