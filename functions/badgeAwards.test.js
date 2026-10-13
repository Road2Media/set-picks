const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  computeUnlockedBadgeIds,
  badgeIdsToAward,
} = require("./badgeAwards");

describe("computeUnlockedBadgeIds", () => {
  it("returns empty for zero / missing counters", () => {
    assert.deepEqual(computeUnlockedBadgeIds({}), []);
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 0, wins: 0 }), []);
  });

  it("unlocks shows_played thresholds", () => {
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 1 }), [
      "shows_played_1",
    ]);
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 5 }), [
      "shows_played_1",
      "shows_played_5",
    ]);
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 10 }), [
      "shows_played_1",
      "shows_played_5",
      "shows_played_10",
    ]);
  });

  it("unlocks the longer show and win ladders", () => {
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 25 }), [
      "shows_played_1",
      "shows_played_5",
      "shows_played_10",
      "shows_played_25",
    ]);
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 50, wins: 10 }), [
      "shows_played_1",
      "shows_played_5",
      "shows_played_10",
      "shows_played_25",
      "shows_played_50",
      "win_1",
      "win_5",
      "win_10",
    ]);
  });

  it("unlocks win_1 independently", () => {
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 0, wins: 1 }), [
      "win_1",
    ]);
    assert.deepEqual(computeUnlockedBadgeIds({ showsPlayed: 3, wins: 2 }), [
      "shows_played_1",
      "win_1",
    ]);
    assert.deepEqual(computeUnlockedBadgeIds({ wins: 5 }), ["win_1", "win_5"]);
  });

  it("unlocks point clubs at the threshold", () => {
    assert.deepEqual(computeUnlockedBadgeIds({ totalPoints: 499 }), []);
    assert.deepEqual(computeUnlockedBadgeIds({ totalPoints: 500 }), [
      "points_500",
    ]);
    assert.deepEqual(computeUnlockedBadgeIds({ totalPoints: 1000 }), [
      "points_500",
      "points_1000",
    ]);
  });

  it("unlocks anniversaries on the anniversary date, not the day before", () => {
    const createdAt = "2024-10-08T15:00:00.000Z";
    assert.deepEqual(
      computeUnlockedBadgeIds({ createdAt, asOfDate: "2025-10-07" }),
      []
    );
    assert.deepEqual(
      computeUnlockedBadgeIds({ createdAt, asOfDate: "2025-10-08" }),
      ["anniversary_1"]
    );
    assert.deepEqual(
      computeUnlockedBadgeIds({
        createdAt: { toDate: () => new Date("2023-10-08T15:00:00.000Z") },
        asOfDate: "2026-10-08",
      }),
      ["anniversary_1", "anniversary_2", "anniversary_3"]
    );
  });

  it("unlocks style picker only for a real favorite song", () => {
    assert.deepEqual(computeUnlockedBadgeIds({ favoriteSong: "Unknown" }), []);
    assert.deepEqual(computeUnlockedBadgeIds({ favoriteSong: "  " }), []);
    assert.deepEqual(computeUnlockedBadgeIds({ favoriteSong: "Tweezer" }), [
      "style_picker",
    ]);
  });
});

describe("badgeIdsToAward", () => {
  it("skips ids already present on the badges map", () => {
    assert.deepEqual(
      badgeIdsToAward(
        ["shows_played_1", "shows_played_5", "win_1"],
        {
          shows_played_1: { awardedAt: {}, scope: "career" },
        }
      ),
      ["shows_played_5", "win_1"]
    );
  });

  it("treats missing / null badges as empty", () => {
    assert.deepEqual(badgeIdsToAward(["win_1"], null), ["win_1"]);
    assert.deepEqual(badgeIdsToAward(["win_1"], undefined), ["win_1"]);
  });
});
