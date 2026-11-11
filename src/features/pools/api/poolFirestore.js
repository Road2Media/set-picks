import { doc, updateDoc } from 'firebase/firestore';

import { stampBandId } from '../../../shared/config/bandScope.js';
import { db } from '../../../shared/lib/firebase';
import { ymdInTimeZone } from '../../../shared/utils/dateUtils';

/** @type {number} */
export const POOL_NAME_MAX_LENGTH = 80;

/**
 * Membership calendar day uses the app default show timezone so join/create
 * anchors align with `showDate` (`YYYY-MM-DD`) comparisons elsewhere.
 * @see docs/RELEASE_TRAIN_SPRINT_5_6.md (#417)
 */
export const MEMBERSHIP_DAY_TIME_ZONE = 'America/Los_Angeles';

/** Absent / unknown scope behaves as legacy (retroactive carryover). */
export const STANDINGS_SCOPE_LEGACY = 'legacy';

/** New pools: standings count only from each member's join day onward. */
export const STANDINGS_SCOPE_FROM_MEMBERSHIP = 'from_membership';

/**
 * @param {unknown} scope
 * @returns {boolean}
 */
export function isFromMembershipStandingsScope(scope) {
  return scope === STANDINGS_SCOPE_FROM_MEMBERSHIP;
}

/**
 * Calendar day (`YYYY-MM-DD`) for a membership timestamp.
 *
 * @param {string | Date | null | undefined} isoOrDate
 * @returns {string | null}
 */
export function membershipCalendarDay(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return null;
  const date =
    isoOrDate instanceof Date ? isoOrDate : new Date(String(isoOrDate));
  if (Number.isNaN(date.getTime())) return null;
  return ymdInTimeZone(date, MEMBERSHIP_DAY_TIME_ZONE);
}

/**
 * Whether a pick document should count toward this pool (snapshot or legacy).
 *
 * Pool standings, the active-show pool view, and the server-side pool
 * delete path all gate inclusion on `pick.pools` (the snapshot of which
 * pools the author belonged to at pick-save time).
 *
 * **Legacy pools** (default — `standingsScope` absent or not
 * `from_membership`): after pool **create** or **join**,
 * `arrayUnionPoolOntoUserPickDocs` merges the pool into that user's
 * existing pick docs so pre-create / pre-join graded picks count.
 * Pick docs without a `pools` snapshot (or `pools: []`) count for every
 * pool the user is currently a member of.
 *
 * **`from_membership` pools** (new docs only, #417): no historical
 * backfill. A pick counts only when it **explicitly** lists this pool in
 * `pools` **and** `showDate` is on or after the author's membership
 * calendar day (`memberJoinedOn`). Empty-snapshot legacy fallback does
 * **not** apply.
 *
 * @param {Record<string, unknown>} pickData
 * @param {string} poolId
 * @param {{
 *   standingsScope?: string | null,
 *   memberJoinedOn?: string | null,
 *   showDate?: string | null,
 * }} [ctx]
 */
export function pickDataCountsForPool(pickData, poolId, ctx = {}) {
  if (!poolId?.trim() || !pickData) return false;
  const pools = pickData.pools;
  const hasSnapshot = Array.isArray(pools) && pools.length > 0;
  const inSnapshot =
    hasSnapshot && pools.some((p) => p && p.id === poolId);

  if (isFromMembershipStandingsScope(ctx.standingsScope)) {
    if (!inSnapshot) return false;
    const showDate =
      typeof ctx.showDate === 'string' && ctx.showDate
        ? ctx.showDate
        : typeof pickData.showDate === 'string'
          ? pickData.showDate
          : null;
    const joinedOn =
      typeof ctx.memberJoinedOn === 'string' && ctx.memberJoinedOn
        ? ctx.memberJoinedOn
        : null;
    if (!showDate || !joinedOn) return false;
    return showDate >= joinedOn;
  }

  if (hasSnapshot) return inSnapshot;
  return true;
}

/**
 * Resolve the membership calendar day for a uid from a pool's
 * `memberJoinedAt` map (ISO strings).
 *
 * @param {Record<string, unknown> | null | undefined} memberJoinedAt
 * @param {string} userId
 * @returns {string | null}
 */
export function memberJoinedOnForUser(memberJoinedAt, userId) {
  if (!userId?.trim() || !memberJoinedAt || typeof memberJoinedAt !== 'object') {
    return null;
  }
  return membershipCalendarDay(memberJoinedAt[userId]);
}

export async function updatePoolNameApi(poolId, newName) {
  const trimmed = newName?.trim() ?? '';
  if (!poolId?.trim()) throw new Error('Missing pool id.');
  if (!trimmed) throw new Error('Pool name is required.');
  if (trimmed.length > POOL_NAME_MAX_LENGTH) {
    throw new Error(`Pool name must be at most ${POOL_NAME_MAX_LENGTH} characters.`);
  }
  await updateDoc(
    doc(db, 'pools', poolId.trim()),
    stampBandId({ name: trimmed }),
  );
}

/**
 * @param {string} poolId
 * @param {'active' | 'archived'} status
 */
export async function updatePoolStatusApi(poolId, status) {
  if (!poolId?.trim()) throw new Error('Missing pool id.');
  if (status !== 'active' && status !== 'archived') {
    throw new Error('Invalid pool status.');
  }
  await updateDoc(doc(db, 'pools', poolId.trim()), stampBandId({ status }));
}
