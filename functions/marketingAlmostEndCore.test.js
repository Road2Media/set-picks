"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isExcludedQaHandle,
  isExcludedQaUser,
  seasonStatsFromUser,
  battingAvg,
  formatBatting,
  assignCompetitionRanks,
  meanFieldPickingAvg,
  resolveBranch,
  buildPersonalTape,
  TOUR_KEY,
} = require("./marketingAlmostEndCore");

test("isExcludedQaHandle matches QA handles case-insensitively", () => {
  assert.equal(isExcludedQaHandle("QATester"), true);
  assert.equal(isExcludedQaHandle("mrpickphive"), true);
  assert.equal(isExcludedQaHandle("qamrwewy2t"), true);
  assert.equal(isExcludedQaHandle("Rivertranced"), false);
});

test("isExcludedQaUser matches qa / clouddev / test domains", () => {
  assert.equal(isExcludedQaUser("qa-e2e-test-uid", { handle: "friend" }), true);
  assert.equal(
    isExcludedQaUser("abc", { handle: "clouddevtester1", email: "x@y.com" }),
    true
  );
  assert.equal(
    isExcludedQaUser("abc", { handle: "Dummy", email: "qa.wave0@example.com" }),
    true
  );
  assert.equal(
    isExcludedQaUser("abc", { handle: "Rivertranced", email: "user@example.com" }),
    true
  );
  assert.equal(isExcludedQaUser("player", { handle: "Rivertranced" }), false);
});

test("seasonStatsFromUser requires shows ≥ 1", () => {
  assert.equal(seasonStatsFromUser({}), null);
  assert.equal(
    seasonStatsFromUser({ seasonStats: { [TOUR_KEY]: { shows: 0, totalPoints: 10 } } }),
    null
  );
  const stats = seasonStatsFromUser({
    seasonStats: { [TOUR_KEY]: { shows: 18, totalPoints: 385, wins: 5, correctSlots: 32 } },
  });
  assert.equal(stats.shows, 18);
  assert.equal(stats.totalPoints, 385);
  assert.equal(stats.correctSlots, 32);
});

test("battingAvg and formatBatting", () => {
  assert.ok(Math.abs(battingAvg(32, 18) - 32 / 108) < 1e-9);
  assert.equal(formatBatting(0.231), ".231");
  assert.equal(formatBatting(1), "1.000");
});

test("assignCompetitionRanks ties share rank on equal points", () => {
  const ranks = assignCompetitionRanks([
    { uid: "a", handle: "A", totalPoints: 100, wins: 1, shows: 10, correctSlots: 10 },
    { uid: "b", handle: "B", totalPoints: 100, wins: 0, shows: 10, correctSlots: 10 },
    { uid: "c", handle: "C", totalPoints: 50, wins: 0, shows: 10, correctSlots: 5 },
  ]);
  assert.equal(ranks.get("a").rank, 1);
  assert.equal(ranks.get("b").rank, 1); // competition rank ties on points
  assert.equal(ranks.get("c").rank, 3);
});

test("meanFieldPickingAvg averages per-player batting", () => {
  const mean = meanFieldPickingAvg([
    { shows: 10, correctSlots: 12 }, // 0.2
    { shows: 10, correctSlots: 24 }, // 0.4
  ]);
  assert.ok(Math.abs(mean - 0.3) < 1e-9);
});

test("resolveBranch covers rank and noPlay", () => {
  assert.equal(resolveBranch(1, 18), "rank1");
  assert.equal(resolveBranch(3, 18), "rank2to5");
  assert.equal(resolveBranch(6, 17), "rank6plusFull");
  assert.equal(resolveBranch(10, 5), "rank6plusSpot");
  assert.equal(resolveBranch(null, 0), "noPlay");
});

test("buildPersonalTape includes key stats per branch", () => {
  assert.match(
    buildPersonalTape({
      branch: "rank1",
      points: 385,
      wins: 5,
      showsPlayed: 18,
      avgPoints: 21.4,
    }),
    /#1 overall/
  );
  assert.match(
    buildPersonalTape({
      branch: "noPlay",
      fieldPickingAvg: 0.231,
    }),
    /\.231/
  );
});
