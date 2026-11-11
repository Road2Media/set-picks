/**
 * Per-day Phish IQ results for this browser (#1267).
 * Keyed by the America/New_York quiz date. Survives sign-in. The legacy
 * single-result guest key is folded in on read and is not required after that.
 * The first saved score for a date wins.
 */

import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../shared/lib/local-storage';
import { normalizePhishIqDay, normalizePhishIqDays } from './phishIqStats';
import { PHISH_IQ_GUEST_RESULT_KEY } from './phishIqStorage';

export const PHISH_IQ_HISTORY_KEY = 'set-picks.phishIq.history.v1';

/**
 * @param {string | null} raw
 */
function readJson(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, { score: number, marks: boolean[] }>} days
 */
function writeDays(days) {
  setLocalStorageItem(PHISH_IQ_HISTORY_KEY, JSON.stringify({ days }));
}

/**
 * @returns {{ date: string, score: number, marks: boolean[] } | null}
 */
function readLegacyGuestDay() {
  const parsed = readJson(getLocalStorageItem(PHISH_IQ_GUEST_RESULT_KEY));
  if (!parsed || typeof parsed.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    return null;
  }
  const day = normalizePhishIqDay(parsed);
  if (!day) return null;
  return { date: parsed.date, ...day };
}

/**
 * @returns {{ days: Record<string, { score: number, marks: boolean[] }> }}
 */
export function readPhishIqHistory() {
  const parsed = readJson(getLocalStorageItem(PHISH_IQ_HISTORY_KEY));
  const storedDays =
    parsed && !Array.isArray(parsed) && parsed.days && typeof parsed.days === 'object'
      ? parsed.days
      : null;
  const days = normalizePhishIqDays(storedDays);
  const legacy = readLegacyGuestDay();
  if (legacy && !days[legacy.date]) {
    days[legacy.date] = { score: legacy.score, marks: legacy.marks };
    writeDays(days);
  }
  return { days };
}

/**
 * @param {{ date?: string, score?: number, marks?: boolean[] }} result
 * @returns {{ days: Record<string, { score: number, marks: boolean[] }> }}
 */
export function recordPhishIqHistory(result) {
  const history = readPhishIqHistory();
  const date = typeof result?.date === 'string' ? result.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || history.days[date]) return history;
  const day = normalizePhishIqDay(result);
  if (!day) return history;
  const days = { ...history.days, [date]: day };
  writeDays(days);
  return { days };
}
