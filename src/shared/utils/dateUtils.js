function toDateSafe(value) {
  if (!value) return null;
  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** @param {Date} [date] @param {string} timeZone — IANA, e.g. `America/Los_Angeles` */
export function ymdInTimeZone(date = new Date(), timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Fan-facing numeric show date. Storage stays `YYYY-MM-DD`.
 * Keep in sync with `functions/fanShowDate.cjs`.
 * Invalid input returns the original value.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function formatFanShowDate(value) {
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
 * This-tour column: month and day only. Year comes from the tour.
 * Derived from {@link formatFanShowDate}. Non-dates return a trimmed string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatFanShowMonthDay(value) {
  if (typeof value !== 'string') return '';
  const formatted = formatFanShowDate(value);
  if (typeof formatted === 'string' && /^\d{2}\/\d{2}\/\d{2}$/.test(formatted)) {
    return formatted.slice(0, 5);
  }
  return value.trim();
}

export function formatShowLabel(dateStr) {
  const date = toDateSafe(`${dateStr}T12:00:00`);
  if (!date) return dateStr;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthYear(value) {
  const date = toDateSafe(value);
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
