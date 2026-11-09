const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  ALL_TIME_DOC_ID,
  GLOBAL_LEADERBOARD_MIN_SHOWS,
  GLOBAL_LEADERBOARD_SLOTS_PER_SHOW,
  GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS,
  GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME,
  GLOBAL_LEADERBOARD_TOP_N,
  buildDebutYearBySongName,
  buildLeaderboardPayloads,
  computePickingAverage,
  computePointsPerShow,
  computeSluggingPercentage,
  dateToTourKeyMap,
  meanDebutYear,
  rankBoard,
  tourLeaderboardDocId,
  vintageByUidFromPicks,
  vintagePersistPatch,
} = require("./globalStatsLeaderboards");

describe("global stats ratios (#1004)", () => {
  it("points per show is totalPoints / shows", () => {
    assert.equal(computePointsPerShow(30, 3), 10);
    assert.equal(computePointsPerShow(7, 2), 3.5);
    assert.equal(computePointsPerShow(10, 0), null);
    assert.equal(computePointsPerShow(undefined, 4), null);
  });

  it("slugging percentage is totalPoints / (shows * 30)", () => {
    assert.equal(GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS, 30);
    assert.equal(GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME, 15);
    assert.equal(computeSluggingPercentage(300, 20), 0.5);
    assert.equal(computeSluggingPercentage(90, 3), 1);
    assert.equal(computeSluggingPercentage(10, 0), null);
    assert.equal(computeSluggingPercentage(undefined, 16), null);
  });

  it("picking average is correctSlots / (shows * 6)", () => {
    assert.equal(GLOBAL_LEADERBOARD_SLOTS_PER_SHOW, 6);
    assert.equal(computePickingAverage(9, 3), 0.5);
    assert.equal(computePickingAverage(6, 1), 1);
    assert.equal(computePickingAverage(null, 4), null);
    assert.equal(computePickingAverage(12, 0), null);
  });
});

describe("rankBoard min-shows gate + ranking", () => {
  const rows = [
    { uid: "spike", handle: "Spike", value: 20, shows: 1 },
    { uid: "steady", handle: "Steady", value: 12, shows: 4 },
    { uid: "mid", handle: "Mid", value: 11, shows: 3 },
    { uid: "low", handle: "Low", value: 10, shows: 8 },
    { uid: "tieA", handle: "Ada", value: 12, shows: 4 },
    { uid: "nogame", handle: "NoGame", value: null, shows: 5 },
  ];

  it("drops one-show spikes from ratio boards (default minShows = 3)", () => {
    assert.equal(GLOBAL_LEADERBOARD_MIN_SHOWS, 3);
    const ranked = rankBoard(rows);
    assert.equal(
      ranked.some((r) => r.uid === "spike"),
      false
    );
    assert.equal(ranked[0].uid, "tieA");
    assert.equal(ranked[1].uid, "steady");
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].rank, 1);
    assert.equal(ranked[2].uid, "mid");
    assert.equal(ranked[2].rank, 3);
  });

  it("shows-count board has no ratio gate", () => {
    const showRows = [
      { uid: "a", handle: "A", value: 1, shows: 1 },
      { uid: "b", handle: "B", value: 12, shows: 12 },
      { uid: "c", handle: "C", value: 12, shows: 12 },
    ];
    const ranked = rankBoard(showRows, { minShows: 0 });
    assert.equal(ranked.length, 3);
    assert.equal(ranked[0].uid, "b");
    assert.equal(ranked[1].uid, "c");
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].rank, 1);
    assert.equal(ranked[2].uid, "a");
    assert.equal(ranked[2].rank, 3);
  });

  it("caps at top 50", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      uid: `u${i}`,
      handle: `H${String(i).padStart(2, "0")}`,
      value: 60 - i,
      shows: 5,
    }));
    const ranked = rankBoard(many);
    assert.equal(ranked.length, GLOBAL_LEADERBOARD_TOP_N);
    assert.equal(ranked[0].uid, "u0");
    assert.equal(ranked[49].uid, "u49");
  });
});

describe("buildLeaderboardPayloads", () => {
  const users = [
    {
      uid: "alice",
      handle: "Alice",
      totalPoints: 40,
      showsPlayed: 4,
      careerCorrectSlots: 12,
      seasonStats: {
        "2026 Summer Tour": { totalPoints: 20, shows: 2, correctSlots: 6 },
        "2026 Sphere": { totalPoints: 20, shows: 4, correctSlots: 8 },
      },
    },
    {
      uid: "bob",
      handle: "Bob",
      totalPoints: 90,
      showsPlayed: 6,
      careerCorrectSlots: 24,
      seasonStats: {
        "2026 Summer Tour": { totalPoints: 45, shows: 3, correctSlots: 12 },
      },
    },
    {
      uid: "oneShow",
      handle: "Spike",
      totalPoints: 40,
      showsPlayed: 1,
      careerCorrectSlots: 6,
      seasonStats: {
        "2026 Summer Tour": { totalPoints: 40, shows: 1, correctSlots: 6 },
      },
    },
    {
      uid: "vet",
      handle: "Vet",
      totalPoints: 200,
      showsPlayed: 20,
      careerCorrectSlots: 60,
      seasonStats: {
        "2026 Summer Tour": { totalPoints: 80, shows: 10, correctSlots: 30 },
      },
    },
    {
      uid: "iron",
      handle: "Iron",
      totalPoints: 240,
      showsPlayed: 25,
      careerCorrectSlots: 75,
      seasonStats: {
        "2026 Summer Tour": { totalPoints: 90, shows: 10, correctSlots: 30 },
      },
    },
  ];

  it("writes all-time plus the requested tour only", () => {
    const payloads = buildLeaderboardPayloads({
      users,
      tourKey: "2026 Summer Tour",
    });
    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].docId, ALL_TIME_DOC_ID);
    assert.equal(payloads[1].docId, tourLeaderboardDocId("2026 Summer Tour"));
    assert.equal(
      payloads[0].boards.pointsPerShow.some((r) => r.uid === "oneShow"),
      false
    );
    assert.equal(payloads[0].boards.pointsPerShow[0].uid, "bob");
    assert.equal(payloads[0].boards.shows.some((r) => r.uid === "oneShow"), true);
    assert.equal(
      payloads[0].boards.sluggingPercentage.some((r) => r.uid === "bob"),
      false
    );
    assert.deepEqual(
      payloads[0].boards.sluggingPercentage.map((r) => r.uid),
      ["vet", "iron"]
    );
    assert.equal(payloads[0].boards.sluggingPercentage[0].value, 200 / 600);
    assert.equal(payloads[0].boards.sluggingPercentage[1].value, 240 / 750);
    assert.equal(
      payloads[1].boards.pointsPerShow.some((r) => r.uid === "alice"),
      false
    );
    assert.equal(payloads[1].boards.pointsPerShow[0].uid, "bob");
    assert.equal(payloads[1].boards.shows.length, 5);
    assert.equal(payloads[1].boards.sluggingPercentage[0].uid, "bob");
    assert.equal(
      payloads[1].boards.sluggingPercentage.some((r) => r.uid === "oneShow"),
      false
    );
    assert.equal(
      payloads[1].boards.sluggingPercentage.some((r) => r.uid === "vet"),
      true
    );
  });

  it("allTours emits every seasonStats tour plus all-time", () => {
    const payloads = buildLeaderboardPayloads({ users, allTours: true });
    const ids = payloads.map((p) => p.docId).sort();
    assert.deepEqual(ids, [
      ALL_TIME_DOC_ID,
      tourLeaderboardDocId("2026 Sphere"),
      tourLeaderboardDocId("2026 Summer Tour"),
    ]);
  });
});

describe("rebuildGlobalStatsLeaderboards writer", () => {
  it("scans users pages and writes aggregate docs", async () => {
    const { rebuildGlobalStatsLeaderboards } = require("./globalStatsLeaderboards");
    const written = [];
    const page1 = {
      empty: false,
      size: 1,
      docs: [
        {
          id: "alice",
          data: () => ({
            handle: "Alice",
            totalPoints: 30,
            showsPlayed: 3,
            careerCorrectSlots: 9,
            seasonStats: {
              "2026 Summer Tour": { totalPoints: 30, shows: 3, correctSlots: 9 },
            },
          }),
        },
      ],
    };
    const emptyPage = { empty: true, size: 0, docs: [] };
    let calls = 0;

    const db = {
      collection(name) {
        if (name === "users") {
          return {
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            startAfter() {
              return this;
            },
            async get() {
              calls += 1;
              return calls === 1 ? page1 : emptyPage;
            },
          };
        }
        if (name === "global_stats_leaderboards") {
          return {
            doc(id) {
              return {
                async set(data) {
                  written.push({ id, data });
                },
              };
            },
          };
        }
        throw new Error(`unexpected collection ${name}`);
      },
    };

    const admin = {
      firestore: { FieldValue: { serverTimestamp: () => "TS" } },
    };

    const result = await rebuildGlobalStatsLeaderboards({
      db,
      admin,
      tourKey: "2026 Summer Tour",
      trigger: "rollup",
      vintageByUid: new Map(),
    });

    assert.equal(result.usersScanned, 1);
    assert.equal(result.docsWritten, 2);
    assert.equal(written[0].id, ALL_TIME_DOC_ID);
    assert.equal(written[1].id, tourLeaderboardDocId("2026 Summer Tour"));
    assert.equal(written[0].data.trigger, "rollup");
    assert.equal(written[0].data.schemaVersion, 3);
    assert.equal(result.vintageStatus, "ok");
    assert.deepEqual(written[0].data.boards.averageVintage, []);
    assert.deepEqual(written[0].data.boards.bustoutBoosts, []);
    assert.equal(written[0].data.minShows, 3);
    assert.equal(written[0].data.sluggingMinShows, 15);
    assert.equal(written[0].data.sluggingMinShowsAllTime, 15);
    assert.equal(written[1].data.sluggingMinShows, 3);
    assert.equal(written[0].data.slotsPerShow, 6);
    assert.equal(written[0].data.boards.pointsPerShow[0].uid, "alice");
  });
});

describe("average vintage and bustout boost (#1044)", () => {
  it("rounds the mean debut year of unique titles and drops unknown debuts", () => {
    const debuts = buildDebutYearBySongName([
      { name: "Tweezer", debut: "1990-08-01" },
      { name: "Ghost", debut: "1997-07-23" },
      { name: "No Debut", debut: "" },
    ]);
    assert.equal(
      meanDebutYear(new Set(["tweezer", "ghost", "no debut"]), debuts),
      Math.round((1990 + 1997) / 2)
    );
    assert.equal(meanDebutYear(new Set(["no debut"]), debuts), null);
  });

  it("keeps career and tour sets separate and skips ungraded picks", () => {
    const debuts = buildDebutYearBySongName([
      { name: "Tweezer", debut: "1990-01-01" },
      { name: "Ghost", debut: "1998-01-01" },
      { name: "Fee", debut: "1985-01-01" },
    ]);
    const dateToTour = dateToTourKeyMap([
      {
        tour: "2026 Summer Tour",
        shows: [{ date: "2026-07-01" }, { date: "2026-07-02" }],
      },
      { tour: "2026 Sphere", shows: [{ date: "2026-04-01" }] },
    ]);
    const vintage = vintageByUidFromPicks(
      [
        {
          userId: "alice",
          showDate: "2026-07-01",
          isGraded: true,
          picks: { s1o: "Tweezer", s1c: "Tweezer", wild: "Ghost" },
        },
        {
          userId: "alice",
          showDate: "2026-04-01",
          isGraded: true,
          picks: { s1o: "Fee" },
        },
        {
          userId: "alice",
          showDate: "2026-07-02",
          isGraded: false,
          picks: { s1o: "Fee" },
        },
      ],
      dateToTour,
      debuts
    );
    const alice = vintage.get("alice");
    assert.equal(alice.careerYear, Math.round((1990 + 1998 + 1985) / 3));
    assert.equal(alice.byTour["2026 Summer Tour"], Math.round((1990 + 1998) / 2));
    assert.equal(alice.byTour["2026 Sphere"], 1985);
  });

  it("ranks an older year first and counts bustout slots, including a one-show positive count", () => {
    const users = [
      {
        uid: "old",
        handle: "Old",
        totalPoints: 40,
        showsPlayed: 4,
        careerCorrectSlots: 8,
        seasonStats: {
          "2026 Summer Tour": {
            totalPoints: 40,
            shows: 4,
            correctSlots: 8,
            bustoutBoosts: 1,
          },
          "2026 Sphere": {
            totalPoints: 10,
            shows: 2,
            correctSlots: 2,
            bustoutBoosts: 2,
          },
        },
      },
      {
        uid: "newSong",
        handle: "New",
        totalPoints: 90,
        showsPlayed: 6,
        careerCorrectSlots: 12,
        seasonStats: {
          "2026 Summer Tour": {
            totalPoints: 90,
            shows: 6,
            correctSlots: 12,
            bustoutBoosts: 0,
          },
        },
      },
      {
        uid: "spike",
        handle: "Spike",
        totalPoints: 20,
        showsPlayed: 1,
        careerCorrectSlots: 2,
        seasonStats: {
          "2026 Summer Tour": {
            totalPoints: 20,
            shows: 1,
            correctSlots: 2,
            bustoutBoosts: 6,
          },
        },
      },
    ];
    const vintage = new Map([
      ["old", { careerYear: 1988, byTour: { "2026 Summer Tour": 1990 } }],
      ["newSong", { careerYear: 2004, byTour: { "2026 Summer Tour": 2001 } }],
      ["spike", { careerYear: 1970, byTour: { "2026 Summer Tour": 1970 } }],
    ]);
    const payloads = buildLeaderboardPayloads({
      users,
      tourKey: "2026 Summer Tour",
      vintageByUid: vintage,
    });
    assert.deepEqual(
      payloads[0].boards.averageVintage.map((row) => row.uid),
      ["old", "newSong"]
    );
    assert.equal(payloads[0].boards.averageVintage[0].value, 1988);
    assert.equal(payloads[0].boards.averageVintage[0].rank, 1);
    assert.deepEqual(
      payloads[0].boards.bustoutBoosts.map((row) => [row.uid, row.value]),
      [
        ["spike", 6],
        ["old", 3],
      ]
    );
    assert.equal(
      payloads[1].boards.bustoutBoosts.some((row) => row.uid === "newSong"),
      false
    );
    assert.equal(payloads[1].boards.bustoutBoosts[0].uid, "spike");
    assert.equal(payloads[1].boards.averageVintage[0].uid, "old");
    assert.equal(
      payloads[1].boards.averageVintage.some((row) => row.uid === "spike"),
      false
    );
  });

  it("leaves a matching vintage write alone and clears a stale year", () => {
    assert.equal(
      vintagePersistPatch(
        {
          uid: "alice",
          avgVintageYear: 1994,
          avgVintageByTour: { "2026 Summer Tour": 1991 },
        },
        { careerYear: 1994, byTour: { "2026 Summer Tour": 1991 } }
      ),
      null
    );
    assert.deepEqual(
      vintagePersistPatch(
        {
          uid: "alice",
          avgVintageYear: 1994,
          avgVintageByTour: { Sphere: 1980 },
        },
        { careerYear: null, byTour: {} }
      ),
      {
        uid: "alice",
        avgVintageYear: null,
        avgVintageByTour: null,
      }
    );
  });

  it("keeps the previous average vintage board when the catalog load fails", async () => {
    const { rebuildGlobalStatsLeaderboards } = require("./globalStatsLeaderboards");
    const prior = [
      { uid: "kept", handle: "Kept", value: 1991, shows: 4, rank: 1 },
    ];
    const written = [];
    const userPage = {
      empty: false,
      size: 1,
      docs: [
        {
          id: "alice",
          data: () => ({
            handle: "Alice",
            totalPoints: 30,
            showsPlayed: 3,
            careerCorrectSlots: 9,
            seasonStats: {
              "2026 Summer Tour": {
                totalPoints: 30,
                shows: 3,
                correctSlots: 9,
                bustoutBoosts: 2,
              },
            },
          }),
        },
      ],
    };
    let userGets = 0;
    const db = {
      collection(name) {
        if (name === "users") {
          return {
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            startAfter() {
              return this;
            },
            async get() {
              userGets += 1;
              return userGets === 1
                ? userPage
                : { empty: true, size: 0, docs: [] };
            },
          };
        }
        if (name === "global_stats_leaderboards") {
          return {
            doc(id) {
              return {
                async get() {
                  if (id !== ALL_TIME_DOC_ID) return { exists: false, data: () => ({}) };
                  return {
                    exists: true,
                    data: () => ({ boards: { averageVintage: prior } }),
                  };
                },
                async set(data) {
                  written.push({ id, data });
                },
              };
            },
          };
        }
        throw new Error(`unexpected collection ${name}`);
      },
    };
    const admin = {
      firestore: { FieldValue: { serverTimestamp: () => "TS" } },
    };
    const result = await rebuildGlobalStatsLeaderboards({
      db,
      admin,
      tourKey: "2026 Summer Tour",
      trigger: "scheduled",
      loadVintage: async () => {
        throw new Error("catalog down");
      },
    });
    assert.equal(result.vintageStatus, "skipped");
    assert.equal(written[0].data.boards.averageVintage, prior);
    assert.equal(written[0].data.boards.bustoutBoosts[0].uid, "alice");
    assert.equal(written[0].data.boards.bustoutBoosts[0].value, 2);
    assert.equal(written[1].data.boards.averageVintage.length, 0);
  });
});
