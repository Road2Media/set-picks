/**
 * Pure helpers for `rollupScoresForShow` (issue #244) — the "materialize
 * season aggregates" pass that writes `users.{uid}.wins`,
 * `users.{uid}.seasonStats.{tourKey}`, and idempotency metadata onto the
 * user doc so `computeUserSeasonStats` can short-circuit to a single point
 * read.
 *
 * Kept separate from `functions/index.js` for the same reason as
 * `poolDelete.js` / `scoringCore.js` / `backfillBustoutsCore.js`: unit
 * testable without spinning up the Functions harness, and reusable from
 * the one-time backfill script.
 *
 * Mirrors `src/shared/utils/showAggregation.js::reduceShowWinners`:
 *   - "winner of the night" uses the global max across every graded,
 *     non-empty pick for the show.
 *   - `max === 0` means nobody wins (empty-pick ties / hollow shows).
 *   - Ties share — every pick whose `score === max` is credited a win.
 *
 * Cannot import the client ESM module directly (functions are CommonJS),
 * so the rule is reimplemented here. Keep both copies aligned.
 *
 * @typedef {{
 *   picks?: unknown,
 *   isGraded?: boolean,
 *   score?: unknown,
 *   winCredited?: unknown,
 *   correctSlotsCredited?: unknown,
 *   userId?: unknown,
 * }} PickLike
 */

/**
 * Whether a `picks` map has at least one non-empty song string.
 *
 * Duplicated from `poolDelete.js::hasNonEmptyPicksObject` so this module
 * can be imported without pulling the pool-delete surface area.
 *
 * @param {unknown} picks
 * @returns {boolean}
 */
function hasNonEmptyPicksObject(picks) {
  if (picks == null || typeof picks !== "object" || Array.isArray(picks)) {
    return false;
  }
  return Object.values(picks).some(
    (v) => v != null && String(v).trim() !== ""
  );
}

/**
 * Eligibility gate for season-style aggregates (`totalPoints`, `shows`,
 * `wins`). Requires a graded pick with at least one non-empty slot.
 *
 * Mirrors `pickCountsTowardSeason` from `src/shared/utils/showAggregation.js`.
 *
 * @param {PickLike | null | undefined} pickData
 */
function pickCountsTowardSeason(pickData) {
  if (!pickData || pickData.isGraded !== true) return false;
  return hasNonEmptyPicksObject(pickData.picks);
}

/**
 * Global max score for a show across the supplied picks iterable. Returns
 * `null` when nobody is eligible or when the top score is `0` — no wins
 * are credited on a hollow show.
 *
 * `newScores` takes priority over the persisted `pick.score` so the rollup
 * pass can use the freshly-computed scores before the batch commit lands.
 *
 * @param {Iterable<PickLike & { id?: string }>} picks
 * @param {Map<string, number> | null | undefined} [newScores]  pickDoc.id → score
 * @returns {number | null}
 */
function computeGlobalMaxScore(picks, newScores) {
  let max = null;
  for (const p of picks) {
    if (!pickCountsTowardSeason(p)) continue;
    const override = newScores && p.id != null ? newScores.get(p.id) : undefined;
    const score =
      typeof override === "number"
        ? override
        : typeof p.score === "number"
        ? p.score
        : 0;
    if (max === null || score > max) max = score;
  }
  if (max === null || max <= 0) return null;
  return max;
}

/**
 * Resolve a pick's `tourKey` (the tour label used under
 * `users.{uid}.seasonStats.{tourKey}`) from `show_calendar.showDatesByTour`.
 *
 * Returns `null` when the show date isn't listed in the calendar; the
 * rollup skips the tour-scoped write in that case, logs an error, and
 * stamps `rollup_audit.tourKeyMissing` (#298). That means the calendar
 * snapshot is behind the grading pipeline, which should never happen in
 * steady state. Global totals still materialize. A later rollup that
 * finds the key clears the flag; it does not replay the skipped
 * first-grade `seasonStats` increments.
 *
 * @param {string} showDate  YYYY-MM-DD
 * @param {unknown} showDatesByTour
 * @returns {string | null}
 */
function resolveTourKeyForDate(showDate, showDatesByTour) {
  if (typeof showDate !== "string" || !showDate.trim()) return null;
  if (!Array.isArray(showDatesByTour)) return null;
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const tour = typeof group.tour === "string" ? group.tour.trim() : "";
    if (!tour) continue;
    const shows = group.shows;
    if (!Array.isArray(shows)) continue;
    for (const s of shows) {
      if (!s || typeof s !== "object") continue;
      if (typeof s.date === "string" && s.date.trim() === showDate) {
        return tour;
      }
    }
  }
  return null;
}

/**
 * Per-pick rollup decision for the `users.{uid}` materialization pass.
 *
 * `scoreDiff` is the delta to apply to `users.{uid}.totalPoints`:
 *   - **First grade** (`pickData.isGraded !== true`): we add the full
 *     `newScore`. The persisted `pick.score` may already be non-zero
 *     because `recomputeLiveScoresForShow` (live setlist scoring) writes
 *     `score` without flipping `isGraded`. Differencing against that
 *     pre-grade `pick.score` would zero out the contribution and leave
 *     `users.{uid}.totalPoints = 0` while `showsPlayed` keeps
 *     incrementing — the exact symptom seen in #254 follow-up.
 *   - **Re-grade** (`isGraded === true`): we diff against the previously
 *     persisted `pick.score` so re-finalizations are idempotent.
 *
 * `winsDelta` uses the persisted `pick.winCredited` flag to diff against
 * the previous rolled-up state, so re-finalizations never double-count
 * wins even when the global max changes.
 *
 * `correctSlotsDiff` (#554) mirrors wins: first grade credits the full
 * `newCorrectSlots` count; re-grade diffs against `pick.correctSlotsCredited`
 * (missing → 0). Empty picks still get `newCorrectSlots = 0` and do not
 * inflate `users.careerCorrectSlots` beyond the shows gate.
 *
 * @param {{
 *   pickData: PickLike,
 *   newScore: number,
 *   newGlobalMax: number | null,
 *   newCorrectSlots?: number,
 * }} input
 * @returns {{
 *   scoreDiff: number,
 *   isFirstGrade: boolean,
 *   newIsWin: boolean,
 *   oldIsWin: boolean,
 *   winsDelta: number,
 *   countsTowardSeason: boolean,
 *   newCorrectSlots: number,
 *   correctSlotsDiff: number,
 * }}
 */
function computePerPickRollup({
  pickData,
  newScore,
  newGlobalMax,
  newCorrectSlots = 0,
}) {
  const oldScore = typeof pickData?.score === "number" ? pickData.score : 0;
  const isFirstGrade = pickData?.isGraded !== true;
  const scoreDiff = isFirstGrade ? newScore : newScore - oldScore;

  const countsTowardSeason = hasNonEmptyPicksObject(pickData?.picks);
  const oldIsWin = pickData?.winCredited === true;
  const newIsWin =
    typeof newGlobalMax === "number" &&
    newGlobalMax > 0 &&
    countsTowardSeason &&
    newScore === newGlobalMax;
  const winsDelta = (newIsWin ? 1 : 0) - (oldIsWin ? 1 : 0);

  const creditedCorrect =
    typeof newCorrectSlots === "number" && Number.isFinite(newCorrectSlots)
      ? Math.max(0, Math.trunc(newCorrectSlots))
      : 0;
  const oldCorrectSlots =
    typeof pickData?.correctSlotsCredited === "number" &&
    Number.isFinite(pickData.correctSlotsCredited)
      ? Math.max(0, Math.trunc(pickData.correctSlotsCredited))
      : 0;
  const correctSlotsDiff = isFirstGrade
    ? creditedCorrect
    : creditedCorrect - oldCorrectSlots;

  return {
    scoreDiff,
    isFirstGrade,
    newIsWin,
    oldIsWin,
    winsDelta,
    countsTowardSeason,
    newCorrectSlots: creditedCorrect,
    correctSlotsDiff,
  };
}

module.exports = {
  computeGlobalMaxScore,
  computePerPickRollup,
  hasNonEmptyPicksObject,
  pickCountsTowardSeason,
  resolveTourKeyForDate,
};
