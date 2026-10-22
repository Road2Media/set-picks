const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applySnapshotReconcile,
  parseShowDateList,
  planSnapshotOverwrite,
} = require("./reconcileSetlistSnapshots");

test("parseShowDateList accepts a targeted list and rejects junk", () => {
  assert.deepEqual(parseShowDateList("2026-10-07, 2026-07-04"), [
    "2026-10-07",
    "2026-07-04",
  ]);
  assert.throws(() => parseShowDateList(""), /showDates/);
  assert.throws(() => parseShowDateList("10/07/2026"), /Invalid showDate/);
});

test("planSnapshotOverwrite drops a title that the fresh feed does not play (#626)", () => {
  const plan = planSnapshotOverwrite(
    {
      officialSetlist: ["The Curtain With"],
      setlist: { s1o: "The Curtain With" },
      bustouts: ["The Curtain"],
      songGaps: { "the curtain": 197, "the curtain with": 11 },
    },
    [{ title: "The Curtain With", gap: 11, setKey: "1", position: 1 }]
  );
  assert.equal(plan.skip, null);
  assert.equal(plan.changed, true);
  assert.equal(plan.scoringBustoutsChanged, false);
  assert.deepEqual(plan.bustouts, []);
  assert.deepEqual(plan.songGaps, { "the curtain with": 11 });
  assert.match(plan.scoreReconcileReason, /^no /);
  assert.ok(plan.gapDiffs.some((line) => line.startsWith("the curtain ")));
});

test("planSnapshotOverwrite flags a played bustout whose fetched gap falls under 30", () => {
  const plan = planSnapshotOverwrite(
    {
      officialSetlist: ["Tweezer", "The Curtain With"],
      setlist: { s1o: "Tweezer" },
      bustouts: ["Tweezer", "The Curtain"],
      songGaps: { tweezer: 40, "the curtain": 197, "the curtain with": 11 },
    },
    [
      { title: "Tweezer", gap: 4, setKey: "1", position: 1 },
      { title: "The Curtain With", gap: 11, setKey: "1", position: 2 },
    ]
  );
  assert.equal(plan.scoringBustoutsChanged, true);
  assert.deepEqual(plan.bustouts, []);
  assert.equal(plan.songGaps.tweezer, 4);
  assert.equal(plan.songGaps["the curtain"], undefined);
  assert.match(plan.scoreReconcileReason, /^yes /);
});

test("planSnapshotOverwrite does not wipe a show when Phish.net returns no rows", () => {
  const plan = planSnapshotOverwrite(
    { bustouts: ["Foam"], songGaps: { foam: 80 } },
    []
  );
  assert.equal(plan.skip, "no-rows");
  assert.equal(plan.changed, false);
  assert.deepEqual(plan.bustouts, ["Foam"]);
});

test("planSnapshotOverwrite is unchanged when the feed already matches", () => {
  const plan = planSnapshotOverwrite(
    {
      officialSetlist: ["Tweezer"],
      bustouts: ["Tweezer"],
      songGaps: { tweezer: 40 },
    },
    [{ title: "Tweezer", gap: 40, setKey: "1", position: 1 }]
  );
  assert.equal(plan.changed, false);
  assert.equal(plan.scoringBustoutsChanged, false);
});

test("applySnapshotReconcile overwrites gaps without rescoring a non-played bustout", async () => {
  const showDate = "2026-10-07";
  const { db, docs } = buildFakeDb({
    [`official_setlists/${showDate}`]: {
      officialSetlist: ["The Curtain With"],
      setlist: { s1o: "The Curtain With" },
      bustouts: ["The Curtain"],
      songGaps: { "the curtain": 197, "the curtain with": 11 },
    },
  });
  const plan = planSnapshotOverwrite(docs.get(`official_setlists/${showDate}`), [
    { title: "The Curtain With", gap: 11, setKey: "1", position: 1 },
  ]);
  const result = await applySnapshotReconcile({
    db,
    admin: fakeAdmin,
    showDate,
    plan,
  });
  assert.deepEqual(result, { wrote: true, updatedPicks: 0, reconciledGradedPicks: 0 });
  const saved = docs.get(`official_setlists/${showDate}`);
  assert.deepEqual(saved.bustouts, []);
  assert.deepEqual(saved.songGaps, { "the curtain with": 11 });
  assert.equal(saved.updatedBy, "backfill-reconcile-snapshots");
});

test("applySnapshotReconcile adjusts graded totalPoints when a played bustout changes", async () => {
  const showDate = "2026-10-07";
  const { db, docs } = buildFakeDb({
    [`official_setlists/${showDate}`]: {
      officialSetlist: ["Tweezer"],
      setlist: { s1o: "Tweezer", s1c: "", s2o: "", s2c: "", enc: "", wild: "" },
      encoreSongs: [],
      bustouts: ["Tweezer"],
      songGaps: { tweezer: 40 },
    },
    "picks/p1": {
      showDate,
      userId: "u1",
      picks: { s1o: "Tweezer" },
      score: 30,
      isGraded: true,
    },
    "users/u1": { totalPoints: 100 },
  });
  const plan = planSnapshotOverwrite(docs.get(`official_setlists/${showDate}`), [
    { title: "Tweezer", gap: 4, setKey: "1", position: 1 },
  ]);
  assert.equal(plan.scoringBustoutsChanged, true);
  const result = await applySnapshotReconcile({
    db,
    admin: fakeAdmin,
    showDate,
    plan,
  });
  assert.equal(result.wrote, true);
  assert.equal(result.updatedPicks, 1);
  assert.equal(result.reconciledGradedPicks, 1);
  assert.equal(docs.get("picks/p1").score, 10);
  assert.equal(docs.get("users/u1").totalPoints, 80);
  assert.deepEqual(docs.get(`official_setlists/${showDate}`).bustouts, []);
});

const fakeAdmin = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => ({ _sentinel: "serverTimestamp" }),
      delete: () => ({ _sentinel: "delete" }),
      increment: (n) => ({ _sentinel: "increment", n }),
    },
  },
};

function buildFakeDb(initialDocs) {
  const docs = new Map(Object.entries(initialDocs));

  function applyWrite(key, value, merge) {
    const prev = docs.get(key) || {};
    const next = merge ? { ...prev } : {};
    for (const [field, fieldValue] of Object.entries(value || {})) {
      if (fieldValue && fieldValue._sentinel === "delete") {
        delete next[field];
      } else if (fieldValue && fieldValue._sentinel === "increment") {
        const current = Number(next[field] || 0);
        next[field] = current + fieldValue.n;
      } else if (fieldValue && fieldValue._sentinel === "serverTimestamp") {
        next[field] = "ts";
      } else {
        next[field] = fieldValue;
      }
    }
    docs.set(key, next);
  }

  function makeRef(key) {
    return {
      path: key,
      async get() {
        const data = docs.get(key);
        return {
          exists: data !== undefined,
          data: () => (data ? { ...data } : undefined),
        };
      },
      async update(value) {
        if (!docs.has(key)) throw new Error(`missing ${key}`);
        applyWrite(key, value, true);
      },
    };
  }

  const db = {
    collection(name) {
      return {
        doc(id) {
          return makeRef(`${name}/${id}`);
        },
        where(field, op, value) {
          if (op !== "==") throw new Error(`unsupported op ${op}`);
          return {
            async get() {
              const found = [];
              for (const [key, data] of docs) {
                if (!key.startsWith(`${name}/`)) continue;
                if (data[field] !== value) continue;
                found.push({
                  ref: makeRef(key),
                  data: () => ({ ...data }),
                });
              }
              return { docs: found };
            },
          };
        },
      };
    },
    batch() {
      const ops = [];
      return {
        update(ref, value) {
          ops.push(() => applyWrite(ref.path, value, true));
        },
        set(ref, value, opts) {
          ops.push(() => applyWrite(ref.path, value, Boolean(opts?.merge)));
        },
        async commit() {
          for (const op of ops) op();
        },
      };
    },
  };

  return { db, docs };
}
