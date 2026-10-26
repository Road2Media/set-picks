"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { freezeTourRankSnapshot, freezeYearRankSnapshot } = require("./badgeSnapshotJobs");

function memoryDb(seed) {
  /** @type {Map<string, Record<string, unknown>>} */
  const docs = new Map(Object.entries(seed || {}));
  /** @type {Array<{ path: string, data: Record<string, unknown>, merge: boolean }>} */
  const writes = [];

  function refFor(path) {
    return {
      id: path.split("/").pop(),
      path,
      async get() {
        const data = docs.get(path);
        return {
          exists: docs.has(path),
          id: path.split("/").pop(),
          ref: refFor(path),
          data: () => (data ? { ...data } : {}),
        };
      },
      async create(data) {
        if (docs.has(path)) {
          const error = new Error("already exists");
          error.code = 6;
          throw error;
        }
        docs.set(path, { ...data });
        writes.push({ path, data, merge: false });
      },
      async set(data, opts) {
        const prev = docs.get(path) || {};
        const next = opts && opts.merge ? { ...prev, ...data } : { ...data };
        if (opts && opts.merge && data.badges && prev.badges) {
          next.badges = { ...prev.badges, ...data.badges };
        }
        docs.set(path, next);
        writes.push({ path, data, merge: Boolean(opts && opts.merge) });
      },
    };
  }

  const db = {
    writes,
    docs,
    collection(name) {
      return {
        doc(id) {
          return refFor(`${name}/${id}`);
        },
        where(field, op, value) {
          return {
            async get() {
              const wanted = new Set(op === "in" ? value : [value]);
              const found = [];
              for (const [path, data] of docs) {
                if (!path.startsWith("picks/")) continue;
                if (wanted.has(data[field])) {
                  found.push({
                    id: path.split("/").pop(),
                    data: () => data,
                  });
                }
              }
              return { docs: found, size: found.length, empty: found.length === 0 };
            },
          };
        },
      };
    },
    async getAll(...refs) {
      const snaps = [];
      for (const ref of refs) snaps.push(await ref.get());
      return snaps;
    },
    batch() {
      /** @type {Array<{ ref: { path: string }, data: Record<string, unknown>, opts: unknown }>} */
      const ops = [];
      return {
        set(ref, data, opts) {
          ops.push({ ref, data, opts });
        },
        async commit() {
          for (const op of ops) {
            await op.ref.set(dataOnly(op.data), op.opts);
          }
        },
      };
    },
  };

  function dataOnly(data) {
    return data;
  }

  return db;
}

const admin = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => "SERVER_TS",
    },
  },
};

function pick(uid, handle, score) {
  return {
    userId: uid,
    handle,
    score,
    isGraded: true,
    showDate: "",
    picks: { s1o: "Tweezer" },
    correctSlotsCredited: 6,
  };
}

test("freezeTourRankSnapshot writes the full field once and does not change awardedAt", async () => {
  const picks = {};
  for (let i = 0; i < 51; i += 1) {
    const row = pick(`u${i}`, `P${i}`, 200 - i);
    row.showDate = "2026-08-02";
    picks[`picks/early-${i}`] = row;
  }
  const finalePick = pick("u0", "P0", 10);
  finalePick.showDate = "2026-08-03";
  picks["picks/finale"] = finalePick;

  const db = memoryDb({
    "rollup_audit/2026-08-02": { lastRolledUpAt: "yes" },
    "rollup_audit/2026-08-03": { lastRolledUpAt: "yes" },
    "official_setlists/2026-08-02": {
      setlist: { s1o: "Tweezer" },
      officialSetlist: ["Tweezer"],
      bustouts: ["Tweezer"],
    },
    "official_setlists/2026-08-03": {
      setlist: { s1o: "Tweezer" },
      officialSetlist: ["Tweezer"],
      bustouts: [],
    },
    "users/u0": { handle: "P0", badges: {} },
    "users/u50": { handle: "P50", badges: {} },
    ...picks,
  });

  const calendar = [
    {
      tour: "Summer",
      shows: [{ date: "2026-08-02" }, { date: "2026-08-03" }],
    },
  ];

  const first = await freezeTourRankSnapshot({
    db,
    admin,
    tourKey: "Summer",
    showDatesByTour: calendar,
  });
  assert.equal(first.status, "frozen");
  assert.ok(first.awardsWritten >= 1);
  const snap = db.docs.get("tour_rank_snapshots/Summer");
  assert.equal(snap.players.length, 51);
  assert.equal(snap.players.find((row) => row.uid === "u50").rank, 51);
  const awardedAt = db.docs.get("users/u0").badges.tour_winner_1.awardedAt;
  assert.equal(awardedAt, "SERVER_TS");

  const second = await freezeTourRankSnapshot({
    db,
    admin,
    tourKey: "Summer",
    showDatesByTour: calendar,
  });
  assert.equal(second.status, "frozen");
  assert.equal(second.awardsWritten, 0);
  assert.equal(db.docs.get("users/u0").badges.tour_winner_1.awardedAt, awardedAt);
});

test("freezeYearRankSnapshot ignores another year and waits until after 31 December", async () => {
  const db = memoryDb({
    "rollup_audit/2025-12-31": { lastRolledUpAt: "yes" },
    "picks/a": {
      userId: "a",
      handle: "Ann",
      score: 20,
      isGraded: true,
      showDate: "2025-12-31",
      picks: { s1o: "Tweezer" },
    },
    "picks/b": {
      userId: "b",
      handle: "Bo",
      score: 50,
      isGraded: true,
      showDate: "2026-01-01",
      picks: { s1o: "Tweezer" },
    },
    "users/a": { handle: "Ann" },
  });
  const calendar = [
    {
      tour: "NYE",
      shows: [{ date: "2025-12-31" }, { date: "2026-01-01" }],
    },
  ];
  const tooSoon = await freezeYearRankSnapshot({
    db,
    admin,
    year: "2025",
    showDatesByTour: calendar,
    now: new Date("2025-12-31T23:00:00.000Z"),
  });
  assert.equal(tooSoon.status, "open");
  assert.equal(db.docs.has("year_rank_snapshots/2025"), false);

  const closed = await freezeYearRankSnapshot({
    db,
    admin,
    year: "2025",
    showDatesByTour: calendar,
    now: new Date("2026-01-01T00:30:00.000Z"),
  });
  assert.equal(closed.status, "frozen");
  const players = db.docs.get("year_rank_snapshots/2025").players;
  assert.deepEqual(
    players.map((row) => row.uid),
    ["a"]
  );
  assert.equal(players[0].rank, 1);
  assert.equal(db.docs.get("users/a").badges.year_winner_1.scope, "year:2025");
});
