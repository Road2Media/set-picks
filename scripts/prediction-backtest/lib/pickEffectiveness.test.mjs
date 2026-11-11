/**
 * Player-card comparison math (#1002). No network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { summarizePickNight } from "./pickEffectiveness.mjs";

test("summarizePickNight counts hits, misses, and top-1 adoption", () => {
  const night = summarizePickNight({
    cards: [
      { picks: { s1o: "Alpha", s1c: "Beta", wild: "Gamma" } },
      { picks: { s1o: "Alpha", s1c: "Miss", wild: "Gamma" } },
    ],
    playRanked: [
      { songKey: "alpha", playProb: 0.7 },
      { songKey: "beta", playProb: 0.4 },
      { songKey: "gamma", playProb: 0.1 },
      { songKey: "miss", playProb: 0.05 },
    ],
    rankedBySlot: {
      s1o: [{ songKey: "alpha" }],
      s1c: [{ songKey: "other" }],
      s2o: [{ songKey: "alpha" }],
      s2c: [{ songKey: "beta" }],
      enc: [{ songKey: "gamma" }],
      wild: [{ songKey: "alpha" }],
    },
    playedTitles: ["Alpha", "Beta", "Gamma"],
    slotLabels: { s1o: "Alpha", s1c: "Beta", s2o: "Zed", s2c: "Beta", enc: "Gamma" },
  });

  assert.equal(night.cards, 2);
  assert.equal(night.zeroScoreCards, 0);
  assert.equal(night.exactHits, 3);
  assert.equal(night.top1Matches, 2);
  assert.equal(night.maxSongCardShare, 1);
  assert.ok(night.meanCardRecall > 0.5);
  assert.equal(night.modelExact, 3);
  assert.equal(night.modelZeroScore, 0);
});

test("empty picks are ignored", () => {
  const night = summarizePickNight({
    cards: [{ picks: {} }, { picks: { s1o: "   " } }, { picks: { s1o: "Alpha" } }],
    playRanked: [{ songKey: "alpha", playProb: 0.5 }],
    rankedBySlot: { s1o: [{ songKey: "alpha" }] },
    playedTitles: ["Alpha"],
    slotLabels: { s1o: "Alpha" },
  });
  assert.equal(night.cards, 1);
  assert.equal(night.exactHits, 1);
});
