"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SCORING_LADDER_V2_EFFECTIVE_DATE,
  attachScoringShowDate,
  calculateSlotScore,
  calculateTotalScore,
  countBustoutBoosts,
  setlistHasAnyPlayedSong,
  actualSetlistFromOfficialDoc,
  persistableActualSetlistFromOfficialDoc,
  shouldSkipLiveScoreRecompute,
  slotScoreBreakdown,
} = require("./scoringCore");

test("setlistHasAnyPlayedSong: false when all slots empty and no ordered list", () => {
  const doc = {
    setlist: { s1o: "", s1c: "", s2o: "", s2c: "", enc: "" },
    officialSetlist: [],
  };
  assert.equal(setlistHasAnyPlayedSong(actualSetlistFromOfficialDoc(doc)), false);
});

test("setlistHasAnyPlayedSong: true when a slot has a song", () => {
  const doc = {
    setlist: { s1o: "Fee", s1c: "", s2o: "", s2c: "", enc: "" },
    officialSetlist: [],
  };
  assert.equal(setlistHasAnyPlayedSong(actualSetlistFromOfficialDoc(doc)), true);
});

test("setlistHasAnyPlayedSong: true when ordered official list only", () => {
  const doc = {
    setlist: { s1o: "", s1c: "", s2o: "", s2c: "", enc: "" },
    officialSetlist: ["Tweezer"],
  };
  assert.equal(setlistHasAnyPlayedSong(actualSetlistFromOfficialDoc(doc)), true);
});

test("persistableActualSetlistFromOfficialDoc: ignores junk slot keys not in SCORE_FIELDS", () => {
  const doc = {
    setlist: {
      s1o: "",
      s1c: "",
      s2o: "",
      s2c: "",
      enc: "",
      wild: "",
      junkSlot: "Ghost",
    },
    officialSetlist: [],
  };
  assert.equal(setlistHasAnyPlayedSong(actualSetlistFromOfficialDoc(doc)), true);
  assert.equal(setlistHasAnyPlayedSong(persistableActualSetlistFromOfficialDoc(doc)), false);
});

test("shouldSkipLiveScoreRecompute: true when only non-scoring metadata changes", () => {
  const playable = {
    setlist: { s1o: "Fee", s1c: "", s2o: "", s2c: "", enc: "", wild: "" },
    officialSetlist: ["Fee"],
  };
  const before = { ...playable, updatedAt: "t1", source: "phishnet" };
  const after = { ...playable, updatedAt: "t2", source: "admin", notes: "typo fix" };
  assert.equal(shouldSkipLiveScoreRecompute(before, after), true);
});

test("shouldSkipLiveScoreRecompute: false when a scored slot changes", () => {
  const before = {
    setlist: { s1o: "Fee", s1c: "", s2o: "", s2c: "", enc: "", wild: "" },
    officialSetlist: ["Fee"],
  };
  const after = {
    setlist: { s1o: "Ghost", s1c: "", s2o: "", s2c: "", enc: "", wild: "" },
    officialSetlist: ["Ghost"],
  };
  assert.equal(shouldSkipLiveScoreRecompute(before, after), false);
});

test("countBustoutBoosts: counts a hit on a bustout and skips a miss", () => {
  const setlist = {
    s1o: "Tweezer",
    s1c: "Reba",
    s2o: "",
    s2c: "",
    enc: "",
    wild: "",
    officialSetlist: ["Tweezer", "Reba"],
    bustouts: ["Tweezer"],
  };
  assert.equal(
    countBustoutBoosts({ s1o: "Tweezer", s1c: "Reba", wild: "Tweezer" }, setlist),
    2
  );
  assert.equal(countBustoutBoosts({ s1o: "Ghost" }, setlist), 0);
  assert.equal(
    countBustoutBoosts({ s1o: "Tweezer" }, { ...setlist, bustouts: [] }),
    0
  );
});

test("scoring ladder (#1086): undated and pre-tour nights stay on v1", () => {
  const actual = {
    s1o: "A",
    enc: "First",
    encoreSongs: ["First", "Later"],
    officialSetlist: ["A", "First", "Later", "Wild"],
  };
  assert.equal(calculateSlotScore("wild", "Wild", actual), 10);
  assert.equal(calculateSlotScore("enc", "Later", actual), 15);
  assert.equal(slotScoreBreakdown("enc", "Later", actual).kind, "encore_exact");
  const fall = attachScoringShowDate(actual, "2026-10-11");
  assert.equal(calculateTotalScore({ enc: "Later", wild: "Wild" }, fall), 25);
  assert.equal(
    calculateSlotScore("wild", "Wild", attachScoringShowDate(actual, "2026-12-29")),
    10
  );
});

test("scoring ladder (#1086): New Year's Run nights use wildcard 5 and later encore 10", () => {
  const actual = attachScoringShowDate(
    {
      s1o: "A",
      s1c: "B",
      enc: "First",
      encoreSongs: ["First", "Later"],
      officialSetlist: ["A", "B", "First", "Later", "Wild"],
      bustouts: ["Wild", "Later"],
    },
    SCORING_LADDER_V2_EFFECTIVE_DATE
  );
  assert.equal(calculateSlotScore("wild", "Wild", actual), 25);
  assert.equal(calculateSlotScore("enc", "First", actual), 15);
  assert.equal(calculateSlotScore("enc", "Later", actual), 30);
  assert.equal(slotScoreBreakdown("enc", "Later", actual).kind, "encore_later");
  assert.equal(calculateSlotScore("enc", "A", actual), 5);
  assert.equal(calculateSlotScore("s1o", "A", actual), 10);
  assert.equal(calculateSlotScore("s1c", "A", actual), 5);
  assert.equal(
    calculateTotalScore({ s1o: "A", enc: "Later", wild: "Wild" }, { ...actual, bustouts: [] }),
    10 + 10 + 5
  );
  assert.equal(calculateSlotScore("wild", SCORING_LADDER_V2_EFFECTIVE_DATE, actual), 0);
});

test("shouldSkipLiveScoreRecompute: false on first write (no before doc)", () => {
  const after = {
    setlist: { s1o: "Fee", s1c: "", s2o: "", s2c: "", enc: "", wild: "" },
    officialSetlist: ["Fee"],
  };
  assert.equal(shouldSkipLiveScoreRecompute(null, after), false);
});
