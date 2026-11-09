"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LIVE_RANK_POLICY,
  RANK_POLICIES,
  rankScoredRows,
} = require("./pointsTieRanking.cjs");

const BOARD = [
  { uid: "c", handle: "Cara", points: 10, exactHits: 1, correctPicks: 2, wins: 0 },
  { uid: "a", handle: "Ada", points: 10, exactHits: 2, correctPicks: 2, wins: 1 },
  { uid: "b", handle: "Bea", points: 10, exactHits: 2, correctPicks: 4, wins: 3 },
  { uid: "d", handle: "Dee", points: 4, exactHits: 0, correctPicks: 1, wins: 1 },
];

test("live policy is full tie-break and the other two policies stay available", () => {
  assert.equal(LIVE_RANK_POLICY, RANK_POLICIES.FULL);
  assert.equal(rankScoredRows([]).rows.length, 0);
  assert.equal(rankScoredRows([{ uid: "a", handle: "Ada", points: 1 }]).rows[0].rank, 1);

  const full = rankScoredRows(BOARD);
  assert.deepEqual(
    full.rows.map((row) => row.handle),
    ["Bea", "Ada", "Cara", "Dee"]
  );
  assert.deepEqual(
    full.rows.map((row) => row.rank),
    [1, 2, 3, 4]
  );

  const shared = rankScoredRows(BOARD, { policy: RANK_POLICIES.SHARED });
  assert.deepEqual(
    shared.rows.map((row) => row.rank),
    [1, 1, 1, 4]
  );
  assert.equal(shared.rows[0].tieBreak.decisive, null);

  const display = rankScoredRows(BOARD, { policy: RANK_POLICIES.SHARED_DISPLAY });
  assert.deepEqual(
    display.rows.map((row) => row.rank),
    [1, 1, 1, 4]
  );
  assert.equal(display.rows[1].tieBreak.decisive, "correctPicks");
  assert.equal(display.rows[1].rank, 1);
});

test("a tie that survives the cascade shares a rank in uid order", () => {
  const rows = [
    { uid: "b", handle: "Same", totalPoints: 10, exactHits: 1, correctPicks: 1, wins: 0 },
    { uid: "a", handle: "Same", totalPoints: 10, exactHits: 1, correctPicks: 1, wins: 0 },
  ];
  const ranked = rankScoredRows(rows, { surface: "year" });
  assert.deepEqual(
    ranked.rows.map((row) => row.uid),
    ["a", "b"]
  );
  assert.deepEqual(
    ranked.rows.map((row) => row.rank),
    [1, 1]
  );
  assert.equal(ranked.unresolvedTieCount, 1);
  assert.equal(ranked.rows[1].tieBreak.stillTied, true);
});

test("a show skips nightly wins", () => {
  const rows = [
    { uid: "a", handle: "Ada", points: 10, exactHits: 1, correctPicks: 2, wins: 0 },
    { uid: "b", handle: "Bea", points: 10, exactHits: 1, correctPicks: 2, wins: 4 },
  ];
  const show = rankScoredRows(rows, { surface: "show" });
  assert.deepEqual(
    show.rows.map((row) => row.handle),
    ["Ada", "Bea"]
  );
  assert.equal(show.rows[1].tieBreak.decisive, "username");
  const tour = rankScoredRows(rows, { surface: "tour" });
  assert.deepEqual(
    tour.rows.map((row) => row.handle),
    ["Bea", "Ada"]
  );
  assert.equal(tour.rows[1].tieBreak.decisive, "nightlyWins");
});
