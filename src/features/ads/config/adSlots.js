/**
 * Mounted slots. This registry is the source of truth for allowed `slotId`
 * values. Keep it in sync with `docs/ADS_REMOTE_CONFIG_RUNBOOK.md`.
 *
 * Picks, Profile, and a dashboard-shell bar are intentionally not registered.
 * Composing them would change the picks flow or add a surface the shell does
 * not already reserve.
 */

/** Standings seam below the invite promo. Remote Config parameter key. */
export const AD_SLOT_STANDINGS_INLINE = 'dashboard_standings_inline';

/** Kill-switch parameter. Default false until the console turns it on. */
export const ADS_ENABLED_PARAMETER = 'ads_enabled';

const SLOTS = Object.freeze({
  [AD_SLOT_STANDINGS_INLINE]: Object.freeze({
    id: AD_SLOT_STANDINGS_INLINE,
    parameterKey: AD_SLOT_STANDINGS_INLINE,
    surface: 'dashboard-standings',
    variant: 'banner',
    logo: Object.freeze({ widthPx: 56, heightPx: 56 }),
    minHeight: 'L1',
  }),
});

/**
 * @param {string} slotId
 * @returns {{
 *   id: string,
 *   parameterKey: string,
 *   surface: string,
 *   variant: 'banner' | 'card',
 *   logo: { widthPx: number, heightPx: number },
 *   minHeight: string,
 * } | null}
 */
export function getAdSlot(slotId) {
  if (typeof slotId !== 'string' || !slotId) return null;
  return SLOTS[slotId] ?? null;
}

/** @returns {Array<NonNullable<ReturnType<typeof getAdSlot>>>} */
export function listAdSlots() {
  return Object.values(SLOTS);
}
