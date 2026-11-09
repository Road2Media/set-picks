/** In-app template id for the annual wrap (#1111). Copy is on the send payload. */

export const ANNUAL_WRAP_TEMPLATE_ID = 'annual-wrap';

export const ANNUAL_WRAP_INAPP_CTA_LABEL = 'View year standings';

/**
 * Year board from #1110. The year is always in the URL so a January send
 * still opens the year that just ended.
 *
 * @param {unknown} year
 * @returns {string}
 */
export function annualWrapStandingsHref(year) {
  const value = String(year ?? '').trim();
  if (!/^\d{4}$/.test(value)) return '/dashboard/standings?view=year';
  return `/dashboard/standings?view=year&year=${value}`;
}
