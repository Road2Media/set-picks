import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

import { DEFAULT_BAND_ID, getBandConfig } from '../../shared/config/bands.js';

/**
 * @param {string} search `useLocation().search` (`''` or `'?band=phish'`).
 * @returns {string | null} Known id, {@link DEFAULT_BAND_ID} when `band` is present but invalid, or `null` when the param is absent.
 */
export function resolveBandSearchOverride(search) {
  const rawSearch = typeof search === 'string' ? search : '';
  const params = new URLSearchParams(
    rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch,
  );
  if (!params.has('band')) return null;
  const raw = params.get('band');
  try {
    return getBandConfig(raw).id;
  } catch {
    return DEFAULT_BAND_ID;
  }
}

/**
 * Phase 0 stores only {@link DEFAULT_BAND_ID}. Any other request is a no-op.
 * @param {string} current
 * @param {unknown} requested
 * @returns {string}
 */
export function nextStoredBandId(current, requested) {
  if (requested === DEFAULT_BAND_ID) return DEFAULT_BAND_ID;
  return current;
}

let warnedUnsupportedSetBandId = false;

/** Tests reset the once-per-page-load dev warning. */
export function resetBandSwitchWarningForTests() {
  warnedUnsupportedSetBandId = false;
}

function warnUnsupportedSetBandId(requested) {
  if (!import.meta.env.DEV || warnedUnsupportedSetBandId) return;
  warnedUnsupportedSetBandId = true;
  const label = typeof requested === 'string' ? JSON.stringify(requested) : typeof requested;
  console.warn(
    `[BandProvider] setBandId(${label}) ignored; only "${DEFAULT_BAND_ID}" is registered.`,
  );
}

export const BandContext = createContext(null);

/**
 * Active band for the app shell. Phase 0 always resolves to Phish:
 * `?band=` is accepted only when it names a registered config, and
 * `setBandId` ignores anything other than `phish`.
 */
export function BandProvider({ children }) {
  const { search } = useLocation();
  const [storedBandId, setStoredBandId] = useState(DEFAULT_BAND_ID);
  const override = resolveBandSearchOverride(search);
  const bandId = override ?? storedBandId;
  const bandConfig = getBandConfig(bandId);

  const setBandId = useCallback((next) => {
    const resolved = nextStoredBandId(storedBandId, next);
    if (resolved === storedBandId && next !== DEFAULT_BAND_ID) {
      warnUnsupportedSetBandId(next);
      return;
    }
    setStoredBandId(resolved);
  }, [storedBandId]);

  const value = useMemo(
    () => ({ bandId, bandConfig, setBandId }),
    [bandId, bandConfig, setBandId],
  );

  return <BandContext.Provider value={value}>{children}</BandContext.Provider>;
}

/** @returns {{ bandId: string, bandConfig: import('../../shared/config/bands.js').BandConfig, setBandId: (next: unknown) => void }} */
export function useBand() {
  const ctx = useContext(BandContext);
  if (!ctx) {
    throw new Error('useBand must be used within BandProvider');
  }
  return ctx;
}
