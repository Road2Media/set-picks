import { ga4Event } from '../../../shared/lib/ga4';

/** One bundled-catalog fallback per browser session, not per hook instance. */
let fallbackTracked = false;

/**
 * @param {{ resolved?: boolean, source?: string, loadError?: unknown }} state
 * @returns {'load_error' | 'unavailable' | null}
 */
export function catalogFallbackReason({ resolved, source, loadError } = {}) {
  if (!resolved || source !== 'fallback') return null;
  return loadError ? 'load_error' : 'unavailable';
}

/**
 * Privacy-friendly count when autocomplete is served from bundled `phishSongs.js`.
 * No song titles, URLs, error text, or user ids. GA stays off outside production
 * hostnames (`src/shared/lib/ga4.js`).
 *
 * @param {{ reason?: string }} [payload]
 */
export function trackSongCatalogFallback({ reason } = {}) {
  if (fallbackTracked) return;
  fallbackTracked = true;
  const safe = reason === 'load_error' ? 'load_error' : 'unavailable';
  ga4Event('song_catalog_fallback', { reason: safe });
}

/** @internal vitest */
export function resetSongCatalogFallbackTrackingForTests() {
  fallbackTracked = false;
}
