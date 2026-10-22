"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROCESS_STATE_COLLECTION,
  TOUR_RECAP_PROCESS_SEEDS,
  processDocId,
  automatedFanoutBlock,
  readProcessState,
  writeProcessState,
} = require("./commsProcessState");
const { TOUR_RECAP_STATE_COLLECTION } = require("./tourRecapState");

/**
 * @param {Map<string, Map<string, object>>} collections
 */
function fakeDb(collections) {
  return {
    collection(name) {
      if (!collections.has(name)) collections.set(name, new Map());
      const docs = collections.get(name);
      return {
        doc(id) {
          return {
            async get() {
              const data = docs.get(id);
              return { exists: Boolean(data), data: () => data || null };
            },
            async set(payload, opts) {
              assert.equal(opts?.merge, true);
              docs.set(id, { ...(docs.get(id) || {}), ...payload });
            },
          };
        },
      };
    },
  };
}

const admin = {
  firestore: { FieldValue: { serverTimestamp: () => "TS" } },
};

test("process ids keep the trigger and replace slashes in the scope", () => {
  assert.equal(processDocId("tour_recap", "2026 Summer Tour"), "tour_recap:2026 Summer Tour");
  assert.equal(processDocId("tour_recap", "2026/2027 NYE Run"), "tour_recap:2026-2027 NYE Run");
  assert.equal(processDocId("show_recap", "2026-05-02"), "show_recap:2026-05-02");
});

test("archive edition and terminal process block; a sent tour does not block show_recap", () => {
  assert.equal(automatedFanoutBlock({ editionStatus: "archive" }), "edition_status");
  assert.equal(automatedFanoutBlock({ editionStatus: "closed" }), "edition_status");
  assert.equal(automatedFanoutBlock({ processTerminal: true }), "process_terminal");
  assert.equal(automatedFanoutBlock({ relatedStatus: "skipped_archive" }), "tour_process");
  assert.equal(automatedFanoutBlock({ relatedStatus: "closed" }), "tour_process");
  assert.equal(automatedFanoutBlock({ relatedStatus: "sent", editionStatus: "live" }), null);
  assert.equal(automatedFanoutBlock({}), null);
});

test("seeded tour_recap sent is terminal on the ledger and the legacy mirror", async () => {
  const collections = new Map();
  const db = fakeDb(collections);
  await writeProcessState({
    db,
    admin,
    triggerId: "tour_recap",
    scope: "2026 Summer Tour",
    status: "sent",
    finalDate: "2026-09-06",
    source: "seed",
  });
  const ledger = collections.get(PROCESS_STATE_COLLECTION);
  const legacy = collections.get(TOUR_RECAP_STATE_COLLECTION);
  assert.equal(ledger.get("tour_recap:2026 Summer Tour").status, "sent");
  assert.equal(legacy.get("2026 Summer Tour").status, "sent");

  const state = await readProcessState({
    db,
    triggerId: "tour_recap",
    scope: "2026 Summer Tour",
  });
  assert.equal(state.terminal, true);
  assert.equal(state.data.status, "sent");
});

test("legacy skipped_archive still blocks when the new ledger doc is absent", async () => {
  const collections = new Map();
  collections.set(
    TOUR_RECAP_STATE_COLLECTION,
    new Map([["2026 Sphere", { status: "skipped_archive", source: "incident" }]])
  );
  const db = fakeDb(collections);
  const state = await readProcessState({
    db,
    triggerId: "tour_recap",
    scope: "2026 Sphere",
  });
  assert.equal(state.terminal, true);
  assert.equal(state.data.status, "skipped_archive");
  assert.equal(state.data.legacy, true);
});

test("a superseded process id blocks the new id", async () => {
  const collections = new Map();
  collections.set(
    PROCESS_STATE_COLLECTION,
    new Map([["sphere-2026-inaugural", { status: "sent", triggerId: "tour_recap" }]])
  );
  const db = fakeDb(collections);
  const state = await readProcessState({
    db,
    triggerId: "tour_recap",
    scope: "2026 Sphere",
    supersedes: ["sphere-2026-inaugural"],
  });
  assert.equal(state.terminal, true);
  assert.equal(state.superseded, true);
});

test("tour_recap seeds close Summer as sent and Sphere as archive", () => {
  const summer = TOUR_RECAP_PROCESS_SEEDS.find((row) => row.scope === "2026 Summer Tour");
  const sphere = TOUR_RECAP_PROCESS_SEEDS.find((row) => row.scope === "2026 Sphere");
  assert.equal(summer.status, "sent");
  assert.equal(sphere.status, "skipped_archive");
  assert.deepEqual(sphere.supersedes, ["sphere-2026-inaugural"]);
});
