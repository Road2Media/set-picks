"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSeasonAggregateUserPatch } = require("./backfillSeasonAggregates");

test("buildSeasonAggregateUserPatch deletes legacy stats and keeps season fields (#298)", () => {
  const ts = { op: "serverTimestamp" };
  const deleted = { op: "delete" };
  const seasonStats = {
    "Sphere Run": { totalPoints: 40, shows: 2, wins: 1, correctSlots: 8 },
  };
  const patch = buildSeasonAggregateUserPatch(
    {
      totalPoints: 40,
      shows: 2,
      wins: 1,
      careerCorrectSlots: 8,
      latestShow: "2026-04-18",
      seasonStats,
    },
    {
      serverTimestamp: () => ts,
      delete: () => deleted,
    }
  );

  assert.equal(patch.stats, deleted);
  assert.equal(patch.totalPoints, 40);
  assert.equal(patch.showsPlayed, 2);
  assert.equal(patch.wins, 1);
  assert.equal(patch.careerCorrectSlots, 8);
  assert.equal(patch.seasonStatsThroughShow, "2026-04-18");
  assert.equal(patch.seasonStatsSnapshotAt, ts);
  assert.equal(patch.seasonStats, seasonStats);
});
