/**
 * Programmatic proof-of-concept slots (#422).
 *
 * These are not Remote Config creative slots. `listAdSlots()` stays the
 * house registry. A programmatic slot renders nothing until the env, the
 * Remote Config flags, and `canLoadThirdPartyAdScript()` all allow a script.
 */

/** Standings seam, under the house unit. Remote Config has no JSON for this id. */
export const AD_SLOT_PROGRAMMATIC_STANDINGS = 'programmatic_standings_inline';

/**
 * Second kill switch. `ads_enabled` false still blocks this slot.
 * Default false until the console turns it on.
 */
export const PROGRAMMATIC_ADS_ENABLED_PARAMETER = 'programmatic_ads_enabled';

/** How long a paid fill may take before the seam collapses back to empty. */
export const PROGRAMMATIC_FILL_WAIT_MS = 8000;

/** GA4 `creative_id` for a paid EthicalAds fill. Not a house creative. */
export const PROGRAMMATIC_CREATIVE_ID = 'ethicalads';

const SLOTS = Object.freeze({
  [AD_SLOT_PROGRAMMATIC_STANDINGS]: Object.freeze({
    id: AD_SLOT_PROGRAMMATIC_STANDINGS,
    surface: 'dashboard-standings',
    placement: 'inline',
  }),
});

/**
 * @param {string} slotId
 * @returns {{ id: string, surface: string, placement: 'inline' } | null}
 */
export function getProgrammaticSlot(slotId) {
  if (typeof slotId !== 'string' || !slotId) return null;
  return SLOTS[slotId] ?? null;
}
