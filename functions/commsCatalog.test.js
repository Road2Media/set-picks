"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  TRIGGER_SPECS,
  getTriggerSpec,
  resolveDedupKey,
  interpolate,
} = require("./commsCatalog");

test("getTriggerSpec resolves known triggers and undefined otherwise", () => {
  assert.equal(getTriggerSpec("show_recap").templateId, "show-recap");
  assert.equal(getTriggerSpec("nope"), undefined);
});

test("interpolate replaces placeholders and blanks missing vars", () => {
  assert.equal(interpolate("a:{uid}:{showDate}", { uid: "u1", showDate: "2026-07-18" }), "a:u1:2026-07-18");
  assert.equal(interpolate("a:{uid}:{missing}", { uid: "u1" }), "a:u1:");
});

test("resolveDedupKey builds the per-trigger idempotency id", () => {
  assert.equal(
    resolveDedupKey("show_recap", { uid: "u1", showDate: "2026-07-18" }),
    "show_recap:u1:2026-07-18"
  );
  assert.equal(
    resolveDedupKey("picks_lock_reminder", { uid: "u1", showYmd: "2026-07-18" }),
    "reminder_2026-07-18_u1"
  );
  assert.equal(
    resolveDedupKey("tour_recap", { uid: "u1", tourId: "Summer Tour 2026" }),
    "tour_recap:Summer Tour 2026:u1"
  );
  assert.equal(
    resolveDedupKey("tour_recap", { uid: "u1", tourId: "2026/2027 NYE Run" }),
    "tour_recap:2026-2027 NYE Run:u1"
  );
});

test("TRIGGER_SPECS stays in sync with docs/comms-triggers/catalog.json", () => {
  const catalogPath = path.join(__dirname, "..", "docs", "comms-triggers", "catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const byId = new Map(catalog.triggers.map((t) => [t.triggerId, t]));

  for (const [triggerId, spec] of Object.entries(TRIGGER_SPECS)) {
    const row = byId.get(triggerId);
    assert.ok(row, `catalog.json missing trigger ${triggerId}`);
    assert.equal(spec.templateId, row.templateId, `${triggerId} templateId`);
    assert.deepEqual(spec.channels, row.channels, `${triggerId} channels`);
    assert.deepEqual(spec.prefKeys, row.prefKeys, `${triggerId} prefKeys`);
    assert.equal(spec.dedupKey, row.dedupKey, `${triggerId} dedupKey`);
    if (row.emailClass != null) {
      assert.equal(spec.emailClass, row.emailClass, `${triggerId} emailClass`);
    }
  }

  // Every non-shipped/planned production trigger should have a delivery spec.
  for (const row of catalog.triggers) {
    assert.ok(TRIGGER_SPECS[row.triggerId], `TRIGGER_SPECS missing ${row.triggerId}`);
  }
});
