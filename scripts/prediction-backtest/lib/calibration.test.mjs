/**
 * playProb calibration unit tests (#1002).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  addPairs,
  emptyCalibration,
  finishCalibration,
  pairsFromRanking,
  playProbTopShare,
} from "./calibration.mjs";

test("pairsFromRanking marks played songs and optional unseen floor", () => {
  const ranked = [
    { songKey: "tweezer", playProb: 0.8 },
    { songKey: "ghost", playProb: 0.2 },
  ];
  const scored = pairsFromRanking(ranked, ["Tweezer", "Harry Hood"]);
  assert.equal(scored.length, 2);
  assert.equal(scored[0].y, 1);
  assert.equal(scored[1].y, 0);

  const withFloor = pairsFromRanking(ranked, ["Tweezer", "Harry Hood"], {
    unseenFloor: 0.01,
  });
  assert.equal(withFloor.length, 3);
  const hood = withFloor.find((row) => row.songKey === "harry hood");
  assert.equal(hood.p, 0.01);
  assert.equal(hood.y, 1);
  assert.equal(hood.unseen, true);
});

test("brier is zero for perfect probabilities and matches a known miss", () => {
  const acc = emptyCalibration();
  addPairs(acc, [
    { p: 1, y: 1 },
    { p: 0, y: 0 },
  ]);
  const perfect = finishCalibration(acc);
  assert.equal(perfect.brier, 0);

  const miss = emptyCalibration();
  addPairs(miss, [{ p: 0.25, y: 1 }]);
  const done = finishCalibration(miss);
  assert.equal(done.brier, 0.5625);
  assert.equal(done.bins.find((bin) => bin.label.startsWith("20")).n, 1);
});

test("playProbTopShare rises when one song holds the mass", () => {
  const flat = playProbTopShare(
    [
      { playProb: 0.2 },
      { playProb: 0.2 },
      { playProb: 0.2 },
      { playProb: 0.2 },
    ],
    1
  );
  const peaked = playProbTopShare(
    [
      { playProb: 0.9 },
      { playProb: 0.02 },
      { playProb: 0.02 },
      { playProb: 0.02 },
    ],
    1
  );
  assert.ok(peaked > flat);
});
