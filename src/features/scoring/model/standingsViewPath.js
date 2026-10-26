/**
 * Path helpers for Standings IA views (#255 / #769 / #1110).
 *
 * Show / Tour / Year / Pools stay on `/dashboard/standings` with `?view=`.
 * Stats lives on the Stats primary (`/dashboard/stats/*`).
 */

/** @typedef {'show' | 'tour' | 'year' | 'pools'} StandingsViewId */

/**
 * @param {StandingsViewId} view
 * @param {{
 *   tourKey?: string | null,
 *   poolId?: string | null,
 *   yearKey?: string | null,
 * }} [opts]
 * @returns {string}
 */
export function buildStandingsViewPath(view, opts = {}) {
  const tourKey =
    typeof opts.tourKey === 'string' && opts.tourKey.trim()
      ? opts.tourKey.trim()
      : '';
  const poolId =
    typeof opts.poolId === 'string' && opts.poolId.trim()
      ? opts.poolId.trim()
      : '';
  const yearKey =
    typeof opts.yearKey === 'string' && /^\d{4}$/.test(opts.yearKey.trim())
      ? opts.yearKey.trim()
      : '';

  const params = new URLSearchParams();
  if (view === 'tour') {
    params.set('view', 'tour');
    if (tourKey) params.set('tour', tourKey);
  } else if (view === 'year') {
    params.set('view', 'year');
    if (yearKey) params.set('year', yearKey);
  } else if (view === 'pools') {
    params.set('view', 'pools');
    if (poolId) params.set('pool', poolId);
  }
  // `show` omits `?view=` (canonical default).
  const q = params.toString();
  return q ? `/dashboard/standings?${q}` : '/dashboard/standings';
}
