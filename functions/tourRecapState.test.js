"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TOUR_RECAP_STATE_COLLECTION,
  tourRecapStateDocId,
  isTerminalTourRecapStatus,
  readTourRecapState,
  writeTourRecapState,
  tourRecapFanoutCompleted,
} = require("./tourRecapState");

test("tourRecapStateDocId trims tour key", () => {
  assert.equal(tourRecapStateDocId("  2026 Summer Tour  "), "2026 Summer Tour");
  assert.equal(tourRecapStateDocId(""), "");
});

test("tourRecapStateDocId keeps legal ids and neutralizes path characters", () => {
  assert.equal(tourRecapStateDocId("Oct 25–27, 2024"), "Oct 25–27, 2024");
  assert.equal(tourRecapStateDocId("2026/2027 NYE Run"), "2026-2027 NYE Run");
  assert.equal(tourRecapStateDocId("."), "");
  assert.equal(tourRecapStateDocId(".."), "");
  assert.equal(tourRecapStateDocId("__reserved__"), "reserved");
});

test("isTerminalTourRecapStatus covers sent / skipped_archive / closed", () => {
  assert.equal(isTerminalTourRecapStatus({ status: "sent" }), true);
  assert.equal(isTerminalTourRecapStatus({ status: "skipped_archive" }), true);
  assert.equal(isTerminalTourRecapStatus({ status: "closed" }), true);
  assert.equal(isTerminalTourRecapStatus({ status: "pending" }), false);
  assert.equal(isTerminalTourRecapStatus(null), false);
});

test("tourRecapFanoutCompleted requires real deliveries", () => {
  assert.equal(tourRecapFanoutCompleted({ skipped: "no_eligible_players" }), false);
  assert.equal(tourRecapFanoutCompleted({ delivered: 0, processed: 10 }), false);
  assert.equal(tourRecapFanoutCompleted({ delivered: 3 }), true);
  assert.equal(
    tourRecapFanoutCompleted({ byChannel: { inApp: 2, email: 1, push: 0 } }),
    true
  );
});

test("read/writeTourRecapState round-trip on fake db", async () => {
  /** @type {Map<string, object>} */
  const docs = new Map();
  const db = {
    collection(name) {
      assert.equal(name, TOUR_RECAP_STATE_COLLECTION);
      return {
        doc(id) {
          return {
            async get() {
              const data = docs.get(id);
              return {
                exists: Boolean(data),
                data: () => data,
              };
            },
            async set(payload, opts) {
              assert.equal(opts?.merge, true);
              const prev = docs.get(id) || {};
              docs.set(id, { ...prev, ...payload });
            },
          };
        },
      };
    },
  };
  const admin = {
    firestore: {
      FieldValue: { serverTimestamp: () => "TS" },
    },
  };

  const empty = await readTourRecapState({ db, tourKey: "2026 Summer Tour" });
  assert.equal(empty.terminal, false);

  await writeTourRecapState({
    db,
    admin,
    tourKey: "2026 Summer Tour",
    status: "sent",
    finalDate: "2026-09-06",
    source: "seed",
  });

  const after = await readTourRecapState({ db, tourKey: "2026 Summer Tour" });
  assert.equal(after.terminal, true);
  assert.equal(after.data.status, "sent");
  assert.equal(after.data.finalDate, "2026-09-06");
  assert.equal(after.data.source, "seed");
});
