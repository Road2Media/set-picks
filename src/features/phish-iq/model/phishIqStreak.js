/**
 * Personal Phish IQ streak (#1143).
 * A finished day counts once. The next America/New_York calendar day continues
 * it. Any gap starts it over. Same-day replays keep the first saved score.
 */

/**
 * @param {string} iso YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
export function shiftQuizDate(iso, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {unknown} raw
 * @returns {{
 *   currentStreak: number,
 *   bestStreak: number,
 *   lastPlayedDate: string,
 *   lastScore: number,
 *   lastMarks: boolean[],
 * } | null}
 */
export function normalizePhishIqRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (raw);
  const lastPlayedDate =
    typeof record.lastPlayedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.lastPlayedDate)
      ? record.lastPlayedDate
      : '';
  if (!lastPlayedDate) return null;
  const currentStreak = Number.isFinite(record.currentStreak)
    ? Math.max(0, Math.trunc(/** @type {number} */ (record.currentStreak)))
    : 0;
  const bestRaw = Number.isFinite(record.bestStreak)
    ? Math.trunc(/** @type {number} */ (record.bestStreak))
    : currentStreak;
  const lastScore = Number.isFinite(record.lastScore)
    ? Math.max(0, Math.trunc(/** @type {number} */ (record.lastScore)))
    : 0;
  const lastMarks = Array.isArray(record.lastMarks) ? record.lastMarks.map(Boolean) : [];
  return {
    currentStreak,
    bestStreak: Math.max(currentStreak, bestRaw, 0),
    lastPlayedDate,
    lastScore,
    lastMarks,
  };
}

/**
 * @param {unknown} previous
 * @param {{ date: string, score: number, marks: boolean[] }} result
 */
export function nextPhishIqRecord(previous, result) {
  const prior = normalizePhishIqRecord(previous);
  const date = result?.date || '';
  const score = Number.isFinite(result?.score) ? Math.max(0, Math.trunc(result.score)) : 0;
  const marks = Array.isArray(result?.marks) ? result.marks.map(Boolean) : [];
  if (prior && prior.lastPlayedDate === date) {
    return { ...prior };
  }
  const continued = Boolean(prior && prior.lastPlayedDate === shiftQuizDate(date, -1));
  const currentStreak = continued ? prior.currentStreak + 1 : 1;
  const bestStreak = Math.max(prior?.bestStreak || 0, currentStreak);
  return {
    currentStreak,
    bestStreak,
    lastPlayedDate: date,
    lastScore: score,
    lastMarks: marks,
  };
}
