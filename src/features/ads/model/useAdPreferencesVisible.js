import { useEffect, useState } from 'react';

import { loadFirebaseRemoteConfig } from '../../../shared/lib/firebaseRemoteConfig';
import { ADS_ENABLED_PARAMETER } from '../config/adSlots';
import { PROGRAMMATIC_ADS_ENABLED_PARAMETER } from '../config/programmaticSlots';
import { readCmpConfig } from './adConsent';
import { readProgrammaticAdsConfig } from './programmaticAdsConfig';
import { shouldShowAdPreferences } from './shouldShowAdPreferences';

/**
 * Reads the switches that decide whether any ad can render.
 * A failed Remote Config load stays hidden.
 *
 * @param {Record<string, string | undefined> | undefined} [env]
 * @returns {Promise<boolean>}
 */
export async function readAdPreferencesVisible(env = import.meta.env) {
  const providerEnabled = readProgrammaticAdsConfig(env).enabled === true;
  const cmpEnabled = readCmpConfig(env).enabled === true;
  try {
    const remoteConfig = await loadFirebaseRemoteConfig();
    return shouldShowAdPreferences({
      adsEnabled: remoteConfig.getBoolean(ADS_ENABLED_PARAMETER) === true,
      programmaticEnabled:
        remoteConfig.getBoolean(PROGRAMMATIC_ADS_ENABLED_PARAMETER) === true,
      providerEnabled,
      cmpEnabled,
    });
  } catch {
    return false;
  }
}

/**
 * Starts hidden so the section never paints before the switches are known.
 *
 * @returns {boolean}
 */
export function useAdPreferencesVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readAdPreferencesVisible().then((next) => {
      if (!cancelled) setVisible(next === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return visible;
}
