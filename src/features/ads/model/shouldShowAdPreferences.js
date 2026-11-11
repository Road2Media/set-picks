/**
 * Account → Preferences mounts Ad preferences only when an ad can render.
 *
 * House: Remote Config `ads_enabled`.
 * Programmatic: that flag, plus `programmatic_ads_enabled`, a configured
 * provider, and a configured CMP. A programmatic unit stays empty while
 * `ads_enabled` is false, so those other switches do not open this section
 * on their own.
 *
 * A missing creative, or the player's own allow or deny choice, is not
 * this gate. The in-app defaults are all off.
 *
 * @param {{
 *   adsEnabled?: boolean,
 *   programmaticEnabled?: boolean,
 *   providerEnabled?: boolean,
 *   cmpEnabled?: boolean,
 * }} [input]
 * @returns {boolean}
 */
export function shouldShowAdPreferences(input = {}) {
  const houseEnabled = input?.adsEnabled === true;
  const programmaticEnabled =
    houseEnabled &&
    input?.programmaticEnabled === true &&
    input?.providerEnabled === true &&
    input?.cmpEnabled === true;
  return houseEnabled || programmaticEnabled;
}
