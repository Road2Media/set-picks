import {
  loadFirebaseRemoteConfig,
  subscribeRemoteConfigActivations,
} from '../../../shared/lib/firebaseRemoteConfig';
import { ADS_ENABLED_PARAMETER, getAdSlot } from '../config/adSlots';
import { resolveAdCreative } from '../model/resolveAdCreative';

/**
 * Remote Config implementation of {@link AdProvider}.
 * Context is accepted and not used for targeting. There is no premium field.
 * `watchSlot` is for an on-screen creative only. The hook enforces that.
 */
export function createRemoteConfigAdProvider() {
  return {
    /**
     * @param {string} slotId
     * @param {object | null | undefined} [context]
     * @returns {Promise<object | null>}
     */
    async loadAdCreative(slotId, context) {
      if (context != null && (typeof context !== 'object' || Array.isArray(context))) {
        return null;
      }
      const slot = getAdSlot(slotId);
      if (!slot) return null;

      try {
        const remoteConfig = await loadFirebaseRemoteConfig();
        return resolveAdCreative({
          adsEnabled: remoteConfig.getBoolean(ADS_ENABLED_PARAMETER),
          rawValue: remoteConfig.getString(slot.parameterKey),
        });
      } catch {
        return null;
      }
    },

    /**
     * @param {string} slotId
     * @param {() => void} onChange
     * @returns {() => void}
     */
    watchSlot(slotId, onChange) {
      if (!getAdSlot(slotId) || typeof onChange !== 'function') return () => {};
      let stop = () => {};
      let stopped = false;
      subscribeRemoteConfigActivations(onChange)
        .then((unsubscribe) => {
          if (stopped) unsubscribe();
          else stop = unsubscribe;
        })
        .catch(() => {});
      return () => {
        stopped = true;
        stop();
        stop = () => {};
      };
    },
  };
}
