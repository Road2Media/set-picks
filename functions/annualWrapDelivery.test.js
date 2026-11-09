"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  deliverAnnualWrapInAppOnGrade,
  deliverPendingAnnualWraps,
} = require("./annualWrapDelivery");

function memoryDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const data = docs.get(key);
              return { exists: data != null, data: () => data || null };
            },
            async set(payload, opts) {
              const prev = docs.get(key) || {};
              docs.set(key, opts?.merge ? { ...prev, ...payload } : payload);
            },
          };
        },
        where(field, op, value) {
          return {
            async get() {
              const found = [];
              for (const [key, data] of docs) {
                if (!key.startsWith(`${name}/`)) continue;
                if (op === "in" && Array.isArray(value) && value.includes(data?.[field])) {
                  found.push({ id: key.slice(name.length + 1), data: () => data });
                }
              }
              return { docs: found, empty: found.length === 0 };
            },
          };
        },
      };
    },
  };
}

const admin = { firestore: { FieldValue: { serverTimestamp: () => "TS" } } };

test("in-app on grade sends only in-app and does not mark the year sent", async () => {
  const db = memoryDb({
    "picks/a": {
      showDate: "2026-12-31",
      userId: "ada",
      handle: "Ada",
      isGraded: true,
      score: 10,
      picks: { s1o: "Ghost" },
    },
    "official_setlists/2026-12-31": { officialSetlist: ["Ghost"], bustouts: [] },
    "users/ada": { handle: "Ada" },
  });
  const calls = [];
  const summary = await deliverAnnualWrapInAppOnGrade({
    db,
    runtime: {
      deliver: async (triggerId, recipients, opts) => {
        calls.push({ triggerId, channels: opts.channels, uid: recipients[0].uid });
        return { delivered: 1, processed: 1, byChannel: { inApp: 1 } };
      },
    },
    showDate: "2026-12-31",
    showDatesByTour: [{ tour: "NYE", shows: [{ date: "2026-12-30" }, { date: "2026-12-31" }] }],
    logger: { info() {}, warn() {}, error() {} },
  });
  assert.equal(summary.delivered, 1);
  assert.deepEqual(calls, [{ triggerId: "annual_wrap", channels: ["inApp"], uid: "ada" }]);
  assert.equal(db.docs.has("comms_process_state/annual_wrap:2026"), false);
});

test("a July grade does not send when December is still on the calendar", async () => {
  const calls = [];
  const summary = await deliverAnnualWrapInAppOnGrade({
    db: memoryDb(),
    runtime: { deliver: async () => { calls.push("sent"); return { delivered: 1 }; } },
    showDate: "2026-07-02",
    showDatesByTour: [{ tour: "Year", shows: [{ date: "2026-07-02" }, { date: "2026-12-31" }] }],
    logger: { info() {}, warn() {}, error() {} },
  });
  assert.equal(summary, null);
  assert.deepEqual(calls, []);
});

test("the morning job sends the remaining channels and marks the year sent", async () => {
  const db = memoryDb({
    "picks/a": {
      showDate: "2026-12-31",
      userId: "ada",
      handle: "Ada",
      isGraded: true,
      score: 10,
      picks: { s1o: "Ghost" },
    },
  });
  const calls = [];
  const summaries = await deliverPendingAnnualWraps({
    db,
    admin,
    runtime: {
      deliver: async (_triggerId, _recipients, opts) => {
        calls.push(opts.channels);
        return { delivered: 1, processed: 1, byChannel: { email: 1, push: 1 } };
      },
    },
    showDatesByTour: [{ tour: "NYE", shows: [{ date: "2026-12-31", venue: "MSG" }] }],
    now: new Date("2027-01-01T16:00:00Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  assert.deepEqual(calls, [["inApp", "push", "email"]]);
  assert.equal(summaries.length, 1);
  assert.equal(db.docs.get("comms_process_state/annual_wrap:2026")?.status, "sent");
});

test("the morning job does not read picks while the finale is still ahead", async () => {
  let picks = false;
  const db = {
    collection(name) {
      if (name === "picks") picks = true;
      return {
        doc() {
          return { async get() { return { exists: false, data: () => null }; } };
        },
        where() {
          return { async get() { return { docs: [], empty: true }; } };
        },
      };
    },
  };
  const summaries = await deliverPendingAnnualWraps({
    db,
    runtime: { deliver: async () => { throw new Error("should not deliver"); } },
    showDatesByTour: [{ tour: "Fall", shows: [{ date: "2026-10-07" }, { date: "2026-12-31" }] }],
    now: new Date("2026-10-08T15:00:00Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  assert.deepEqual(summaries, []);
  assert.equal(picks, false);
});
