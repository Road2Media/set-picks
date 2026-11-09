import { resolveShowTimeZone } from '../../../shared/utils/showTimeZone';
import {
  isPastPicksLock,
  scheduleTodayYmd,
} from '../../../shared/utils/timeLogic';

import { resolveCurrentTour } from './resolveCurrentTour';

/**
 * A show date is historical once that night's picks can no longer change.
 * Today counts only after the picks lock. A later date does not.
 *
 * @param {string} showDate
 * @param {Array<{ date?: string, timeZone?: string, picksLockLocal?: string }> | null | undefined} showDates
 * @param {Date} now
 */
function isHistoricalLockedShow(showDate, showDates, now) {
  const show =
    (Array.isArray(showDates) ? showDates : []).find((row) => row?.date === showDate) ||
    { date: showDate };
  const timeZone = resolveShowTimeZone(show);
  const today = scheduleTodayYmd(timeZone, now);
  if (showDate < today) return true;
  if (showDate > today) return false;
  return isPastPicksLock(showDate, timeZone, now, show);
}

/**
 * Locked tour nights before `selectedDate` (#694 P2).
 *
 * The open night stays out even when the picker is on a later date, so tour
 * chalk cannot include cards people can still edit.
 *
 * @param {string | null | undefined} selectedDate
 * @param {Array<{ date?: string, timeZone?: string }> | null | undefined} showDates
 * @param {Array<{ tour?: string, shows?: Array<{ date?: string }> }> | null | undefined} showDatesByTour
 * @param {Date} [now]
 * @returns {string[]}
 */
export function priorLockedTourShowDates(
  selectedDate,
  showDates,
  showDatesByTour,
  now = new Date()
) {
  const date = typeof selectedDate === 'string' ? selectedDate.trim() : '';
  if (!date) return [];
  if (!Array.isArray(showDates) || showDates.length === 0) return [];

  const clock = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const selectedShow =
    showDates.find((row) => row?.date === date) || null;
  const tour = resolveCurrentTour(
    date,
    scheduleTodayYmd(resolveShowTimeZone(selectedShow), clock),
    showDatesByTour
  );
  if (!tour?.shows?.length) return [];

  return tour.shows
    .map((show) => (typeof show?.date === 'string' ? show.date : ''))
    .filter((showDate) => {
      if (!showDate || showDate >= date) return false;
      return isHistoricalLockedShow(showDate, showDates, clock);
    })
    .sort();
}
