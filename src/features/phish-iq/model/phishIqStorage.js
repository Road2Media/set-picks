/**
 * This-browser memory for a guest quiz result and the sign-up handoff.
 * The streak itself is saved only after sign-in (#1143).
 */

import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from '../../../shared/lib/local-storage';

export const PHISH_IQ_GUEST_RESULT_KEY = 'set-picks.phishIq.guest.v1';
export const PHISH_IQ_AUTH_INTENT_KEY = 'set-picks.phishIq.authIntent.v1';

const INTENT_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} key
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
 * @param {string} date
 * @returns {{ date: string, score: number, marks: boolean[] } | null}
 */
export function readGuestPhishIqResult(date) {
  const parsed = readJson(getLocalStorageItem(PHISH_IQ_GUEST_RESULT_KEY));
  if (!parsed || parsed.date !== date) return null;
  const score = Number.isFinite(parsed.score) ? Math.max(0, Math.trunc(parsed.score)) : 0;
  const marks = Array.isArray(parsed.marks) ? parsed.marks.map(Boolean) : [];
  return { date, score, marks };
}

/**
 * @param {{ date: string, score: number, marks: boolean[] }} result
 */
export function writeGuestPhishIqResult(result) {
  if (!result?.date) return;
  setLocalStorageItem(
    PHISH_IQ_GUEST_RESULT_KEY,
    JSON.stringify({
      date: result.date,
      score: result.score,
      marks: result.marks,
    }),
  );
}

export function clearGuestPhishIqResult() {
  removeLocalStorageItem(PHISH_IQ_GUEST_RESULT_KEY);
}

/**
 * @param {{ date: string, mode: 'signup' | 'save' }} intent
 */
export function writePhishIqAuthIntent(intent) {
  if (!intent?.date || (intent.mode !== 'signup' && intent.mode !== 'save')) return;
  setLocalStorageItem(
    PHISH_IQ_AUTH_INTENT_KEY,
    JSON.stringify({ date: intent.date, mode: intent.mode, at: Date.now() }),
  );
}

/**
 * Read and clear a fresh intent for this quiz date.
 *
 * @param {string} date
 * @returns {{ date: string, mode: 'signup' | 'save' } | null}
 */
export function consumePhishIqAuthIntent(date) {
  const parsed = readJson(getLocalStorageItem(PHISH_IQ_AUTH_INTENT_KEY));
  removeLocalStorageItem(PHISH_IQ_AUTH_INTENT_KEY);
  if (!parsed || parsed.date !== date) return null;
  if (parsed.mode !== 'signup' && parsed.mode !== 'save') return null;
  const at = Number(parsed.at);
  if (!Number.isFinite(at) || Date.now() - at > INTENT_MAX_MS) return null;
  return { date: parsed.date, mode: parsed.mode };
}
