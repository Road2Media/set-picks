const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeGlobalMaxScore,
  computePerPickRollup,
  hasNonEmptyPicksObject,
  pickCountsTowardSeason,
  resolveTourKeyForDate,
} = require("./rollupSeasonAggregates");

test("hasNonEmptyPicksObject: false for null/empty/whitespace", () => {
  assert.equal(hasNonEmptyPicksObject(null), false);
  assert.equal(hasNonEmptyPicksObject({}), false);
  assert.equal(hasNonEmptyPicksObject([]), false);
  assert.equal(hasNonEmptyPicksObject({ s1o: "  " }), false);
  assert.equal(hasNonEmptyPicksObject({ s1o: "Bag" }), true);
});

test("pickCountsTowardSeason: requires isGraded=true AND non-empty picks", () => {
  assert.equal(pickCountsTowardSeason({ picks: { s1o: "Bag" } }), false);
  assert.equal(
    pickCountsTowardSeason({ picks: { s1o: "Bag" }, isGraded: false }),
    false
  );
  assert.equal(
    pickCountsTowardSeason({ picks: { s1o: "Bag" }, isGraded: true }),
    true
  );
  assert.equal(
    pickCountsTowardSeason({ picks: {}, isGraded: true }),
    false
  );
});

test("computeGlobalMaxScore: ignores ungraded / empty picks", () => {
  const max = computeGlobalMaxScore([
    { picks: { s1o: "A" }, isGraded: false, score: 40 },
    { picks: { s1o: "B" }, isGraded: true, score: 25 },
    { picks: {}, isGraded: true, score: 30 },
    { picks: { s1o: "C" }, isGraded: true, score: 15 },
  ]);
  assert.equal(max, 25);
});

test("computeGlobalMaxScore: returns null when nobody eligible", () => {
  assert.equal(computeGlobalMaxScore([]), null);
  assert.equal(
    computeGlobalMaxScore([
      { picks: { s1o: "A" }, isGraded: false, score: 40 },
      { picks: {}, isGraded: true, score: 40 },
    ]),
    null
  );
});

test("computeGlobalMaxScore: returns null on hollow show (max === 0)", () => {
  const max = computeGlobalMaxScore([
    { picks: { s1o: "A" }, isGraded: true, score: 0 },
    { picks: { s1o: "B" }, isGraded: true, score: 0 },
  ]);
  assert.equal(max, null);
});

test("computeGlobalMaxScore: uses newScores override when provided", () => {
  const picks = [
    { id: "2026-04-23_u1", picks: { s1o: "A" }, isGraded: true, score: 10 },
    { id: "2026-04-23_u2", picks: { s1o: "B" }, isGraded: true, score: 5 },
    { id: "2026-04-23_u3", picks: { s1o: "C" }, isGraded: true, score: 8 },
  ];
  const overrides = new Map([
    ["2026-04-23_u1", 10],
    ["2026-04-23_u2", 22],
    ["2026-04-23_u3", 8],
  ]);
  assert.equal(computeGlobalMaxScore(picks, overrides), 22);
});

test("computeGlobalMaxScore: ties share by returning the shared max", () => {
  const max = computeGlobalMaxScore([
    { picks: { s1o: "A" }, isGraded: true, score: 30 },
    { picks: { s1o: "B" }, isGraded: true, score: 30 },
    { picks: { s1o: "C" }, isGraded: true, score: 25 },
  ]);
  assert.equal(max, 30);
});

test("resolveTourKeyForDate: finds the tour group containing the date", () => {
  const byTour = [
    {
      tour: "Sphere Run",
      shows: [
        { date: "2026-04-16", venue: "Sphere" },
        { date: "2026-04-17", venue: "Sphere" },
      ],
    },
    {
      tour: "Summer Tour",
      shows: [{ date: "2026-07-07", venue: "Kohl" }],
    },
  ];
  assert.equal(resolveTourKeyForDate("2026-04-17", byTour), "Sphere Run");
  assert.equal(resolveTourKeyForDate("2026-07-07", byTour), "Summer Tour");
});

test("resolveTourKeyForDate: returns null for missing / invalid inputs", () => {
  assert.equal(resolveTourKeyForDate("", []), null);
  assert.equal(resolveTourKeyForDate("2026-04-17", null), null);
  assert.equal(
    resolveTourKeyForDate("2026-04-17", [
      { tour: "Other", shows: [{ date: "2026-05-01", venue: "v" }] },
    ]),
    null
  );
});

test("computePerPickRollup: scoreDiff tracks new - old (works on re-run)", () => {
  const plan = computePerPickRollup({
    pickData: { picks: { s1o: "A" }, isGraded: true, score: 15 },
    newScore: 20,
    newGlobalMax: 25,
  });
  assert.equal(plan.scoreDiff, 5);
  assert.equal(plan.isFirstGrade, false);
});

test("computePerPickRollup: isFirstGrade=true when pick hasn't been graded", () => {
  const plan = computePerPickRollup({
    pickData: { picks: { s1o: "A" } },
    newScore: 20,
    newGlobalMax: 30,
  });
  assert.equal(plan.scoreDiff, 20);
  assert.equal(plan.isFirstGrade, true);
});

test("computePerPickRollup: first-grade adds full newScore even when pick.score is already populated by live scoring", () => {
  // Regression for the #254 follow-up bug: `recomputeLiveScoresForShow`
  // writes `pick.score` without flipping `isGraded`, so by the time the
  // rollup pass runs the persisted score equals what we just recomputed.
  // Differencing against it would leave `users.{uid}.totalPoints` at 0
  // while `showsPlayed` keeps incrementing on every first grade. The
  // first-grade branch must add the full newScore.
  const plan = computePerPickRollup({
    pickData: {
      picks: { s1o: "A" },
      isGraded: false,
      score: 15,
    },
    newScore: 15,
    newGlobalMax: 25,
  });
  assert.equal(plan.scoreDiff, 15);
  assert.equal(plan.isFirstGrade, true);
});

test("computePerPickRollup: winsDelta=+1 when newly winning (first grade)", () => {
  const plan = computePerPickRollup({
    pickData: { picks: { s1o: "A" } },
    newScore: 30,
    newGlobalMax: 30,
  });
  assert.equal(plan.newIsWin, true);
  assert.equal(plan.oldIsWin, false);
  assert.equal(plan.winsDelta, 1);
});

test("computePerPickRollup: winsDelta=0 on re-grade when still winning (already credited)", () => {
  const plan = computePerPickRollup({
    pickData: {
      picks: { s1o: "A" },
      isGraded: true,
      score: 30,
      winCredited: true,
    },
    newScore: 30,
    newGlobalMax: 30,
  });
  assert.equal(plan.newIsWin, true);
  assert.equal(plan.oldIsWin, true);
  assert.equal(plan.winsDelta, 0);
});

test("computePerPickRollup: winsDelta=-1 when losing a previously credited win", () => {
  // Re-finalize with a corrected setlist that drops this user's score below the new max.
  const plan = computePerPickRollup({
    pickData: {
      picks: { s1o: "A" },
      isGraded: true,
      score: 30,
      winCredited: true,
    },
    newScore: 20,
    newGlobalMax: 25,
  });
  assert.equal(plan.newIsWin, false);
  assert.equal(plan.oldIsWin, true);
  assert.equal(plan.winsDelta, -1);
});

test("computePerPickRollup: empty pick cannot be a winner even when score matches max", () => {
  // Score can be 0 for empty picks and would tie a hollow show;
  // computeGlobalMaxScore already returns null there, but defend the
  // pick-side check too. Non-zero empty picks don't physically exist
  // (score requires slot-level guesses) but the gate guarantees no
  // accidental wins.
  const plan = computePerPickRollup({
    pickData: { picks: {}, isGraded: true },
    newScore: 0,
    newGlobalMax: 0,
  });
  assert.equal(plan.newIsWin, false);
  assert.equal(plan.winsDelta, 0);
});

test("computePerPickRollup: zero globalMax (hollow show) credits nobody", () => {
  const plan = computePerPickRollup({
    pickData: { picks: { s1o: "A" }, isGraded: true },
    newScore: 0,
    newGlobalMax: 0,
  });
  assert.equal(plan.newIsWin, false);
});

test("computePerPickRollup: null globalMax (no eligible picks) credits nobody", () => {
  const plan = computePerPickRollup({
    pickData: { picks: { s1o: "A" }, isGraded: true },
    newScore: 10,
    newGlobalMax: null,
  });
  assert.equal(plan.newIsWin, false);
});

test("computePerPickRollup: first-grade credits full newCorrectSlots", () => {
  const plan = computePerPickRollup({
    pickData: { picks: { s1o: "A" } },
    newScore: 20,
    newGlobalMax: 30,
    newCorrectSlots: 3,
  });
  assert.equal(plan.newCorrectSlots, 3);
  assert.equal(plan.correctSlotsDiff, 3);
});

test("computePerPickRollup: re-grade diffs correctSlotsCredited", () => {
  const plan = computePerPickRollup({
    pickData: {
      picks: { s1o: "A" },
      isGraded: true,
      score: 20,
      correctSlotsCredited: 2,
    },
    newScore: 25,
    newGlobalMax: 30,
    newCorrectSlots: 4,
  });
  assert.equal(plan.correctSlotsDiff, 2);
});

test("computePerPickRollup: missing correctSlotsCredited on re-grade treats old as 0", () => {
  const plan = computePerPickRollup({
    pickData: {
      picks: { s1o: "A" },
      isGraded: true,
      score: 20,
    },
    newScore: 20,
    newGlobalMax: 30,
    newCorrectSlots: 2,
  });
  assert.equal(plan.correctSlotsDiff, 2);
});

test("computePerPickRollup: bustout boosts diff is regrade-safe (#1115)", () => {
  const first = computePerPickRollup({
    pickData: { picks: { s1o: "Tweezer" } },
    newScore: 30,
    newGlobalMax: 30,
    newBustoutBoosts: 2,
  });
  assert.equal(first.newBustoutBoosts, 2);
  assert.equal(first.bustoutBoostsDiff, 2);

  const same = computePerPickRollup({
    pickData: {
      picks: { s1o: "Tweezer" },
      isGraded: true,
      bustoutBoostsCredited: 2,
    },
    newScore: 30,
    newGlobalMax: 30,
    newBustoutBoosts: 2,
  });
  assert.equal(same.bustoutBoostsDiff, 0);

  const dropped = computePerPickRollup({
    pickData: {
      picks: { s1o: "Tweezer" },
      isGraded: true,
      bustoutBoostsCredited: 2,
    },
    newScore: 10,
    newGlobalMax: 30,
    newBustoutBoosts: 1,
  });
  assert.equal(dropped.bustoutBoostsDiff, -1);

  const empty = computePerPickRollup({
    pickData: { picks: {}, isGraded: true, bustoutBoostsCredited: 2 },
    newScore: 0,
    newGlobalMax: 10,
    newBustoutBoosts: 2,
  });
  assert.equal(empty.newBustoutBoosts, 0);
  assert.equal(empty.bustoutBoostsDiff, -2);
});

// Keep #1004 writer tests on the functions `npm test` file list.
require("./globalStatsLeaderboards.test");
