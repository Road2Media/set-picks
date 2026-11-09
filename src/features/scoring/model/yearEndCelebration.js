/**
 * Year-end celebration on the annual standings board (#1112).
 *
 * Plays on the year view for the year that just closed, once per person in
 * this browser, for two calendar months after that year's last show date.
 * It can start as soon as that finale is graded. It does not wait for the
 * morning wrap. A Dec 31 show stays in that year. The grade, not midnight,
 * is what opens the moment.
 *
 * "Graded" matches the annual wrap (`yearFinaleReady` in
 * `functions/annualWrapCore.js`): every non-empty card that night is graded.
 * A finale nobody played is ready. The live show calendar has to be the
 * source. The bundled fallback list ends before the real finale, so it must
 * not close the year.
 */

import {
  YEAR_END_ANNUAL_WINNER_LABEL,
  YEAR_END_RUNNER_UP_LABEL,
  YEAR_END_THIRD_PLACE_LABEL,
} from '../../../shared/config/dashboardVocabulary';
import { GAME_LAUNCH_SHOW_DATE } from '../../../shared/config/gameLaunch';
import { getLocalStorageItem, setLocalStorageItem } from '../../../shared/lib/local-storage';
import { hasNonEmptyPicksObject } from '../../../shared/utils/showAggregation';
import { assignTourDisplayRanks } from './tourStandingsRank';
import { calendarYearOfShowDate } from './resolveSelectableYears';

/** How long the burst stays up before it ends on its own. */
export const YEAR_END_CELEBRATION_MS = 8000;

/** Two calendar months after the finale show date, inclusive. */
export const YEAR_END_CELEBRATION_MONTHS = 2;

const STORAGE_PREFIX = 'set-picks:year-end-celebration:';

/**
 * @param {number} rank
 * @returns {string | null}
 */
export function yearEndPlaceLabel(rank) {
  if (rank === 1) return YEAR_END_ANNUAL_WINNER_LABEL;
  if (rank === 2) return YEAR_END_RUNNER_UP_LABEL;
  if (rank === 3) return YEAR_END_THIRD_PLACE_LABEL;
  return null;
}

/**
 * Dev-server preview only. Production builds pass `dev: false`.
 *
 * @param {unknown} flag `yearCelebration` query value
 * @param {boolean} dev
 * @returns {boolean}
 */
export function isYearEndCelebrationPreview(flag, dev) {
  return dev === true && flag === 'preview';
}

/**
 * @param {string} ymd
 * @param {number} months
 * @returns {string | null}
 */
export function addCalendarMonths(ymd, months) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match || !Number.isInteger(months)) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  const y = String(targetYear).padStart(4, '0');
  const m = String(targetMonth + 1).padStart(2, '0');
  const d = String(clamped).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Latest show date in that calendar year, on or after game launch.
 * Future nights stay in the list. A later night keeps an earlier one
 * from being the finale.
 *
 * @param {Array<{ date?: string }> | null | undefined} showDates
 * @param {unknown} year
 * @returns {string | null}
 */
export function yearFinaleDate(showDates, year) {
  if (typeof year !== 'string' || !/^\d{4}$/.test(year)) return null;
  let finale = null;
  for (const show of Array.isArray(showDates) ? showDates : []) {
    const date = typeof show?.date === 'string' ? show.date : '';
    if (calendarYearOfShowDate(date) !== year) continue;
    if (date < GAME_LAUNCH_SHOW_DATE) continue;
    if (!finale || date > finale) finale = date;
  }
  return finale;
}

/**
 * The year that just closed: the newest calendar year whose finale show
 * date is today or earlier. A year with a night still ahead is not closed.
 *
 * @param {Array<{ date?: string }> | null | undefined} showDates
 * @param {string} today `YYYY-MM-DD`
 * @returns {{ year: string, finaleDate: string } | null}
 */
export function latestClosedYear(showDates, today) {
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  /** @type {Set<string>} */
  const years = new Set();
  for (const show of Array.isArray(showDates) ? showDates : []) {
    const date = typeof show?.date === 'string' ? show.date : '';
    const year = calendarYearOfShowDate(date);
    if (!year || date < GAME_LAUNCH_SHOW_DATE) continue;
    years.add(year);
  }
  /** @type {{ year: string, finaleDate: string } | null} */
  let latest = null;
  for (const year of years) {
    const finaleDate = yearFinaleDate(showDates, year);
    if (!finaleDate || finaleDate > today) continue;
    if (!latest || year > latest.year) latest = { year, finaleDate };
  }
  return latest;
}

/**
 * @param {string | null | undefined} finaleDate
 * @param {string | null | undefined} today
 * @returns {boolean}
 */
export function isWithinYearEndWindow(finaleDate, today) {
  if (!finaleDate || !today || today < finaleDate) return false;
  const end = addCalendarMonths(finaleDate, YEAR_END_CELEBRATION_MONTHS);
  if (!end) return false;
  return today <= end;
}

/**
 * Same rule as the annual wrap: every submitted card that night is graded.
 * A finale with no submitted card is ready.
 *
 * @param {unknown[] | null | undefined} picks
 * @returns {boolean}
 */
export function isYearFinaleReady(picks) {
  const submitted = (Array.isArray(picks) ? picks : []).filter((row) =>
    hasNonEmptyPicksObject(row?.picks),
  );
  if (submitted.length === 0) return true;
  return submitted.every((row) => row?.isGraded === true);
}

/**
 * Latest night in a fetched show list, and whether that night is graded.
 * Callers compare `tailDate` to {@link yearFinaleDate}. An in-progress year
 * fetches only nights through today, so the tail is not the finale.
 *
 * @param {Array<string | { date?: string }> | null | undefined} dates
 * @param {Array<{ date?: string, picks?: unknown[] }> | null | undefined} picksByDate
 * @returns {{ tailDate: string | null, tailReady: boolean }}
 */
export function tailShowReadiness(dates, picksByDate) {
  /** @type {string[]} */
  const list = [];
  for (const entry of Array.isArray(dates) ? dates : []) {
    const date = typeof entry === 'string' ? entry : entry?.date;
    if (typeof date === 'string' && date) list.push(date);
  }
  if (list.length === 0) return { tailDate: null, tailReady: false };
  let tailDate = list[0];
  for (const date of list) {
    if (date > tailDate) tailDate = date;
  }
  const row = (Array.isArray(picksByDate) ? picksByDate : []).find(
    (entry) => entry?.date === tailDate,
  );
  return { tailDate, tailReady: isYearFinaleReady(row?.picks) };
}

/**
 * Official ranks 1–3. A tie keeps the place label and names everyone.
 * The next rank still skips, the same way the board does.
 *
 * @param {Array<{ uid?: string, handle?: string, totalPoints?: number }> | null | undefined} leaders
 * @returns {Array<{ rank: number, label: string, tied: boolean, members: Array<{ uid: string, handle: string }> }>}
 */
export function yearEndPodium(leaders) {
  const ranked = assignTourDisplayRanks(leaders);
  /** @type {Array<{ rank: number, label: string, tied: boolean, members: Array<{ uid: string, handle: string }> }>} */
  const places = [];
  for (const rank of [1, 2, 3]) {
    const label = yearEndPlaceLabel(rank);
    const members = ranked.filter((row) => row.rank === rank);
    if (!label || members.length === 0) continue;
    places.push({
      rank,
      label,
      tied: members.length > 1,
      members: members.map((row) => ({
        uid: typeof row.uid === 'string' ? row.uid : '',
        handle:
          typeof row.handle === 'string' && row.handle.trim() ? row.handle.trim() : 'Anonymous',
      })),
    });
  }
  return places;
}

/**
 * @param {Array<{ rank: number, label: string }> | null | undefined} places
 * @returns {Record<number, string>}
 */
export function yearEndPlaceLabelsByRank(places) {
  /** @type {Record<number, string>} */
  const map = {};
  for (const place of Array.isArray(places) ? places : []) {
    if (!place?.label || !Number.isFinite(place.rank)) continue;
    map[place.rank] = place.label;
  }
  return map;
}

/**
 * @param {unknown} uid
 * @param {unknown} year
 * @returns {string | null}
 */
export function yearEndCelebrationStorageKey(uid, year) {
  if (typeof uid !== 'string' || !uid.trim()) return null;
  if (typeof year !== 'string' || !/^\d{4}$/.test(year)) return null;
  return `${STORAGE_PREFIX}${uid.trim()}:${year}`;
}

/**
 * @param {unknown} uid
 * @param {unknown} year
 * @param {(key: string) => string | null} [readItem]
 * @returns {boolean}
 */
export function readYearEndCelebrationSeen(uid, year, readItem = getLocalStorageItem) {
  const key = yearEndCelebrationStorageKey(uid, year);
  if (!key) return false;
  return readItem(key) === '1';
}

/**
 * @param {unknown} uid
 * @param {unknown} year
 * @param {(key: string, value: string) => void} [writeItem]
 */
export function markYearEndCelebrationSeen(uid, year, writeItem = setLocalStorageItem) {
  const key = yearEndCelebrationStorageKey(uid, year);
  if (!key) return;
  writeItem(key, '1');
}

/**
 * @param {{
 *   view?: string | null,
 *   year?: string | null,
 *   showDates?: Array<{ date?: string }> | null,
 *   today?: string | null,
 *   calendarSettled?: boolean,
 *   tailDate?: string | null,
 *   tailReady?: boolean,
 *   seen?: boolean,
 *   leaders?: Array<Record<string, unknown>> | null,
 *   leadersLoading?: boolean,
 *   leadersError?: boolean,
 * }} input
 * @returns {{
 *   play: boolean,
 *   year: string | null,
 *   finaleDate: string | null,
 *   places: ReturnType<typeof yearEndPodium>,
 * }}
 */
export function resolveYearEndCelebration(input) {
  const year = typeof input?.year === 'string' ? input.year : null;
  const idle = { play: false, year, finaleDate: null, places: [] };
  if (input?.view !== 'year') return idle;
  if (input?.calendarSettled !== true) return idle;
  if (input?.leadersLoading || input?.leadersError) return idle;
  if (!year || typeof input?.today !== 'string') return idle;
  if (input?.seen === true) return idle;

  const finaleDate = yearFinaleDate(input.showDates, year);
  if (!finaleDate || finaleDate > input.today) return { ...idle, finaleDate };
  if (!isWithinYearEndWindow(finaleDate, input.today)) return { ...idle, finaleDate };

  const closed = latestClosedYear(input.showDates, input.today);
  if (!closed || closed.year !== year) return { ...idle, finaleDate };

  if (input.tailDate !== finaleDate || input.tailReady !== true) {
    return { ...idle, finaleDate };
  }

  const places = yearEndPodium(input.leaders);
  if (!places.some((place) => place.rank === 1)) return { ...idle, finaleDate };
  return { play: true, year, finaleDate, places };
}
