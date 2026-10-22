"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { rollupAuditTourFields, runRollupForShow } = require("./rollupCore");

const SHOW_DATE = "2026-04-17";
const DELETE = Object.freeze({ op: "delete" });
const SERVER_TS = Object.freeze({ op: "serverTimestamp" });

function increment(n) {
  return { op: "increment", n };
}

const admin = {
  firestore: {
    FieldValue: {
      delete: () => DELETE,
      increment,
      serverTimestamp: () => SERVER_TS,
    },
  },
};

/**
 * Minimal Firestore stand-in for `runRollupForShow`.
 * Records audit sets and user batch sets. Badge reads miss. Leaderboard
 * scan is empty so the post-rollup rebuild writes nothing that matters.
 *
 * @param {{
 *   picks: Array<{ id: string, data: Record<string, unknown> }>,
 *   showDatesByTour: unknown,
 *   calendarExists?: boolean,
 * }} params
 */
function createHarness({ picks, showDatesByTour, calendarExists = true }) {
  /** @type {Array<{ id: string, data: Record<string, unknown>, opts: unknown }>} */
  const auditWrites = [];
  /** @type {Array<{ id: string, data: Record<string, unknown>, opts: unknown }>} */
  const userWrites = [];

  const setlistDoc = {
    setlist: { s1o: "Tweezer", s1c: "", s2o: "", s2c: "", enc: "", wild: "" },
    officialSetlist: ["Tweezer"],
  };

  function docRef(collectionName, id) {
    return {
      id,
      collectionName,
      path: `${collectionName}/${id}`,
      async get() {
        if (collectionName === "official_setlists") {
          return { exists: true, id, data: () => setlistDoc };
        }
        if (collectionName === "show_calendar") {
          return {
            exists: calendarExists,
            id,
            data: () => (calendarExists ? { showDatesByTour } : {}),
          };
        }
        return { exists: false, id, ref: this, data: () => ({}) };
      },
      async set(data, opts) {
        if (collectionName === "rollup_audit") {
          auditWrites.push({ id, data, opts });
        }
      },
      collection() {
        return {
          limit() {
            return { get: async () => ({ docs: [] }) };
          },
        };
      },
    };
  }

  const db = {
    async getAll(...refs) {
      return refs.map((ref) => ({
        exists: false,
        ref,
        data: () => ({}),
      }));
    },
    batch() {
      return {
        update() {},
        set(ref, data, opts) {
          if (ref && ref.collectionName === "users") {
            userWrites.push({ id: ref.id, data, opts });
          }
        },
        async commit() {},
      };
    },
    collection(name) {
      return {
        doc(id) {
          return docRef(name, id);
        },
        where() {
          return {
            async get() {
              return {
                empty: picks.length === 0,
                size: picks.length,
                docs: picks.map((pick) => ({
                  id: pick.id,
                  data: () => pick.data,
                  ref: { id: pick.id, path: `picks/${pick.id}` },
                })),
              };
            },
          };
        },
        orderBy() {
          return {
            limit() {
              return {
                async get() {
                  return { empty: true, size: 0, docs: [] };
                },
              };
            },
          };
        },
      };
    },
  };

  return { db, auditWrites, userWrites };
}

function loggerSink() {
  /** @type {{ error: unknown[], warn: unknown[], info: unknown[] }} */
  const logs = { error: [], warn: [], info: [] };
  return {
    logs,
    logger: {
      error(msg, extra) {
        logs.error.push({ msg, extra });
      },
      warn(msg, extra) {
        logs.warn.push({ msg, extra });
      },
      info(msg, extra) {
        logs.info.push({ msg, extra });
      },
    },
  };
}

const gradedPick = {
  id: "2026-04-17_uid1",
  data: {
    userId: "uid1",
    showDate: SHOW_DATE,
    picks: { s1o: "Tweezer" },
    isGraded: true,
    score: 10,
    winCredited: true,
    correctSlotsCredited: 1,
  },
};

test("rollupAuditTourFields: missing key is explicit on the audit shape", () => {
  assert.deepEqual(rollupAuditTourFields(SHOW_DATE, null), {
    showDate: SHOW_DATE,
    tourKey: null,
    tourKeyMissing: true,
  });
  assert.deepEqual(rollupAuditTourFields(SHOW_DATE, "  "), {
    showDate: SHOW_DATE,
    tourKey: null,
    tourKeyMissing: true,
  });
  assert.deepEqual(rollupAuditTourFields(SHOW_DATE, "Sphere Run"), {
    showDate: SHOW_DATE,
    tourKey: "Sphere Run",
    tourKeyMissing: false,
  });
});

test("runRollupForShow: missing tour key stamps audit and logs an error (#298)", async () => {
  const { db, auditWrites, userWrites } = createHarness({
    picks: [gradedPick],
    showDatesByTour: [
      { tour: "Summer Tour", shows: [{ date: "2026-07-07" }] },
    ],
  });
  const { logger, logs } = loggerSink();

  const result = await runRollupForShow({
    db,
    admin,
    showDate: SHOW_DATE,
    callerUid: "admin-1",
    trigger: "manual",
    logger,
  });

  assert.equal(result.setlistExists, true);
  assert.equal(result.processedPicks, 1);
  assert.equal(auditWrites.length, 1);
  assert.equal(auditWrites[0].id, SHOW_DATE);
  assert.equal(auditWrites[0].opts.merge, true);
  assert.equal(auditWrites[0].data.tourKeyMissing, true);
  assert.equal(auditWrites[0].data.tourKey, null);
  assert.equal(auditWrites[0].data.showDate, SHOW_DATE);
  assert.equal(auditWrites[0].data.trigger, "manual");
  assert.equal(auditWrites[0].data.callerUid, "admin-1");
  assert.equal(auditWrites[0].data.processedPicks, 1);
  assert.equal(auditWrites[0].data.lastRolledUpAt, SERVER_TS);

  assert.deepEqual(
    logs.error.map((entry) => entry.msg),
    ["runRollupForShow: tourKey missing for showDate"]
  );
  assert.equal(logs.error[0].extra.showDate, SHOW_DATE);
  assert.equal(logs.error[0].extra.trigger, "manual");
  assert.equal(
    logs.warn.some((entry) => entry.msg === "runRollupForShow: tourKey missing for showDate"),
    false
  );

  assert.equal(userWrites.length, 1);
  assert.equal(userWrites[0].id, "uid1");
  assert.equal(userWrites[0].opts.merge, true);
  assert.equal(userWrites[0].data.stats, DELETE);
  assert.equal(Object.prototype.hasOwnProperty.call(userWrites[0].data, "seasonStats"), false);
});

test("runRollupForShow: resolved tour key clears tourKeyMissing and writes seasonStats", async () => {
  const { db, auditWrites, userWrites } = createHarness({
    picks: [gradedPick],
    showDatesByTour: [
      { tour: "Sphere Run", shows: [{ date: SHOW_DATE }] },
    ],
  });
  const { logger, logs } = loggerSink();

  await runRollupForShow({
    db,
    admin,
    showDate: SHOW_DATE,
    callerUid: null,
    trigger: "auto",
    logger,
  });

  assert.equal(auditWrites.length, 1);
  assert.equal(auditWrites[0].data.tourKeyMissing, false);
  assert.equal(auditWrites[0].data.tourKey, "Sphere Run");
  assert.equal(auditWrites[0].data.showDate, SHOW_DATE);
  assert.equal(auditWrites[0].data.callerUid, null);
  assert.equal(auditWrites[0].data.trigger, "auto");
  assert.equal(logs.error.length, 0);
  assert.equal(userWrites[0].data.stats, DELETE);
  assert.ok(userWrites[0].data.seasonStats);
  assert.ok(userWrites[0].data.seasonStats["Sphere Run"]);
});

test("runRollupForShow: empty pick set still records a missing tour key", async () => {
  const { db, auditWrites, userWrites } = createHarness({
    picks: [],
    showDatesByTour: null,
    calendarExists: false,
  });
  const { logger, logs } = loggerSink();

  const result = await runRollupForShow({
    db,
    admin,
    showDate: SHOW_DATE,
    trigger: "auto-reconcile",
    logger,
  });

  assert.equal(result.processedPicks, 0);
  assert.equal(result.totalPicks, 0);
  assert.equal(userWrites.length, 0);
  assert.equal(auditWrites.length, 1);
  assert.deepEqual(
    {
      showDate: auditWrites[0].data.showDate,
      tourKey: auditWrites[0].data.tourKey,
      tourKeyMissing: auditWrites[0].data.tourKeyMissing,
      processedPicks: auditWrites[0].data.processedPicks,
      trigger: auditWrites[0].data.trigger,
    },
    {
      showDate: SHOW_DATE,
      tourKey: null,
      tourKeyMissing: true,
      processedPicks: 0,
      trigger: "auto-reconcile",
    }
  );
  assert.equal(logs.error.length, 1);
});
