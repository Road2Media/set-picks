/**
 * Scorecard v1 surface states (#767).
 *
 * @typedef {'empty' | 'pre_lock' | 'locked_ungraded' | 'graded'} ScorecardState
 */

/**
 * @param {{
 *   hasPicks: boolean,
 *   isLocked: boolean,
 *   hasSetlist: boolean,
 * }} args
 * @returns {ScorecardState}
 */
export function resolveScorecardState({ hasPicks, isLocked, hasSetlist }) {
  if (!hasPicks) return 'empty';
  if (!isLocked) return 'pre_lock';
  if (!hasSetlist) return 'locked_ungraded';
  return 'graded';
}

/**
 * Overlap (“N players also picked this”) is post-lock only — LIVE / PAST or
 * admin-locked NEXT. Pre-lock never exposes other players’ cards.
 *
 * @param {ScorecardState} state
 */
export function scorecardShowsOverlap(state) {
  return state === 'locked_ungraded' || state === 'graded';
}

/**
 * Rank / points row: pending copy once locked; numbers after the setlist lands.
 *
 * @param {ScorecardState} state
 */
export function scorecardShowsRank(state) {
  return state === 'locked_ungraded' || state === 'graded';
}

/**
 * Live crowd % on the scorecard (#1043). Same disclosure window as crowd
 * lean: after showtime only (`LIVE` / `PAST`). An admin lock that is still
 * `NEXT` does not unlock it. Hide crowd pulse is applied by the caller.
 *
 * @param {string | null | undefined} showStatus
 */
export function scorecardShowsCrowdShare(showStatus) {
  return showStatus === 'LIVE' || showStatus === 'PAST';
}
