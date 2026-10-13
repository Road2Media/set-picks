import { formatFanShowDate } from './dateUtils';

const cityFromVenue = (venue) => String(venue ?? '').split(',')[0].trim();

/**
 * @param {unknown} date
 * @returns {string}
 */
function fanLabelDate(date) {
  const formatted = formatFanShowDate(date);
  return typeof formatted === 'string' ? formatted : '';
}

/**
 * @param {unknown} date
 * @param {string} place
 * @param {string} separator
 * @returns {string}
 */
function joinShowLabel(date, place, separator) {
  const fan = fanLabelDate(date);
  if (fan && place) return `${fan}${separator}${place}`;
  return fan || place || '';
}

/**
 * Full line for desktop <option>s and in-page cards/banners (Active Show,
 * standings headers, etc.). No hard character truncate — CSS wrap/truncate
 * at the call site when the surface is narrow.
 */
export function showOptionLabelDesktop(show) {
  return joinShowLabel(show?.date, cityFromVenue(show?.venue), ' — ');
}

/**
 * Short single-line label for narrow / mobile <option> lists only.
 * Native pickers often wrap long text; truncation keeps one line per show.
 * Do not use for roomy card titles — prefer {@link showOptionLabelDesktop}.
 */
export function showOptionLabelCompact(show, maxChars = 40) {
  const base = joinShowLabel(show?.date, cityFromVenue(show?.venue), ' ');
  if (base.length <= maxChars) return base;
  return `${base.slice(0, maxChars - 1)}…`;
}

/** Tooltip / accessible hint with full venue. */
export function showOptionTitle(show) {
  return joinShowLabel(show?.date, String(show?.venue ?? ''), ' — ');
}
