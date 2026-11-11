import { useCallback, useEffect, useState } from 'react';

import {
  notifyAdConsent,
  openCmpPreferences,
  AD_CONSENT_STORAGE_KEY,
  readCmpConfig,
  readStoredAdChoice,
  resolveAdConsent,
  subscribeAdConsent,
  tcfAllowsAdvertising,
  writeStoredAdChoice,
} from './adConsent';

function safeLocalStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Advertising consent for Phase 4 providers.
 *
 * `advertisingAllowed` stays false until a CMP is configured and its
 * signal allows advertising, and the player has not chosen off.
 * This hook does not start GA4, Auth, or Firestore.
 *
 * @returns {{
 *   choice: 'unknown' | 'granted' | 'denied',
 *   cmpEnabled: boolean,
 *   advertisingAllowed: boolean,
 *   source: 'cmp' | 'first-party',
 *   setAdvertisingChoice: (choice: 'granted' | 'denied') => boolean,
 *   openPartnerPreferences: () => { opened: boolean, reason: 'opened' | 'cmp-off' },
 * }}
 */
export function useAdConsent() {
  const cmp = readCmpConfig();
  const [storedChoice, setStoredChoice] = useState(() => readStoredAdChoice(safeLocalStorage()));
  const [tcfAllows, setTcfAllows] = useState(false);

  useEffect(() => {
    const sync = () => setStoredChoice(readStoredAdChoice(safeLocalStorage()));
    const unsubscribe = subscribeAdConsent(sync);
    const onStorage = (event) => {
      if (event.key && event.key !== AD_CONSENT_STORAGE_KEY) return;
      sync();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  useEffect(() => {
    if (!cmp.enabled || typeof window === 'undefined' || typeof window.__tcfapi !== 'function') {
      setTcfAllows(false);
      return undefined;
    }

    let listenerId = null;
    let cancelled = false;
    window.__tcfapi('addEventListener', 2, (tcData, success) => {
      if (cancelled) return;
      if (!success) {
        setTcfAllows(false);
        return;
      }
      if (tcData && tcData.listenerId != null) listenerId = tcData.listenerId;
      setTcfAllows(tcfAllowsAdvertising(tcData));
    });

    return () => {
      cancelled = true;
      if (listenerId != null && typeof window.__tcfapi === 'function') {
        window.__tcfapi('removeEventListener', 2, () => {}, listenerId);
      }
    };
  }, [cmp.enabled]);

  const setAdvertisingChoice = useCallback((choice) => {
    const result = writeStoredAdChoice(safeLocalStorage(), choice);
    if (!result.ok) return false;
    setStoredChoice(choice);
    notifyAdConsent();
    return true;
  }, []);

  const consent = resolveAdConsent({
    cmpEnabled: cmp.enabled,
    storedChoice,
    tcfAllows,
  });

  const openPartnerPreferences = useCallback(
    () => openCmpPreferences(typeof window === 'undefined' ? undefined : window),
    [],
  );

  return {
    ...consent,
    setAdvertisingChoice,
    openPartnerPreferences,
  };
}
