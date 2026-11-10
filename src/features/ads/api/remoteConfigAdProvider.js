import { loadFirebaseRemoteConfig } from '../../../shared/lib/firebaseRemoteConfig';

import { ADS_ENABLED_PARAMETER, getAdSlot } from '../config/adSlots';

/**
 * Read the kill switch and this slot's JSON. Does not parse or render.
 * Unknown slots skip the network.
 *
 * @param {string} slotId
 * @returns {Promise<{ adsEnabled: boolean, rawValue: string } | null>}
 */
export async function fetchAdSlotPayload(slotId) {
  const slot = getAdSlot(slotId);
  if (!slot) return null;

  const remoteConfig = await loadFirebaseRemoteConfig();
  return {
    adsEnabled: remoteConfig.getBoolean(ADS_ENABLED_PARAMETER),
    rawValue: remoteConfig.getString(slot.parameterKey),
  };
}
