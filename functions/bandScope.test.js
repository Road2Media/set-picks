const test = require("node:test");
const assert = require("node:assert/strict");
const { stampBandId, docBelongsToBand, DEFAULT_BAND_ID } = require("./bandScope");

test("stampBandId sets phish on a pick write and keeps an explicit id", () => {
  const pick = stampBandId({
    userId: "alice",
    showDate: "2026-04-23",
    score: 0,
    isGraded: false,
  });
  assert.equal(pick.bandId, "phish");
  assert.equal(pick.bandId, DEFAULT_BAND_ID);
  assert.equal(pick.userId, "alice");
  assert.equal(pick.showDate, "2026-04-23");
  assert.equal(Object.hasOwn(pick, "id"), false);

  const kept = stampBandId({ showDate: "2026-04-23", bandId: "goose" });
  assert.equal(kept.bandId, "goose");
});

test("stampBandId on a setlist and rollup payload fills a missing bandId", () => {
  const setlist = stampBandId({
    showDate: "2026-04-23",
    status: "LIVE",
    bandId: undefined,
  });
  assert.equal(setlist.bandId, "phish");

  const audit = stampBandId({ processedPicks: 1, trigger: "manual" });
  assert.equal(audit.bandId, "phish");
  assert.equal(audit.trigger, "manual");
});

test("docBelongsToBand treats a missing bandId as phish", () => {
  assert.equal(docBelongsToBand({ showDate: "2026-04-23" }), true);
  assert.equal(docBelongsToBand({ bandId: "phish" }), true);
  assert.equal(docBelongsToBand({ bandId: "goose" }), false);
  assert.equal(docBelongsToBand({ bandId: "" }), true);
});
