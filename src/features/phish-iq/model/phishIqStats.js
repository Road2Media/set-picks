/**
 * Wordle-style Phish IQ stats from per-day results (#1267, #1275).
 *
 * A finished America/New_York day counts once, whatever the score. A win is a
 * perfect five. Win % is wins divided by days played. Current streak and best
 * streak count consecutive wins only, so a run of finished days that were not
 * perfect cannot show a streak beside a 0% win rate. A missed calendar day
 * ends the current streak the same way a non-win does, and the best streak
 * stays. Same-day repeats are the caller's job: this reads one result per date.
 */

import { PHISH_IQ_QUESTION_COUNT } from './phishIqQuiz';
import { shiftQuizDate } from './phishIqStreak';

export const PHISH_IQ_SCORE_BUCKETS = PHISH_IQ_QUESTION_COUNT + 1;

/**
 * @param {unknown} raw
 * @returns {{ score: number, marks: boolean[] } | null}
 */
export function normalizePhishIqDay(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = /** @type {Record<string, unknown>} */ (raw);
  const marks = Array.isArray(record.marks)
    ? record.marks.slice(0, PHISH_IQ_QUESTION_COUNT).map(Boolean)
    : [];
  const numeric = typeof record.score === 'number' ? record.score : Number(record.score);
  const derived = marks.filter(Boolean).length;
  const score = Number.isFinite(numeric) ? Math.trunc(numeric) : derived;
  return {
    score: Math.min(PHISH_IQ_QUESTION_COUNT, Math.max(0, score)),
    marks,
  };
}

/**
 * @param {unknown} raw
 * @returns {Record<string, { score: number, marks: boolean[] }>}
 */
export function normalizePhishIqDays(raw) {
  /** @type {Record<string, { score: number, marks: boolean[] }>} */
  const days = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return days;
  for (const [date, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day = normalizePhishIqDay(value);
    if (!day) continue;
    days[date] = day;
  }
  return days;
}

/**
 * @param {{ score: number }} day
 * @returns {boolean}
 */
function isWin(day) {
  return day.score === PHISH_IQ_QUESTION_COUNT;
}

/**
 * Longest run of consecutive calendar days that are all wins.
 *
 * @param {string[]} dates oldest to newest, unique
 * @param {Record<string, { score: number }>} days
 * @returns {number}
 */
function longestWinRun(dates, days) {
  let best = 0;
  let run = 0;
  let previous = '';
  for (const date of dates) {
    const continues =
      run > 0 && Boolean(previous) && date === shiftQuizDate(previous, 1) && isWin(days[date]);
    if (!isWin(days[date])) run = 0;
    else run = continues ? run + 1 : 1;
    if (run > best) best = run;
    previous = date;
  }
  return best;
}

/**
 * Win streak ending on the latest played day, when that day is still live
 * (today or yesterday) and is itself a win.
 *
 * @param {string[]} dates oldest to newest
 * @param {Record<string, { score: number }>} days
 * @param {string} today
 * @returns {number}
 */
function currentWinStreak(dates, days, today) {
  const latest = dates[dates.length - 1] || '';
  const live = Boolean(latest) && (latest === today || latest === shiftQuizDate(today, -1));
  if (!live || !isWin(days[latest])) return 0;
  let streak = 0;
  let cursor = latest;
  while (days[cursor] && isWin(days[cursor])) {
    streak += 1;
    const previous = shiftQuizDate(cursor, -1);
    if (!days[previous]) break;
    cursor = previous;
  }
  return streak;
}

/**
 * @param {unknown} days map of quiz date → result, or anything coerceable
 * @param {string} today America/New_York quiz date
 * @returns {{
 *   played: number,
 *   wins: number,
 *   winPercent: number,
 *   currentStreak: number,
 *   bestStreak: number,
 *   distribution: number[],
 * }}
 */
export function computePhishIqStats(days, today) {
  const normalized = normalizePhishIqDays(days);
  const dates = Object.keys(normalized).sort();
  const distribution = Array.from({ length: PHISH_IQ_SCORE_BUCKETS }, () => 0);
  let wins = 0;
  for (const date of dates) {
    const day = normalized[date];
    distribution[day.score] += 1;
    if (day.score === PHISH_IQ_QUESTION_COUNT) wins += 1;
  }
  const played = dates.length;
  const todayKey = typeof today === 'string' ? today : '';
  return {
    played,
    wins,
    winPercent: played === 0 ? 0 : Math.round((wins / played) * 100),
    currentStreak: currentWinStreak(dates, normalized, todayKey),
    bestStreak: longestWinRun(dates, normalized),
    distribution,
  };
}
