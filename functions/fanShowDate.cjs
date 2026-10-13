'use strict';

/**
 * Fan-facing numeric show date. Storage stays `YYYY-MM-DD`.
 * Keep in sync with `formatFanShowDate` in `src/shared/utils/dateUtils.js`.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function formatFanShowDate(value) {
  if (typeof value !== 'string') return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return value;
  }
  return `${match[2]}/${match[3]}/${String(year).slice(-2)}`;
}

/**
 * `MM/DD/YY` when `value` is a storage date, otherwise empty.
 * @param {unknown} value
 * @returns {string}
 */
function fanDateBadge(value) {
  const formatted = formatFanShowDate(typeof value === 'string' ? value : '');
  return typeof formatted === 'string' && /^\d{2}\/\d{2}\/\d{2}$/.test(formatted) ? formatted : '';
}

module.exports = {
  formatFanShowDate,
  fanDateBadge,
};
