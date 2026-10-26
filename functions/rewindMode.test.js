const test = require("node:test");
const assert = require("node:assert/strict");
const { HttpsError } = require("firebase-functions/v2/https");

const {
  LIVE_LEADERBOARD_COLLECTIONS,
  REWIND_ANSWERS,
  REWIND_PICKS,
  REWIND_STATE,
  REWIND_WEEKS,
  assertRewindAdmin,
  lockRewindPick,
  readRewindReveal,
  refreshRewindAnswer,
  runScheduledRewindAnswerRefresh,
  saveRewindWeek,
  toPublicRewindWeek,
} = require("./rewindMode");

const NOW = new Date("2026-11-23T15:00:00.000Z");

function memoryDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  const writes = [];

  function refFor(collectionName, id) {
    const path = `${collectionName}/${id}`;
    return {
      path,
      id,
      async get() {
        const data = docs.get(path);
        return {
          exists: data !== undefined,
          data: () => (data === undefined ? undefined : { ...data }),
        };
      },
      async set(data, opts) {
        writes.push(path);
        const prev = docs.get(path) || {};
        docs.set(path, opts && opts.merge ? { ...prev, ...data } : { ...data });
      },
      async delete() {
        writes.push(`delete:${path}`);
        docs.delete(path);
      },
    };
  }

  return {
    docs,
    writes,
    collection(name) {
      return {
        doc(id) {
          return refFor(name, id);
        },
        where(field, op, value) {
          return {
            async get() {
              const rows = [];
              for (const [path, data] of docs) {
                if (!path.startsWith(`${name}/`)) continue;
                if (op === "==" && data[field] === value) {
                  const id = path.slice(name.length + 1);
                  rows.push({
                    id,
                    data: () => ({ ...data }),
                    ref: refFor(name, id),
                  });
                }
              }
              return { docs: rows, empty: rows.length === 0 };
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data, opts) => ref.set(data, opts),
      });
    },
  };
}

function samplePayload() {
  return {
    error: false,
    data: [
      { song: "AC/DC Bag", set: "1", position: 1, gap: 5 },
      { song: "Wilson", set: "1", position: 2, gap: 2 },
      { song: "You Enjoy Myself", set: "1", position: 3, gap: 40 },
      { song: "Tweezer", set: "2", position: 1, gap: 10 },
      { song: "Harry Hood", set: "2", position: 2, gap: 3 },
      { song: "Loving Cup", set: "e", position: 1, gap: 8 },
    ],
  };
}

function openWeekInput(overrides = {}) {
  return {
    weekId: "2026-11-23",
    showDate: "1995-12-31",
    title: "MSG NYE 1995",
    venue: "Madison Square Garden",
    closesOn: "2026-11-29",
    status: "open",
    ...overrides,
  };
}

function filledPicks(overrides = {}) {
  return {
    s1o: "AC/DC Bag",
    s1c: "Sample in a Jar",
    s2o: "Tweezer",
    s2c: "Harry Hood",
    enc: "Loving Cup",
    wild: "Tweezer Reprise",
    ...overrides,
  };
}

function assertNoLiveWrites(db) {
  for (const path of db.writes) {
    const bare = path.replace(/^delete:/, "");
    const collection = bare.split("/")[0];
    assert.equal(
      LIVE_LEADERBOARD_COLLECTIONS.includes(collection),
      false,
      `live leaderboard write: ${path}`
    );
  }
}

test("public week drops setlist songs", () => {
  const week = toPublicRewindWeek({
    weekId: "2026-11-23",
    showDate: "1995-12-31",
    title: "MSG NYE 1995",
    setlist: { s1o: "Wilson" },
    officialSetlist: ["Wilson", "Tweezer"],
    bustouts: ["Wilson"],
    playerCount: 2,
  });
  const blob = JSON.stringify(week);
  assert.equal(blob.includes("Wilson"), false);
  assert.equal(blob.includes("Tweezer"), false);
  assert.equal(week.playerCount, 2);
  assert.equal(week.attribution, "Setlist data courtesy of Phish.net.");
  assert.deepEqual(Object.keys(week).sort(), [
    "attribution",
    "averageScore",
    "correctSlotCounts",
    "playerCount",
    "schemaVersion",
    "scoreSum",
    "showDate",
    "title",
    "weekId",
  ].sort());
});

test("admin gate rejects a signed-in player", () => {
  assert.throws(
    () => assertRewindAdmin({ auth: { uid: "fan", token: {} } }),
    (err) => err instanceof HttpsError && err.code === "permission-denied"
  );
  assert.doesNotThrow(() =>
    assertRewindAdmin({ auth: { uid: "admin", token: { admin: true } } })
  );
});

test("save stores a public week and never a setlist", async () => {
  const db = memoryDb();
  const result = await saveRewindWeek({
    db,
    now: NOW,
    input: {
      ...openWeekInput(),
      setlist: { s1o: "Wilson" },
      officialSetlist: ["Wilson"],
    },
  });
  const stored = db.docs.get(`${REWIND_WEEKS}/2026-11-23`);
  assert.equal(JSON.stringify(stored).includes("Wilson"), false);
  assert.equal(result.week.showDate, "1995-12-31");
  assert.equal(db.docs.get(`${REWIND_STATE}/current`).weekId, "2026-11-23");
  assertNoLiveWrites(db);
});

test("save rejects a show that has not been played", async () => {
  const db = memoryDb();
  await assert.rejects(
    () =>
      saveRewindWeek({
        db,
        now: NOW,
        input: openWeekInput({ showDate: "2026-12-31" }),
      }),
    (err) => err instanceof HttpsError && err.code === "invalid-argument"
  );
});

test("refresh caches one show and skips a fresh cache", async () => {
  const db = memoryDb();
  await saveRewindWeek({ db, now: NOW, input: openWeekInput() });
  let calls = 0;
  const fetchSetlist = async (showDate) => {
    calls += 1;
    assert.equal(showDate, "1995-12-31");
    return samplePayload();
  };
  const first = await refreshRewindAnswer({
    db,
    weekId: "2026-11-23",
    apiKey: "test-key",
    now: NOW,
    fetchSetlist,
  });
  assert.equal(first.skipped, false);
  assert.equal(first.songCount, 6);
  assert.equal(calls, 1);
  const answer = db.docs.get(`${REWIND_ANSWERS}/2026-11-23`);
  assert.equal(answer.setlist.s1o, "AC/DC Bag");
  assert.ok(answer.officialSetlist.includes("Wilson"));
  assert.equal(
    JSON.stringify(db.docs.get(`${REWIND_WEEKS}/2026-11-23`)).includes("Wilson"),
    false
  );

  const second = await refreshRewindAnswer({
    db,
    weekId: "2026-11-23",
    apiKey: "test-key",
    now: new Date(NOW.getTime() + 60 * 60 * 1000),
    fetchSetlist,
  });
  assert.equal(second.skipped, true);
  assert.equal(calls, 1);

  const third = await refreshRewindAnswer({
    db,
    weekId: "2026-11-23",
    apiKey: "test-key",
    now: new Date(NOW.getTime() + 25 * 60 * 60 * 1000),
    fetchSetlist,
  });
  assert.equal(third.skipped, false);
  assert.equal(calls, 2);
  assertNoLiveWrites(db);
  assert.equal(db.docs.has("official_setlists/1995-12-31"), false);
  assert.equal(db.docs.has("picks/1995-12-31_fan"), false);
});

test("scheduler does not fetch when the current week is closed", async () => {
  const db = memoryDb();
  await saveRewindWeek({
    db,
    now: NOW,
    input: openWeekInput({ status: "closed" }),
  });
  await db.collection(REWIND_STATE).doc("current").set({ weekId: "2026-11-23" });
  let calls = 0;
  const result = await runScheduledRewindAnswerRefresh({
    db,
    apiKey: "test-key",
    now: NOW,
    fetchSetlist: async () => {
      calls += 1;
      return samplePayload();
    },
  });
  assert.equal(result.fetched, false);
  assert.equal(result.reason, "closed");
  assert.equal(calls, 0);
});

test("lock scores on rewind_picks and leaves live totals alone", async () => {
  const db = memoryDb({
    "users/fan": { handle: "Pat", totalPoints: 40, showsPlayed: 3 },
  });
  await saveRewindWeek({ db, now: NOW, input: openWeekInput() });
  await refreshRewindAnswer({
    db,
    weekId: "2026-11-23",
    apiKey: "test-key",
    now: NOW,
    fetchSetlist: async () => samplePayload(),
  });
  db.writes.length = 0;

  const locked = await lockRewindPick({
    db,
    uid: "fan",
    now: NOW,
    input: { weekId: "2026-11-23", picks: filledPicks() },
  });
  assert.equal(locked.alreadyLocked, false);
  assert.equal(locked.reveal.score > 0, true);
  const revealBlob = JSON.stringify(locked.reveal);
  assert.equal(revealBlob.includes("officialSetlist"), false);
  assert.equal(revealBlob.includes("Wilson"), false);
  assert.equal(revealBlob.includes("bustouts"), false);

  const pick = db.docs.get(`${REWIND_PICKS}/2026-11-23_fan`);
  assert.equal(pick.userId, "fan");
  assert.equal(pick.score, locked.reveal.score);
  assert.equal(pick.picks.s1o, "AC/DC Bag");
  assert.equal(pick.officialSetlist, undefined);

  const week = db.docs.get(`${REWIND_WEEKS}/2026-11-23`);
  assert.equal(week.playerCount, 1);
  assert.equal(week.scoreSum, pick.score);
  assert.equal(JSON.stringify(week).includes("AC/DC Bag"), false);

  const user = db.docs.get("users/fan");
  assert.equal(user.totalPoints, 40);
  assert.equal(user.showsPlayed, 3);
  assertNoLiveWrites(db);
  assert.equal(
    db.writes.some((path) => path.startsWith("picks/") || path.startsWith("users/")),
    false
  );
});

test("a second lock does not change the card or the board", async () => {
  const db = memoryDb({ "users/fan": { handle: "Pat", totalPoints: 1 } });
  await saveRewindWeek({ db, now: NOW, input: openWeekInput() });
  await refreshRewindAnswer({
    db,
    weekId: "2026-11-23",
    apiKey: "test-key",
    now: NOW,
    fetchSetlist: async () => samplePayload(),
  });
  await lockRewindPick({
    db,
    uid: "fan",
    now: NOW,
    input: { weekId: "2026-11-23", picks: filledPicks() },
  });
  const before = db.docs.get(`${REWIND_WEEKS}/2026-11-23`).playerCount;
  const again = await lockRewindPick({
    db,
    uid: "fan",
    now: NOW,
    input: {
      weekId: "2026-11-23",
      picks: filledPicks({ s1o: "Tweezer" }),
    },
  });
  assert.equal(again.alreadyLocked, true);
  assert.equal(again.reveal.slots.find((slot) => slot.id === "s1o").guess, "AC/DC Bag");
  assert.equal(db.docs.get(`${REWIND_WEEKS}/2026-11-23`).playerCount, before);
  assert.equal(db.docs.get("users/fan").totalPoints, 1);
});

test("reveal is refused until the player locks", async () => {
  const db = memoryDb();
  await saveRewindWeek({ db, now: NOW, input: openWeekInput() });
  await refreshRewindAnswer({
    db,
    weekId: "2026-11-23",
    apiKey: "test-key",
    now: NOW,
    fetchSetlist: async () => samplePayload(),
  });
  await assert.rejects(
    () => readRewindReveal({ db, uid: "fan", input: { weekId: "2026-11-23" } }),
    (err) => err instanceof HttpsError && err.code === "failed-precondition"
  );
});

test("lock is refused when the setlist cache is missing", async () => {
  const db = memoryDb({ "users/fan": { handle: "Pat" } });
  await saveRewindWeek({ db, now: NOW, input: openWeekInput() });
  await assert.rejects(
    () =>
      lockRewindPick({
        db,
        uid: "fan",
        now: NOW,
        input: { weekId: "2026-11-23", picks: filledPicks() },
      }),
    (err) => err instanceof HttpsError && err.code === "failed-precondition"
  );
  assert.equal(db.docs.has(`${REWIND_PICKS}/2026-11-23_fan`), false);
});
