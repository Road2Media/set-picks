import {
  getProviderClient,
  isSetlistFetchFailure,
  mapParsedSetlistToLegacySaveShape,
  parseSetlist,
  SetlistParseError,
} from '../../admin-setlist-config/index.js';

const phishSetlistClient = getProviderClient('phish');
import { FORM_FIELDS } from '../../../shared/data/gameConfig.js';

const gameConfig = { FORM_FIELDS };

/**
 * @param {{ type: string, message?: string, status?: number }} err
 * @returns {string}
 */
function formatSetlistFetchLayerError(err) {
  if (!err || typeof err !== 'object' || !('type' in err)) return 'Request failed.';
  switch (err.type) {
    case 'NetworkError':
      return err.message || 'Network error.';
    case 'HTTPError':
      return err.message || `HTTP ${err.status}`;
    case 'JSONParseError':
      return err.message || 'Invalid JSON in response.';
    case 'SetlistApiError':
      return err.message || 'Setlist API error.';
    case 'ConfigurationError':
      return err.message || 'Configuration error.';
    default:
      return 'Request failed.';
  }
}

/**
 * Fetches raw setlist JSON for a show date, parses it, and returns legacy shapes for the admin form.
 *
 * @param {string} showDate YYYY-MM-DD
 * @param {{ id: string }[]} slotFields Admin slot fields (typically `ADMIN_SETLIST_FIELDS`).
 * @returns {Promise<{ ok: true, setlistData: Record<string, string>, officialSetlist: string[], encoreSongs: string[], bustouts: string[], songGaps: Record<string, number> } | { ok: false, error: string }>}
 */
export async function fetchAndMapExternalSetlist(showDate, slotFields) {
  const rawResult = await phishSetlistClient.fetchSetlistRaw(showDate);
  if (isSetlistFetchFailure(rawResult)) {
    return { ok: false, error: formatSetlistFetchLayerError(rawResult.error) };
  }

  const apiSource = import.meta.env.VITE_SETLIST_API_SOURCE ?? 'phishin';

  try {
    const parsed = parseSetlist(rawResult.data, apiSource, gameConfig);
    const { setlistData, officialSetlist, encoreSongs, bustouts, songGaps } =
      mapParsedSetlistToLegacySaveShape(parsed, slotFields);
    return { ok: true, setlistData, officialSetlist, encoreSongs, bustouts, songGaps };
  } catch (e) {
    if (e instanceof SetlistParseError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to parse setlist.' };
  }
}

/**
 * Fetch `bustouts` for a show date directly from Phish.net, irrespective of
 * the admin's configured `VITE_SETLIST_API_SOURCE`. Used by the admin save
 * fallback when the admin typed the setlist by hand (or came in via Phish.in,
 * which has no gap metadata) and the form state has no bustouts yet (#214).
 *
 * Always talks to Phish.net (via `getPhishnetSetlist` callable) regardless of
 * the configured ingest source, because Phish.net is the only source that
 * carries per-row `gap`. Returns `{ ok: false }` soft-failure — the caller
 * should save with empty `bustouts` and surface a toast so the admin can
 * retry once Phish.net has the setlist.
 *
 * @param {string} showDate YYYY-MM-DD
 * @param {{ id: string }[]} slotFields
 * @returns {Promise<{ ok: true, bustouts: string[], songGaps: Record<string, number> } | { ok: false, error: string }>}
 */
export async function fetchBustoutsFromPhishnet(showDate, slotFields) {
  const rawResult = await phishSetlistClient.fetchSetlistRaw(showDate, {
    forceSource: 'phishnet',
  });
  if (isSetlistFetchFailure(rawResult)) {
    return { ok: false, error: formatSetlistFetchLayerError(rawResult.error) };
  }

  try {
    const parsed = parseSetlist(rawResult.data, 'phishnet', gameConfig);
    const { bustouts, songGaps } = mapParsedSetlistToLegacySaveShape(parsed, slotFields);
    return { ok: true, bustouts, songGaps };
  } catch (e) {
    if (e instanceof SetlistParseError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to parse setlist.' };
  }
}
