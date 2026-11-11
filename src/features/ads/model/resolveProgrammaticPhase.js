import { canLoadThirdPartyAdScript } from './adConsent';

/**
 * House creative wins. The script is the second choice, and only when every
 * gate is open. An unknown slot or an unset env is `off` and does not ask
 * Remote Config. Consent denial is `blocked` and does not ask Remote Config.
 *
 * @param {{
 *   config?: { enabled?: boolean } | null,
 *   consent?: { advertisingAllowed?: boolean, cmpEnabled?: boolean } | null,
 *   houseCreative?: object | null,
 *   adsEnabled?: boolean,
 *   programmaticEnabled?: boolean,
 * }} input
 * @returns {boolean}
 */
export function shouldMountProgrammaticAd(input) {
  if (!input?.config?.enabled) return false;
  if (!canLoadThirdPartyAdScript(input.consent)) return false;
  if (input.houseCreative) return false;
  if (input.adsEnabled !== true || input.programmaticEnabled !== true) return false;
  return true;
}

/**
 * @param {{
 *   slot?: object | null,
 *   config?: { enabled?: boolean } | null,
 *   consent?: { advertisingAllowed?: boolean, cmpEnabled?: boolean } | null,
 *   loadHouseCreative?: () => Promise<object | null>,
 *   readFlags?: () => Promise<{ adsEnabled?: boolean, programmaticEnabled?: boolean }>,
 * }} input
 * @returns {Promise<'off' | 'blocked' | 'house' | 'ready'>}
 */
export async function resolveProgrammaticPhase(input) {
  const slot = input?.slot;
  const config = input?.config;
  if (!slot || !config?.enabled) return 'off';
  if (!canLoadThirdPartyAdScript(input.consent)) return 'blocked';

  let house = null;
  try {
    house = typeof input.loadHouseCreative === 'function' ? await input.loadHouseCreative() : null;
  } catch {
    house = null;
  }
  if (house) return 'house';

  let flags = { adsEnabled: false, programmaticEnabled: false };
  try {
    if (typeof input.readFlags === 'function') flags = await input.readFlags();
  } catch {
    return 'blocked';
  }

  return shouldMountProgrammaticAd({
    config,
    consent: input.consent,
    houseCreative: house,
    adsEnabled: flags?.adsEnabled,
    programmaticEnabled: flags?.programmaticEnabled,
  })
    ? 'ready'
    : 'blocked';
}
