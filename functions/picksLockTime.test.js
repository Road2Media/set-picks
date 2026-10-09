"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_PICKS_LOCK_HM,
  lockHmFromScheduledStart,
  resolvePicksLockHm,
} = require("./picksLockTime");

test("lockHmFromScheduledStart uses start+20", () => {
  assert.deepEqual(lockHmFromScheduledStart({ hour: 19, minute: 0 }), {
    hour: 19,
    minute: 20,
  });
});

test("resolvePicksLockHm seeds Merriweather and falls back", () => {
  assert.deepEqual(resolvePicksLockHm({ date: "2026-07-18" }), {
    hour: 19,
    minute: 20,
    source: "scheduledStart",
    scheduledStartLocal: "19:00",
    doorsLocal: "17:30",
  });
  assert.deepEqual(resolvePicksLockHm({ date: "2026-10-12" }), {
    hour: 19,
    minute: 20,
    source: "scheduledStart",
    scheduledStartLocal: "19:00",
    doorsLocal: "17:30",
  });
  assert.deepEqual(resolvePicksLockHm({ date: "2099-01-01" }), {
    ...DEFAULT_PICKS_LOCK_HM,
    source: "fallback",
    scheduledStartLocal: null,
    doorsLocal: null,
  });
});
