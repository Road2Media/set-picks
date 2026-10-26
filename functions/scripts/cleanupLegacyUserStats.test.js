"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  legacyStatsDeletePatch,
  selectLegacyStatsUserIds,
  userDocHasLegacyStats,
} = require("./cleanupLegacyUserStats");

test("userDocHasLegacyStats is true only when the field is present (#298)", () => {
  assert.equal(userDocHasLegacyStats(null), false);
  assert.equal(userDocHasLegacyStats(undefined), false);
  assert.equal(userDocHasLegacyStats({ handle: "fan" }), false);
  assert.equal(
    userDocHasLegacyStats({ stats: { showsPlayed: 0, totalPoints: 0 } }),
    true
  );
  assert.equal(userDocHasLegacyStats({ stats: null }), true);
});

test("selectLegacyStatsUserIds skips docs that never had the blob", () => {
  assert.deepEqual(
    selectLegacyStatsUserIds([
      { id: "launch", data: { stats: { showsPlayed: 0, totalPoints: 0 }, handle: "a" } },
      { id: "current", data: { handle: "b", totalPoints: 12 } },
      { id: "", data: { stats: { showsPlayed: 0 } } },
      { id: "explicit-null", data: { stats: null } },
    ]),
    ["launch", "explicit-null"]
  );
});

test("legacyStatsDeletePatch names only stats", () => {
  const deleted = { op: "delete" };
  const patch = legacyStatsDeletePatch({ delete: () => deleted });
  assert.deepEqual(patch, { stats: deleted });
  assert.deepEqual(Object.keys(patch), ["stats"]);
});
