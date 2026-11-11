/**
 * Scorecard comparison audience (#1043). Global is the default.
 * A pool id is accepted only when it is one of the signed-in player's pools.
 * No new route — `?pool=` on `/dashboard/picks/scorecard`.
 */

/**
 * @param {string | null | undefined} rawPool
 * @param {Array<{ id?: string, name?: string }> | null | undefined} pools
 */
export function resolveScorecardAudience(rawPool, pools) {
  const list = Array.isArray(pools) ? pools : [];
  const id = typeof rawPool === 'string' ? rawPool.trim() : '';
  const pool = id ? list.find((entry) => entry?.id === id) ?? null : null;
  return {
    id: pool?.id || 'global',
    name: pool ? pool.name || 'Pool' : 'Everyone',
    pool,
    invalid: Boolean(id) && !pool,
  };
}

/**
 * @param {Array<{ id: string, name: string }>} options
 * @param {Array<{ id?: string, name?: string }> | null | undefined} pools
 */
export function scorecardAudienceOptions(pools) {
  const list = Array.isArray(pools) ? pools : [];
  const named = list
    .filter((pool) => typeof pool?.id === 'string' && pool.id)
    .map((pool) => ({
      id: pool.id,
      name: pool.name || 'Pool',
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return [{ id: 'global', name: 'Everyone' }, ...named];
}

/**
 * The player's show doc is in the global night list and not in the pool list.
 * That night does not count toward this pool (membership snapshot or join day).
 *
 * @param {Array<Record<string, unknown>> | null | undefined} globalPicks
 * @param {Array<Record<string, unknown>> | null | undefined} audiencePicks
 * @param {string | null | undefined} selfUserId
 * @param {string | null | undefined} audienceId
 */
export function scorecardPoolExcludesNight(
  globalPicks,
  audiencePicks,
  selfUserId,
  audienceId,
) {
  if (!selfUserId || !audienceId || audienceId === 'global') return false;
  const uidOf = (entry) => entry?.userId || entry?.uid;
  const inList = (list) =>
    Array.isArray(list) && list.some((entry) => uidOf(entry) === selfUserId);
  return inList(globalPicks) && !inList(audiencePicks);
}

/**
 * Standings deep link for the same night and audience.
 *
 * @param {string | null | undefined} showDate
 * @param {string | null | undefined} audienceId
 */
export function scorecardStandingsHref(showDate, audienceId) {
  const params = new URLSearchParams();
  if (typeof showDate === 'string' && showDate) params.set('showDate', showDate);
  if (typeof audienceId === 'string' && audienceId && audienceId !== 'global') {
    params.set('view', 'pools');
    params.set('pool', audienceId);
  }
  const query = params.toString();
  return query ? `/dashboard/standings?${query}` : '/dashboard/standings';
}
