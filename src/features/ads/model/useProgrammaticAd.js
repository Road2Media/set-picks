import { useEffect, useState } from 'react';

import {
  loadFirebaseRemoteConfig,
  subscribeRemoteConfigActivations,
} from '../../../shared/lib/firebaseRemoteConfig';
import { getAdProvider } from '../api/adProvider';
import { ADS_ENABLED_PARAMETER, AD_SLOT_STANDINGS_INLINE } from '../config/adSlots';
import {
  getProgrammaticSlot,
  PROGRAMMATIC_ADS_ENABLED_PARAMETER,
} from '../config/programmaticSlots';
import { useAdConsent } from './useAdConsent';
import { readProgrammaticAdsConfig } from './programmaticAdsConfig';
import { resolveProgrammaticPhase } from './resolveProgrammaticPhase';

/**
 * Decides whether the EthicalAds seam may render. The default phase is
 * `off`, and this hook does not import the EthicalAds client.
 *
 * House creative, a closed consent gate, or either Remote Config flag
 * keeps the phase off the script. `ads_enabled` false blocks the slot
 * even when `programmatic_ads_enabled` is true.
 *
 * @param {string} slotId
 * @returns {{ phase: 'off' | 'blocked' | 'house' | 'ready', publisher: string }}
 */
export function useProgrammaticAd(slotId) {
  const consent = useAdConsent();
  const [phase, setPhase] = useState('off');

  useEffect(() => {
    let cancelled = false;
    let stopWatch = () => {};
    let generation = 0;
    const slot = getProgrammaticSlot(slotId);
    const config = readProgrammaticAdsConfig();
    const consentSignal = {
      cmpEnabled: consent.cmpEnabled,
      advertisingAllowed: consent.advertisingAllowed,
    };

    const load = () => {
      const token = ++generation;
      stopWatch();
      stopWatch = () => {};
      resolveProgrammaticPhase({
        slot,
        config,
        consent: consentSignal,
        loadHouseCreative: () =>
          getAdProvider().loadAdCreative(AD_SLOT_STANDINGS_INLINE, {
            surface: 'dashboard-standings',
          }),
        readFlags: async () => {
          const remoteConfig = await loadFirebaseRemoteConfig();
          return {
            adsEnabled: remoteConfig.getBoolean(ADS_ENABLED_PARAMETER),
            programmaticEnabled: remoteConfig.getBoolean(PROGRAMMATIC_ADS_ENABLED_PARAMETER),
          };
        },
      }).then((next) => {
        if (cancelled || token !== generation) return;
        setPhase(next);
        if (next !== 'ready') return;
        let watchReady = false;
        subscribeRemoteConfigActivations(() => {
          if (!watchReady || cancelled) return;
          load();
        })
          .then((unsubscribe) => {
            if (cancelled || token !== generation) {
              unsubscribe();
              return;
            }
            stopWatch = unsubscribe;
            watchReady = true;
          })
          .catch(() => {});
      });
    };

    load();

    return () => {
      cancelled = true;
      generation += 1;
      stopWatch();
    };
  }, [slotId, consent.cmpEnabled, consent.advertisingAllowed]);

  const config = readProgrammaticAdsConfig();
  return {
    phase,
    publisher: phase === 'ready' ? config.publisher : '',
  };
}
