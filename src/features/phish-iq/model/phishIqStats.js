/**
 * Wordle-style Phish IQ stats from per-day results (#1267).
 *
 * A finished America/New_York day counts once, whatever the score. The next
 * calendar day continues the streak. A missed day breaks the current streak
 * and leaves the best streak in place. Win % counts only a perfect five.
 * Same-day repeats are the caller's job: this reads one result per date.
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
 * @param {string[]} dates oldest to newest, unique
 * @returns {number}
 */
function longestRun(dates) {
  let best = 0;
  let run = 0;
  let previous = '';
  for (const date of dates) {
    run = previous && date === shiftQuizDate(previous, 1) ? run + 1 : 1;
    if (run > best) best = run;
    previous = date;
  }
  return best;
}

/**
 * @param {Set<string>} played
 * @param {string} end
 * @returns {number}
 */
function runEndingOn(played, end) {
  if (!played.has(end)) return 0;
  let streak = 1;
  let cursor = end;
  while (played.has(shiftQuizDate(cursor, -1))) {
    streak += 1;
    cursor = shiftQuizDate(cursor, -1);
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
  const playedSet = new Set(dates);
  const latest = dates[dates.length - 1] || '';
  const todayKey = typeof today === 'string' ? today : '';
  const streakStillLive =
    Boolean(latest) &&
    (latest === todayKey || latest === shiftQuizDate(todayKey, -1));
  return {
    played,
    wins,
    winPercent: played === 0 ? 0 : Math.round((wins / played) * 100),
    currentStreak: streakStillLive ? runEndingOn(playedSet, latest) : 0,
    bestStreak: longestRun(dates),
    distribution,
  };
}
