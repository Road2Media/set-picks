/**
 * Raw HTTP client for external Phish setlist APIs (Phish.in, Phish.net).
 * No parsing beyond JSON — see #141. Parsing lives in `setlistParser` (#142).
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getBandConfig } from '../../../shared/config/bands.js';
import { app } from '../../../shared/lib/firebase.js';

/** @typedef {'NetworkError' | 'HTTPError' | 'JSONParseError' | 'SetlistApiError' | 'ConfigurationError'} SetlistFetchErrorType */

/**
 * @typedef {object} NetworkError
 * @property {'NetworkError'} type
 * @property {string} message
 * @property {unknown} [cause]
 */

/**
 * @typedef {object} HTTPError
 * @property {'HTTPError'} type
 * @property {string} message
 * @property {number} status
 * @property {string} [statusText]
 */

/**
 * @typedef {object} JSONParseError
 * @property {'JSONParseError'} type
 * @property {string} message
 * @property {unknown} [cause]
 */

/**
 * @typedef {object} SetlistApiError
 * @property {'SetlistApiError'} type
 * @property {string} message
 * @property {'phishnet'} source
 * @property {number} [code]
 */

/**
 * @typedef {object} ConfigurationError
 * @property {'ConfigurationError'} type
 * @property {string} message
 */

/** @typedef {NetworkError | HTTPError | JSONParseError | SetlistApiError | ConfigurationError} SetlistFetchError */

/**
 * @typedef {object} SetlistFetchSuccess
 * @property {true} ok
 * @property {unknown} data
 */

/**
 * @typedef {object} SetlistFetchFailure
 * @property {false} ok
 * @property {SetlistFetchError} error
 */

/** @typedef {SetlistFetchSuccess | SetlistFetchFailure} SetlistFetchResult */

const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PHISHIN_SHOW_URL = (date) => `https://phish.in/api/v2/shows/${encodeURIComponent(date)}`;

/** Phish.net calls from this module use the Firebase callable only — see README (key in Secret Manager, never `VITE_*`). */

/** Keep in sync with `PHISHNET_FUNCTIONS_REGION` in `functions/index.js`. */
const PHISHNET_CALLABLE_REGION = 'us-central1';

function isPhishnetCallableEnabled() {
  const v = String(import.meta.env.VITE_USE_CALLABLE_PHISHNET_SETLIST ?? '')
    .trim()
    .toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Firebase `httpsCallable` errors sometimes hide the real text in `details` or use a useless `message` ("internal").
 * @param {unknown} e
 * @returns {string | null}
 */
function extractCallableDetailMessage(e) {
  if (typeof e !== 'object' || e === null) return null;
  const rec = /** @type {Record<string, unknown>} */ (e);
  const details = rec.details;
  if (typeof details === 'string' && details.trim()) return details.trim();
  if (Array.isArray(details) && details.length > 0) {
    const d0 = details[0];
    if (typeof d0 === 'string' && d0.trim()) return d0.trim();
    if (typeof d0 === 'object' && d0 !== null && 'message' in d0 && typeof d0.message === 'string') {
      return d0.message.trim();
    }
  }
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const d = /** @type {Record<string, unknown>} */ (details);
    if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
  }
  const custom = rec.customData;
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    const c = /** @type {Record<string, unknown>} */ (custom);
    if (typeof c.message === 'string' && c.message.trim()) return c.message.trim();
  }
  return null;
}

/**
 * @param {unknown} e
 * @returns {SetlistFetchError}
 */
function callableFailureToError(e) {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : '';
  const rawMsg =
    typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
      ? e.message
      : 'Callable request failed.';
  const detailMsg = extractCallableDetailMessage(e);
  const generic =
    /^internal$/i.test(rawMsg.trim()) ||
    /^unknown$/i.test(rawMsg.trim()) ||
    /^firebase error$/i.test(rawMsg.trim());
  const msg = (generic && detailMsg) || detailMsg || rawMsg;
  if (code === 'functions/unauthenticated') {
    return {
      type: 'ConfigurationError',
      message: 'Sign in required to fetch Phish.net setlist via server.',
    };
  }
  if (/app-check|appcheck/i.test(code) || /app check/i.test(msg)) {
    return {
      type: 'ConfigurationError',
      message: `${msg} — For localhost: add the debug token from the browser console to Firebase Console → App Check → your Web app → Debug tokens, or turn off Cloud Functions enforcement there while testing.`,
    };
  }
  if (
    code === 'functions/permission-denied' ||
    code === 'functions/failed-precondition' ||
    code === 'functions/invalid-argument'
  ) {
    return { type: 'ConfigurationError', message: msg };
  }
  if (code === 'functions/unavailable' || code === 'functions/internal') {
    const fallback =
      code === 'functions/internal'
        ? `${msg}. Common causes: (1) Cloud Run invoker not public—redeploy getPhishnetSetlist with invoker "public" or grant roles/run.invoker to allUsers on the Cloud Run service (see README “CORS policy”); (2) App Check enforcing Functions; (3) stale function deploy. Check the browser console for a CORS preflight error on the cloudfunctions.net POST.`
        : msg;
    return { type: 'SetlistApiError', message: fallback || 'Server error.', source: 'phishnet' };
  }
  return { type: 'SetlistApiError', message: msg, source: 'phishnet' };
}

/**
 * @param {string} dateString
 * @returns {Promise<SetlistFetchResult>}
 */
async function fetchPhishnetViaCallable(dateString) {
  try {
    const functions = getFunctions(app, PHISHNET_CALLABLE_REGION);
    const getPhishnetSetlist = httpsCallable(functions, 'getPhishnetSetlist');
    const result = await getPhishnetSetlist({ showDate: dateString });
    const data = result.data;
    if (data == null || typeof data !== 'object') {
      return {
        ok: false,
        error: { type: 'JSONParseError', message: 'Empty or invalid response from server.' },
      };
    }
    const logical = phishNetLogicalError(data);
    if (logical) {
      return { ok: false, error: logical };
    }
    return { ok: true, data };
  } catch (e) {
    if (import.meta.env.DEV) {
      const r = typeof e === 'object' && e !== null ? /** @type {Record<string, unknown>} */ (e) : {};
      console.error('[phishApiClient] getPhishnetSetlist callable failed', {
        code: r.code,
        message: r.message,
        details: r.details,
        customData: r.customData,
        showDateSent: dateString,
      });
    }
    return { ok: false, error: callableFailureToError(e) };
  }
}

const ALLOWED_SOURCES = new Set(['phishin', 'phishnet']);

/**
 * @param {unknown} result
 * @returns {result is SetlistFetchFailure}
 */
export function isSetlistFetchFailure(result) {
  return Boolean(result && typeof result === 'object' && result.ok === false && 'error' in result);
}

/**
 * @param {string} dateString YYYY-MM-DD
 * @returns {ConfigurationError | null}
 */
function validateShowDate(dateString) {
  if (typeof dateString !== 'string' || !SHOW_DATE_RE.test(dateString)) {
    return {
      type: 'ConfigurationError',
      message: 'Expected show date in YYYY-MM-DD format.',
    };
  }
  return null;
}

/**
 * @returns {{ ok: true, source: 'phishin' | 'phishnet' } | { ok: false, error: ConfigurationError }}
 */
function resolveSource() {
  const raw = (import.meta.env.VITE_SETLIST_API_SOURCE ?? 'phishin').trim().toLowerCase();
  if (!ALLOWED_SOURCES.has(raw)) {
    return {
      ok: false,
      error: {
        type: 'ConfigurationError',
        message: `Invalid VITE_SETLIST_API_SOURCE "${raw}". Use phishin or phishnet.`,
      },
    };
  }
  return { ok: true, source: raw };
}

/** @param {unknown} cause */
function networkError(cause) {
  return /** @type {NetworkError} */ ({
    type: 'NetworkError',
    message: cause instanceof Error ? cause.message : 'Network request failed.',
    cause,
  });
}

/** @param {Response} res */
function httpErrorFromResponse(res) {
  return /** @type {HTTPError} */ ({
    type: 'HTTPError',
    message: `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`,
    status: res.status,
    statusText: res.statusText,
  });
}

/** @param {unknown} cause */
function jsonParseError(cause) {
  return /** @type {JSONParseError} */ ({
    type: 'JSONParseError',
    message: cause instanceof Error ? cause.message : 'Response was not valid JSON.',
    cause,
  });
}

/**
 * @param {unknown} body
 * @returns {SetlistApiError | null}
 */
function phishNetLogicalError(body) {
  if (!body || typeof body !== 'object') return null;
  const err = /** @type {Record<string, unknown>} */ (body).error;
  if (err === undefined || err === null || err === false || err === 0 || err === '0') return null;
  const msg =
    typeof /** @type {Record<string, unknown>} */ (body).error_message === 'string'
      ? /** @type {Record<string, unknown>} */ (body).error_message
      : 'Phish.net API returned an error.';
  const code = typeof err === 'number' ? err : undefined;
  return { type: 'SetlistApiError', message: msg, source: 'phishnet', code };
}

/**
 * @param {string} dateString
 * @returns {Promise<SetlistFetchResult>}
 */
async function fetchPhishinRaw(dateString) {
  const url = PHISHIN_SHOW_URL(dateString);
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    return { ok: false, error: networkError(e) };
  }

  if (!res.ok) {
    return { ok: false, error: httpErrorFromResponse(res) };
  }

  try {
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: jsonParseError(e) };
  }
}

/**
 * @param {string} dateString
 * @returns {Promise<SetlistFetchResult>}
 */
async function fetchPhishnetRaw(dateString) {
  if (isPhishnetCallableEnabled()) {
    return fetchPhishnetViaCallable(dateString);
  }

  return {
    ok: false,
    error: {
      type: 'ConfigurationError',
      message:
        'Phish.net must be loaded via the Firebase callable so the API key stays server-side. Set VITE_USE_CALLABLE_PHISHNET_SETLIST=true, deploy getPhishnetSetlist, and store the key only as Secret PHISHNET_API_KEY — do not use VITE_PHISHNET_API_KEY (any VITE_* value is embedded in the browser bundle).',
    },
  };
}

/**
 * Fetches raw setlist-related JSON for a show date from the configured external API.
 *
 * @param {string} dateString Show date `YYYY-MM-DD`
 * @param {{ forceSource?: 'phishin' | 'phishnet' }} [options] Override the
 * configured `VITE_SETLIST_API_SOURCE`. Used by bustout-fetch flows that need
 * Phish.net specifically (the only source with per-row `gap`).
 * @returns {Promise<SetlistFetchResult>}
 */
export async function fetchSetlistRaw(dateString, options = {}) {
  const badDate = validateShowDate(dateString);
  if (badDate) {
    return { ok: false, error: badDate };
  }

  let source;
  if (options && options.forceSource && ALLOWED_SOURCES.has(options.forceSource)) {
    source = options.forceSource;
  } else {
    const sourceRes = resolveSource();
    if (!sourceRes.ok) {
      return { ok: false, error: sourceRes.error };
    }
    source = sourceRes.source;
  }

  if (source === 'phishnet') {
    return fetchPhishnetRaw(dateString);
  }
  return fetchPhishinRaw(dateString);
}

const phishSetlistClient = Object.freeze({
  bandId: 'phish',
  providerId: 'phishnet',
  fetchSetlistRaw,
});

/**
 * Admin setlist client for one band. Phase 2 returns the Phish.net client
 * for `phish` only. The client still honors `VITE_SETLIST_API_SOURCE` and
 * `forceSource` — this factory only chooses the band.
 *
 * @param {string} bandId
 * @returns {{
 *   bandId: 'phish',
 *   providerId: 'phishnet',
 *   fetchSetlistRaw: typeof fetchSetlistRaw,
 * }}
 */
export function getProviderClient(bandId) {
  const band = getBandConfig(bandId);
  if (band.id !== 'phish' || band.providerId !== 'phishnet') {
    throw new Error(`No setlist provider client for bandId: ${band.id}`);
  }
  return phishSetlistClient;
}
