/**
 * Mobile scrollport top reservation (#707).
 *
 * One value, `--dashboard-mobile-chrome-h`, replaces the per-route
 * `pt-[calc(env(safe-area-inset-top)+…rem)]` ternaries. `short` is 4rem less
 * because the brand row (`h-12` + `py-2`) is hidden. Numbers match the
 * pre-#707 layout so a tab with fixed chrome and a tab without it keep the
 * same clearance.
 *
 * @param {{
 *   fixedChrome: boolean,
 *   picksCluster: boolean,
 *   statsQuaternary: boolean,
 *   short: boolean,
 * }} state
 * @returns {string}
 */
export function resolveDashboardMobileChromeHeight({
  fixedChrome,
  picksCluster,
  statsQuaternary,
  short,
}) {
  if (!fixedChrome) return short ? '5rem' : '9rem';
  if (picksCluster) return short ? '11.25rem' : '15.25rem';
  if (statsQuaternary) return short ? '13.75rem' : '17.75rem';
  return short ? '7.75rem' : '11.75rem';
}
