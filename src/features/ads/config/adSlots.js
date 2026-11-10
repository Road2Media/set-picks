/**
 * Mounted Phase 1 slots (#121).
 *
 * Picks, Profile, and a dashboard-shell bar are intentionally not registered.
 * Composing them would change the picks flow or add a surface the shell does
 * not already reserve. Options live in `docs/ADS_REMOTE_CONFIG_RUNBOOK.md`.
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
  }),
});

/**
 * @param {string} slotId
 * @returns {{ id: string, parameterKey: string, surface: string, variant: 'banner' | 'card' } | null}
 */
export function getAdSlot(slotId) {
  if (typeof slotId !== 'string' || !slotId) return null;
  return SLOTS[slotId] ?? null;
}
