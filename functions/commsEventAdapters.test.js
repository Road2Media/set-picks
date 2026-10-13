"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldDeliverAccountWelcome,
  shouldDeliverPicksConfirmed,
  computeGlobalRankByUid,
  findTourCountdownTargets,
  loadUserIdsWithPicksForShowDates,
  leaderUidFromScores,
  deliverTourRecapIfFinalShow,
  deliverPendingTourRecaps,
  runScheduledTourRankingsDaily,
  shouldSkipTourRankingsOnTourRecapMorning,
  isSphereArchiveTourKey,
  shouldAttemptPendingTourRecap,
  MAX_TOUR_RECAP_LOOKBACK_DAYS,
} = require("./commsEventAdapters");
const { isCommsEventAdaptersEnabled } = require("./commsAdapterRuntime");
const {
  isFinalShowOfTour,
  buildTourRecapPodium,
  buildTourRecapEmailBoard,
  buildTourRecapPayload,
} = require("./tourRecapCore");

test("isCommsEventAdaptersEnabled defaults false", () => {
  const prev = process.env.COMMS_EVENT_ADAPTERS_ENABLED;
  delete process.env.COMMS_EVENT_ADAPTERS_ENABLED;
  assert.equal(isCommsEventAdaptersEnabled(), false);
  process.env.COMMS_EVENT_ADAPTERS_ENABLED = "true";
  assert.equal(isCommsEventAdaptersEnabled(), true);
  if (prev === undefined) delete process.env.COMMS_EVENT_ADAPTERS_ENABLED;
  else process.env.COMMS_EVENT_ADAPTERS_ENABLED = prev;
});

test("shouldDeliverAccountWelcome when handle first appears", () => {
  assert.equal(shouldDeliverAccountWelcome(null, { handle: "phish" }), true);
  assert.equal(shouldDeliverAccountWelcome({ handle: "phish" }, { handle: "phish" }), false);
  assert.equal(shouldDeliverAccountWelcome({ termsPrivacyAcceptedAt: "x" }, { handle: "" }), false);
});

test("shouldDeliverPicksConfirmed on first non-empty pick write", () => {
  assert.equal(
    shouldDeliverPicksConfirmed(false, null, {
      userId: "u1",
      picks: { opener: "Tweezer" },
    }),
    true
  );
  assert.equal(
    shouldDeliverPicksConfirmed(true, { picks: {} }, { picks: { opener: "Tweezer" } }),
    false
  );
});

test("computeGlobalRankByUid ranks by score with ties", () => {
  const docs = [
    { id: "a", data: () => ({ userId: "u1", picks: { opener: "x" } }) },
    { id: "b", data: () => ({ userId: "u2", picks: { opener: "y" } }) },
    { id: "c", data: () => ({ userId: "u3", picks: { opener: "z" } }) },
  ];
  const scores = new Map([
    ["a", 10],
    ["b", 10],
    ["c", 5],
  ]);
  const ranks = computeGlobalRankByUid(docs, scores);
  assert.equal(ranks.get("u1")?.rank, 1);
  assert.equal(ranks.get("u2")?.rank, 1);
  assert.equal(ranks.get("u3")?.rank, 3);
  assert.equal(ranks.get("u1")?.total, 3);
});

test("findTourCountdownTargets hits T-10/T-5/T-3/T-1", () => {
  const now = new Date("2026-04-06T18:00:00Z");
  const shows = [
    {
      date: "2026-04-16",
      venue: "Sphere",
      city: "Las Vegas",
      timeZone: "America/Los_Angeles",
      tour: "Sphere '26",
    },
  ];
  const hits = findTourCountdownTargets(shows, now);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].days_remaining, 10);
  assert.equal(hits[0].tourId, "Sphere '26");
});

test("findTourCountdownTargets hits T-3 for Summer Tour Jul 7 kickoff", () => {
  const now = new Date("2026-07-04T16:00:00Z");
  const shows = [
    {
      date: "2026-07-07",
      venue: "Kohl Center",
      city: "Madison, WI",
      timeZone: "America/Chicago",
      tour: "Summer Tour 2026",
    },
  ];
  const hits = findTourCountdownTargets(shows, now);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].days_remaining, 3);
  assert.equal(hits[0].tourId, "Summer Tour 2026");
});

test("findTourCountdownTargets: multi-tour snapshot hits Summer T-1 only (#514)", () => {
  // Flat showDates without tour labels collapses to earliest past opener → 0 hits.
  // With per-tour labels (showDatesByTour expansion), Summer T-1 still fires.
  const now = new Date("2026-07-06T16:00:00Z");
  const shows = [
    {
      date: "2026-04-16",
      venue: "Sphere",
      timeZone: "America/Los_Angeles",
      tour: "Sphere Run 2026",
      tour_name: "Sphere Run 2026",
    },
    {
      date: "2026-04-26",
      venue: "Sphere",
      timeZone: "America/Los_Angeles",
      tour: "Sphere Run 2026",
      tour_name: "Sphere Run 2026",
    },
    {
      date: "2026-07-07",
      venue: "Kohl Center",
      city: "Madison, WI",
      timeZone: "America/Chicago",
      tour: "Summer Tour 2026",
      tour_name: "Summer Tour 2026",
    },
    {
      date: "2026-07-08",
      venue: "Kohl Center",
      city: "Madison, WI",
      timeZone: "America/Chicago",
      tour: "Summer Tour 2026",
      tour_name: "Summer Tour 2026",
    },
  ];
  const hits = findTourCountdownTargets(shows, now);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].tourId, "Summer Tour 2026");
  assert.equal(hits[0].days_remaining, 1);
  assert.equal(hits[0].first_show_date, "2026-07-07");
});

test("findTourCountdownTargets skips a tour whose timezone is not a real IANA name", () => {
  const now = new Date("2026-04-06T18:00:00Z");
  const shows = [
    { date: "2026-04-16", timeZone: "Not/A/Zone", tour: "Bad Tour", venue: "X" },
    {
      date: "2026-04-11",
      timeZone: "America/Los_Angeles",
      tour: "Good Tour",
      venue: "Y",
    },
  ];
  const hits = findTourCountdownTargets(shows, now);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].tour_name, "Good Tour");
  assert.equal(hits[0].days_remaining, 5);
});

test("findTourCountdownTargets: unlabeled flat list with past dates is a no-op (#514)", () => {
  const now = new Date("2026-07-06T16:00:00Z");
  const flatCollapsed = [
    { date: "2026-04-16", timeZone: "America/Los_Angeles" },
    { date: "2026-07-07", timeZone: "America/Chicago" },
  ];
  const hits = findTourCountdownTargets(flatCollapsed, now);
  assert.equal(hits.length, 0);
});

test("leaderUidFromScores returns sole leader only", () => {
  const picksSnap = {
    docs: [
      { id: "p1", data: () => ({ userId: "u1", picks: { opener: "a" } }) },
      { id: "p2", data: () => ({ userId: "u2", picks: { opener: "b" } }) },
    ],
  };
  assert.equal(
    leaderUidFromScores(new Map([["p1", 5], ["p2", 3]]), picksSnap),
    "u1"
  );
  assert.equal(
    leaderUidFromScores(new Map([["p1", 5], ["p2", 5]]), picksSnap),
    null
  );
});

test("loadUserIdsWithPicksForShowDates indexes non-empty picks (#509)", async () => {
  const db = {
    collection: () => ({
      where: () => ({
        get: async () => ({
          docs: [
            {
              data: () => ({
                showDate: "2026-07-18",
                userId: "u1",
                picks: { opener: "Tweezer" },
              }),
            },
            {
              data: () => ({
                showDate: "2026-07-18",
                userId: "u2",
                picks: {},
              }),
            },
            {
              data: () => ({
                showDate: "2026-07-20",
                userId: "u3",
                picks: { closer: "Slave" },
              }),
            },
          ],
        }),
      }),
    }),
  };
  const map = await loadUserIdsWithPicksForShowDates(db, ["2026-07-18", "2026-07-20"]);
  assert.equal(map.get("2026-07-18").has("u1"), true);
  assert.equal(map.get("2026-07-18").has("u2"), false);
  assert.equal(map.get("2026-07-20").has("u3"), true);
});

test("isFinalShowOfTour is true only for the last dated show", () => {
  const dates = ["2026-08-01", "2026-08-03", "2026-08-02"];
  assert.equal(isFinalShowOfTour(dates, "2026-08-03"), true);
  assert.equal(isFinalShowOfTour(dates, "2026-08-01"), false);
  assert.equal(isFinalShowOfTour([], "2026-08-03"), false);
  assert.equal(isFinalShowOfTour(dates, ""), false);
});

test("buildTourRecapPodium takes top 3 plus two honorable mentions", () => {
  const leaders = [
    { handle: "A", totalPoints: 100, wins: 3, shows: 8 },
    { handle: "B", totalPoints: 90, wins: 2, shows: 8 },
    { handle: "C", totalPoints: 80, wins: 1, shows: 8 },
    { handle: "D", totalPoints: 70, wins: 1, shows: 7 },
    { handle: "E", totalPoints: 60, wins: 0, shows: 4 },
    { handle: "F", totalPoints: 50, wins: 0, shows: 3 },
  ];
  const podium = buildTourRecapPodium(leaders);
  assert.equal(podium.rows.length, 3);
  assert.equal(podium.rows[0].handle, "A");
  assert.equal(podium.rows[0].points, 100);
  assert.equal(podium.honorableMentions.length, 2);
  assert.match(podium.honorableMentions[0].note, /70 pts/);
  assert.match(podium.honorableMentions[1].note, /4 shows/);
});

test("buildTourRecapPodium names a points tie in the last honorable mention", () => {
  const leaders = [
    { handle: "A", totalPoints: 100, wins: 3, shows: 8, correctSlots: 24 },
    { handle: "B", totalPoints: 90, wins: 2, shows: 8 },
    { handle: "C", totalPoints: 80, wins: 1, shows: 8 },
    { handle: "D", totalPoints: 70, wins: 1, shows: 7 },
    { handle: "E", totalPoints: 60, wins: 0, shows: 4 },
    { handle: "F", totalPoints: 60, wins: 0, shows: 4 },
    { handle: "G", totalPoints: 40, wins: 0, shows: 2 },
  ];
  const podium = buildTourRecapPodium(leaders);
  assert.equal(podium.honorableMentions.length, 2);
  assert.equal(podium.honorableMentions[0].handle, "D");
  assert.equal(podium.honorableMentions[1].handle, "E and F");
  assert.match(podium.honorableMentions[1].note, /tied at 60 pts/);
  const board = buildTourRecapEmailBoard(leaders);
  assert.equal(board.length, 5);
  assert.equal(board[0].rank, 1);
  assert.equal(board[0].avg, ".500");
  assert.equal(board[4].handle, "E");
  assert.equal(board[4].avg, "");
});

test("buildTourRecapPayload uses tour metadata, not a Sphere live id", () => {
  const payload = buildTourRecapPayload({
    handle: "Pat",
    rank: 2,
    points: 90,
    wins: 1,
    showsPlayed: 8,
    participantCount: 12,
    tourId: "Summer Tour 2026",
    tourName: "Summer Tour 2026",
    showCount: 8,
    podium: { rows: [{ handle: "A", points: 100, wins: 3 }], honorableMentions: [] },
  });
  assert.equal(payload.tour_id, "Summer Tour 2026");
  assert.equal(payload.tour_name, "Summer Tour 2026");
  assert.match(payload.headline, /Summer Tour 2026/);
  assert.equal(payload.show_count, 8);
  assert.equal(
    payload.personal_line,
    "You finished #2 of 12 with 90 points and 1 nightly win, playing 8 of 8 shows.",
  );
  assert.equal(payload.personal_clause, "");
  assert.match(payload.opening_paras[1], /inexact science/);
  assert.deepEqual(payload.fact_label, {
    map: "tour_recap",
    branch: "top5",
    slots: ["rank", "points", "nightly_wins", "shows_played", "opening_fallback"],
    tourId: "Summer Tour 2026",
  });
  assert.doesNotMatch(JSON.stringify(payload), /sphere-2026-inaugural/);
  assert.doesNotMatch(JSON.stringify(payload), /Sphere '26 recap is in/);
});

function emptyPicksDb() {
  return {
    collection(name) {
      if (name === "comms_tour_recap_state") {
        return {
          doc() {
            return {
              async get() {
                return { exists: false, data: () => null };
              },
              async set() {
                /* no-op unless a test overrides */
              },
            };
          },
        };
      }
      return {
        where() {
          return {
            async get() {
              return { empty: true, docs: [] };
            },
          };
        },
        doc() {
          return {
            async get() {
              return { exists: false, data: () => ({}) };
            },
          };
        },
      };
    },
  };
}

test("deliverTourRecapIfFinalShow no-ops without a tour key or when not the final show", async () => {
  assert.equal(
    await deliverTourRecapIfFinalShow({
      db: {},
      runtime: { deliver: async () => ({ ok: true }) },
      showDate: "2026-08-01",
      tourKey: null,
      showDatesByTour: [],
    }),
    null
  );
  assert.equal(
    await deliverTourRecapIfFinalShow({
      db: {},
      runtime: { deliver: async () => ({ ok: true }) },
      showDate: "2026-08-01",
      tourKey: "Sample Tour",
      showDatesByTour: [{ tour: "Sample Tour", shows: [{ date: "2026-08-01" }, { date: "2026-08-02" }] }],
    }),
    null
  );
});

test("deliverPendingTourRecaps does not read in-progress, future, or ancient tours", async () => {
  const reads = [];
  const db = {
    collection(name) {
      if (name === "comms_tour_recap_state") {
        return {
          doc(id) {
            reads.push(id);
            assert.equal(String(id).includes("/"), false);
            return {
              async get() {
                return { exists: false, data: () => null };
              },
              async set() {},
            };
          },
        };
      }
      return emptyPicksDb().collection(name);
    },
  };
  const summaries = await deliverPendingTourRecaps({
    db,
    admin: { firestore: { FieldValue: { serverTimestamp: () => "TS" } } },
    runtime: { deliver: async () => ({ ok: true, delivered: 1 }) },
    showDatesByTour: [
      { tour: "2024 Mexico", shows: [{ date: "2024-02-21" }, { date: "2024-02-24" }] },
      { tour: "2026 Fall Tour", shows: [{ date: "2026-10-02" }, { date: "2026-10-11" }] },
      { tour: "2026/2027 NYE Run", shows: [{ date: "2026-12-30" }, { date: "2027-01-02" }] },
      { tour: "2026 Sphere", shows: [{ date: "2026-04-16" }, { date: "2026-05-02" }] },
    ],
    now: new Date("2026-10-08T15:00:00Z"),
  });
  assert.deepEqual(summaries, []);
  assert.deepEqual([...new Set(reads)], ["2026 Sphere"]);
});

test("deliverPendingTourRecaps reads a slash tour only inside the post-finale window", async () => {
  const reads = [];
  const db = {
    collection(name) {
      if (name === "comms_tour_recap_state") {
        return {
          doc(id) {
            reads.push(id);
            return {
              async get() {
                return { exists: false, data: () => null };
              },
              async set() {},
            };
          },
        };
      }
      return emptyPicksDb().collection(name);
    },
  };
  const summaries = await deliverPendingTourRecaps({
    db,
    runtime: { deliver: async () => ({ ok: true }) },
    showDatesByTour: [
      { tour: "2026/2027 NYE Run", shows: [{ date: "2026-12-30" }, { date: "2027-01-02" }] },
    ],
    now: new Date("2027-01-03T15:00:00Z"),
  });
  assert.deepEqual(reads, ["2026-2027 NYE Run"]);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].tourKey, "2026/2027 NYE Run");
});

test("deliverPendingTourRecaps skips finales that are still today or upcoming", async () => {
  const delivered = [];
  const runtime = { deliver: async (id) => { delivered.push(id); return { ok: true }; } };
  const showDatesByTour = [
    { tour: "Fall Tour 2026", shows: [{ date: "2026-10-02" }, { date: "2026-10-11" }] },
  ];
  assert.deepEqual(
    await deliverPendingTourRecaps({
      db: emptyPicksDb(),
      runtime,
      showDatesByTour,
      now: new Date("2026-10-11T15:00:00-07:00"),
    }),
    []
  );
  assert.deepEqual(delivered, []);
});

test("deliverPendingTourRecaps attempts tour_recap the morning after the finale", async () => {
  const showDatesByTour = [
    { tour: "Summer Tour 2026", shows: [{ date: "2026-07-11" }, { date: "2026-09-06" }] },
  ];
  const summaries = await deliverPendingTourRecaps({
    db: emptyPicksDb(),
    runtime: { deliver: async () => ({ ok: true }) },
    showDatesByTour,
    now: new Date("2026-09-07T08:00:00-07:00"),
  });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].tourKey, "Summer Tour 2026");
  assert.equal(summaries[0].finalDate, "2026-09-06");
  assert.equal(summaries[0].summary.skipped, "no_eligible_players");
});

test("isSphereArchiveTourKey matches calendar Sphere labels (#1033)", () => {
  assert.equal(isSphereArchiveTourKey("2026 Sphere"), true);
  assert.equal(isSphereArchiveTourKey("Sphere Run"), true);
  assert.equal(isSphereArchiveTourKey("Sphere '26"), true);
  assert.equal(isSphereArchiveTourKey("2026 Summer Tour"), false);
  assert.equal(isSphereArchiveTourKey("Fall Tour 2026"), false);
});

test("shouldAttemptPendingTourRecap enforces lookback and Sphere skip (#1033)", () => {
  assert.equal(MAX_TOUR_RECAP_LOOKBACK_DAYS, 14);
  assert.equal(
    shouldAttemptPendingTourRecap({
      tourKey: "2026 Summer Tour",
      finalDate: "2026-09-06",
      today: "2026-09-07",
    }),
    true
  );
  assert.equal(
    shouldAttemptPendingTourRecap({
      tourKey: "2026 Summer Tour",
      finalDate: "2026-09-06",
      today: "2026-09-20",
    }),
    true
  );
  assert.equal(
    shouldAttemptPendingTourRecap({
      tourKey: "2026 Summer Tour",
      finalDate: "2026-09-06",
      today: "2026-09-21",
    }),
    false
  );
  assert.equal(
    shouldAttemptPendingTourRecap({
      tourKey: "2026 Sphere",
      finalDate: "2026-05-02",
      today: "2026-09-09",
    }),
    false
  );
  assert.equal(
    shouldAttemptPendingTourRecap({
      tourKey: "2026 Sphere",
      finalDate: "2026-05-02",
      today: "2026-05-03",
    }),
    false
  );
});

test("deliverPendingTourRecaps skips archive Sphere and finales outside lookback (#1033)", async () => {
  const delivered = [];
  /** @type {Map<string, object>} */
  const stateDocs = new Map();
  const db = {
    ...emptyPicksDb(),
    collection(name) {
      if (name === "comms_tour_recap_state") {
        return {
          doc(id) {
            return {
              async get() {
                const data = stateDocs.get(id);
                return { exists: Boolean(data), data: () => data };
              },
              async set(payload, opts) {
                assert.equal(opts?.merge, true);
                stateDocs.set(id, { ...(stateDocs.get(id) || {}), ...payload });
              },
            };
          },
        };
      }
      return emptyPicksDb().collection(name);
    },
  };
  const admin = {
    firestore: { FieldValue: { serverTimestamp: () => "TS" } },
  };
  const runtime = {
    deliver: async (id) => {
      delivered.push(id);
      return { ok: true };
    },
  };
  const showDatesByTour = [
    {
      tour: "2026 Sphere",
      shows: [{ date: "2026-04-16" }, { date: "2026-05-02" }],
    },
    {
      tour: "Ancient Tour",
      shows: [{ date: "2026-01-01" }, { date: "2026-01-15" }],
    },
    {
      tour: "2026 Summer Tour",
      shows: [{ date: "2026-07-11" }, { date: "2026-09-06" }],
    },
  ];
  const summaries = await deliverPendingTourRecaps({
    db,
    admin,
    runtime,
    showDatesByTour,
    now: new Date("2026-09-09T08:00:00-07:00"),
  });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].tourKey, "2026 Summer Tour");
  assert.deepEqual(delivered, []);
  assert.equal(stateDocs.get("2026 Sphere")?.status, "skipped_archive");
});

test("deliverPendingTourRecaps hard-skips tours with terminal state (#1033 once-ever)", async () => {
  const delivered = [];
  /** @type {Map<string, object>} */
  const stateDocs = new Map([
    ["2026 Summer Tour", { status: "sent", finalDate: "2026-09-06" }],
  ]);
  const db = {
    collection(name) {
      if (name === "comms_tour_recap_state") {
        return {
          doc(id) {
            return {
              async get() {
                const data = stateDocs.get(id);
                return { exists: Boolean(data), data: () => data };
              },
              async set() {
                assert.fail("should not rewrite terminal state");
              },
            };
          },
        };
      }
      return emptyPicksDb().collection(name);
    },
  };
  const summaries = await deliverPendingTourRecaps({
    db,
    admin: { firestore: { FieldValue: { serverTimestamp: () => "TS" } } },
    runtime: {
      deliver: async (id) => {
        delivered.push(id);
        return { ok: true, delivered: 5 };
      },
    },
    showDatesByTour: [
      {
        tour: "2026 Summer Tour",
        shows: [{ date: "2026-07-11" }, { date: "2026-09-06" }],
      },
    ],
    now: new Date("2026-09-09T08:00:00-07:00"),
  });
  assert.deepEqual(summaries, []);
  assert.deepEqual(delivered, []);
});

test("deliverPendingTourRecaps marks tour sent after successful fan-out", async () => {
  /** @type {Map<string, object>} */
  const stateDocs = new Map();
  const picks = [
    {
      id: "p1",
      data: () => ({
        userId: "u1",
        showDate: "2026-09-08",
        handle: "A",
        picks: { s1o: "Song" },
        score: 10,
        isGraded: true,
        isWinner: false,
      }),
    },
  ];
  const db = {
    collection(name) {
      if (name === "comms_tour_recap_state") {
        return {
          doc(id) {
            return {
              async get() {
                const data = stateDocs.get(id);
                return { exists: Boolean(data), data: () => data };
              },
              async set(payload, opts) {
                assert.equal(opts?.merge, true);
                stateDocs.set(id, { ...(stateDocs.get(id) || {}), ...payload });
              },
            };
          },
        };
      }
      if (name === "picks") {
        return {
          where() {
            return {
              async get() {
                return { empty: picks.length === 0, docs: picks };
              },
            };
          },
        };
      }
      if (name === "users") {
        return {
          doc() {
            return {
              async get() {
                return { exists: true, data: () => ({ handle: "A" }) };
              },
            };
          },
        };
      }
      return emptyPicksDb().collection(name);
    },
  };
  const summaries = await deliverPendingTourRecaps({
    db,
    admin: { firestore: { FieldValue: { serverTimestamp: () => "TS" } } },
    runtime: {
      deliver: async () => ({ ok: true, delivered: 1, processed: 1, byChannel: { inApp: 1 } }),
    },
    showDatesByTour: [
      {
        tour: "Fall Warmup",
        shows: [{ date: "2026-09-01" }, { date: "2026-09-08" }],
      },
    ],
    now: new Date("2026-09-09T08:00:00-07:00"),
  });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].summary.delivered, 1);
  assert.equal(stateDocs.get("Fall Warmup")?.status, "sent");
  assert.equal(stateDocs.get("Fall Warmup")?.finalDate, "2026-09-08");
});

test("shouldSkipTourRankingsOnTourRecapMorning only on the finale date", () => {
  const dates = ["2026-07-11", "2026-09-04", "2026-09-06"];
  assert.equal(shouldSkipTourRankingsOnTourRecapMorning(dates, "2026-09-06"), true);
  assert.equal(shouldSkipTourRankingsOnTourRecapMorning(dates, "2026-09-04"), false);
  assert.equal(shouldSkipTourRankingsOnTourRecapMorning(dates, "2026-07-11"), false);
});

test("deliverPendingTourRecaps continues after one tour throws", async () => {
  const db = {
    collection(name) {
      if (name === "comms_tour_recap_state") {
        return {
          doc(id) {
            return {
              async get() {
                if (id === "Boom Tour") throw new Error("state read failed");
                return { exists: false, data: () => null };
              },
              async set() {},
            };
          },
        };
      }
      return emptyPicksDb().collection(name);
    },
  };
  const summaries = await deliverPendingTourRecaps({
    db,
    runtime: { deliver: async () => ({ ok: true, delivered: 0 }) },
    showDatesByTour: [
      { tour: "Boom Tour", shows: [{ date: "2026-09-28" }, { date: "2026-10-01" }] },
      { tour: "Next Tour", shows: [{ date: "2026-09-29" }, { date: "2026-10-02" }] },
    ],
    now: new Date("2026-10-08T15:00:00Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].tourKey, "Next Tour");
});

test("runScheduledTourRankingsDaily still checks yesterday when a wrap tour throws", async () => {
  const prev = process.env.COMMS_EVENT_ADAPTERS_ENABLED;
  process.env.COMMS_EVENT_ADAPTERS_ENABLED = "true";
  const picksQueries = [];
  const db = {
    collection(name) {
      if (name === "show_calendar") {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    showDates: [
                      { date: "2026-10-07", timeZone: "America/Los_Angeles", venue: "Chase Center" },
                      { date: "2026-11-01", timeZone: "Not/A/Zone" },
                    ],
                    showDatesByTour: [
                      {
                        tour: "2026 Fall Tour",
                        shows: [{ date: "2026-10-07" }, { date: "2026-10-11" }],
                      },
                      {
                        tour: "Boom Tour",
                        shows: [{ date: "2026-09-28" }, { date: "2026-10-01" }],
                      },
                    ],
                  }),
                };
              },
            };
          },
        };
      }
      if (name === "comms_tour_recap_state") {
        return {
          doc() {
            return {
              async get() {
                throw new Error("state read failed");
              },
            };
          },
        };
      }
      if (name === "picks") {
        return {
          where(_field, _op, showDate) {
            picksQueries.push(showDate);
            return {
              async get() {
                return { empty: true, docs: [] };
              },
            };
          },
        };
      }
      return {
        doc() {
          return {
            async get() {
              return { exists: false, data: () => ({}) };
            },
          };
        },
      };
    },
  };
  try {
    const result = await runScheduledTourRankingsDaily({
      db,
      admin: { firestore: { FieldValue: { serverTimestamp: () => "TS" } } },
      now: new Date("2026-10-08T15:00:00Z"),
      logger: { info() {}, warn() {}, error() {} },
    });
    assert.ok(result);
    assert.deepEqual(picksQueries, ["2026-10-07"]);
  } finally {
    if (prev === undefined) delete process.env.COMMS_EVENT_ADAPTERS_ENABLED;
    else process.env.COMMS_EVENT_ADAPTERS_ENABLED = prev;
  }
});
