"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ANNUAL_SLUGGING_MIN_SHOWS,
  TOUR_RATE_MIN_SHOWS,
  awardsForTourPlayer,
  awardsForYearPlayer,
  buildTourRankSnapshot,
  buildYearRankSnapshot,
  evangelistAward,
  yearIsClosed,
} = require("./badgeRankSnapshots");

function gradedPick(uid, handle, score, extra = {}) {
  return {
    userId: uid,
    handle,
    score,
    isGraded: true,
    picks: { s1o: "Tweezer" },
    correctSlotsCredited: 3,
    ...extra,
  };
}

function setlist(bustouts = []) {
  return {
    s1o: "Tweezer",
    s1c: "",
    s2o: "",
    s2c: "",
    enc: "",
    wild: "",
    officialSetlist: ["Tweezer"],
    bustouts,
  };
}

test("buildTourRankSnapshot: full field, ties share a rank, outside the top 50", () => {
  const picks = [];
  for (let i = 0; i < 51; i += 1) {
    picks.push(gradedPick(`u${i}`, `P${String(i).padStart(2, "0")}`, 100 - i));
  }
  picks.push(gradedPick("tie", "Tie", 100));
  const snapshot = buildTourRankSnapshot({
    tourKey: "2026 Summer Tour",
    sourceThroughShow: "2026-08-03",
    picksByDate: [{ date: "2026-08-03", picks }],
    setlistsByDate: { "2026-08-03": setlist() },
  });
  assert.equal(snapshot.players.length, 52);
  const leader = snapshot.players.find((row) => row.uid === "u0");
  const tied = snapshot.players.find((row) => row.uid === "tie");
  const last = snapshot.players.find((row) => row.uid === "u50");
  assert.equal(leader.rank, 1);
  assert.equal(tied.rank, 1);
  assert.equal(leader.tiedCount, 2);
  assert.equal(last.rank, 52);
  assert.ok(last.rank > 50);
});

test("buildTourRankSnapshot: rate leaders need 3 shows, bustouts need a count, triple crown is all three", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03"];
  const picksByDate = dates.map((date, index) => ({
    date,
    picks: [
      gradedPick("ace", "Ace", 30, {
        picks: { s1o: "Tweezer" },
        correctSlotsCredited: 6,
      }),
      gradedPick("bee", "Bee", 10, {
        picks: { s1o: "Reba" },
        correctSlotsCredited: 1,
      }),
      gradedPick("short", "Short", index === 0 ? 40 : 0, {
        picks: { s1o: "Tweezer" },
        correctSlotsCredited: 6,
        ...(index === 0 ? {} : { picks: {}, isGraded: false }),
      }),
    ].filter((pick) => pick.isGraded !== false || index === 0),
  }));
  // Short plays only the first show (perfect) and must not lead a rate board.
  picksByDate[1].picks = picksByDate[1].picks.filter((pick) => pick.userId !== "short");
  picksByDate[2].picks = picksByDate[2].picks.filter((pick) => pick.userId !== "short");

  const setlistsByDate = {
    "2026-07-01": setlist(["Tweezer"]),
    "2026-07-02": setlist(["Tweezer"]),
    "2026-07-03": setlist([]),
  };
  const snapshot = buildTourRankSnapshot({
    tourKey: "Summer",
    sourceThroughShow: "2026-07-03",
    picksByDate,
    setlistsByDate,
  });
  const ace = snapshot.players.find((row) => row.uid === "ace");
  const bee = snapshot.players.find((row) => row.uid === "bee");
  const short = snapshot.players.find((row) => row.uid === "short");
  assert.equal(ace.shows, 3);
  assert.equal(ace.bustoutBoosts, 2);
  assert.equal(ace.battingRank, 1);
  assert.equal(ace.ppsRank, 1);
  assert.equal(ace.bustoutRank, 1);
  assert.equal(bee.battingRank > 1 || bee.battingRank === null, true);
  assert.equal(bee.bustoutRank, null);
  assert.equal(short.shows, 1);
  assert.equal(short.battingRank, null);
  assert.equal(short.ppsRank, null);
  assert.ok(short.bustoutBoosts > 0);
  assert.equal(snapshot.rateMinShows, TOUR_RATE_MIN_SHOWS);
});

test("tour awards: once per tour, repeats are new ids, second run keeps awardedAt", () => {
  const player = {
    rank: 1,
    tiedCount: 1,
    battingRank: 1,
    ppsRank: 1,
    bustoutRank: 1,
  };
  const first = awardsForTourPlayer(player, {}, {
    tourKey: "Summer",
    sourceThroughShow: "2026-08-03",
  });
  assert.deepEqual(
    first.map((award) => award.id),
    [
      "tour_winner_1",
      "tour_top5_1",
      "tour_lead_batting_avg",
      "tour_lead_points_per_show",
      "tour_lead_bustout_boosts",
      "triple_crown",
    ]
  );
  const existing = {};
  for (const award of first) {
    existing[award.id] = {
      awardedAt: "frozen",
      scope: award.scope,
      sourceThroughShow: award.sourceThroughShow,
    };
  }
  assert.deepEqual(
    awardsForTourPlayer(player, existing, {
      tourKey: "Summer",
      sourceThroughShow: "2026-08-03",
    }),
    []
  );

  const second = awardsForTourPlayer(player, existing, {
    tourKey: "Fall",
    sourceThroughShow: "2026-12-31",
  });
  assert.deepEqual(
    second.map((award) => award.id),
    ["tour_winner_2", "tour_top5_2"]
  );
  assert.equal(second[0].scope, "tour:Fall");

  const twice = {
    ...existing,
    tour_winner_2: { awardedAt: "frozen", scope: "tour:Fall" },
    tour_top5_2: { awardedAt: "frozen", scope: "tour:Fall" },
  };
  const third = awardsForTourPlayer(
    { rank: 1, battingRank: null, ppsRank: null, bustoutRank: null },
    twice,
    { tourKey: "NYE", sourceThroughShow: "2026-12-31" }
  );
  assert.deepEqual(
    third.map((award) => award.id),
    ["tour_winner_3", "tour_top5_3"]
  );
  const full = {
    ...twice,
    tour_winner_3: { awardedAt: "frozen", scope: "tour:NYE" },
    tour_top5_3: { awardedAt: "frozen", scope: "tour:NYE" },
  };
  assert.deepEqual(
    awardsForTourPlayer(player, full, {
      tourKey: "2027 Summer",
      sourceThroughShow: "2027-08-01",
    }),
    []
  );
});

test("tour awards: rank 5 including a tie is top 5, rank 6 is not, a tie for 1st wins", () => {
  const scope = { tourKey: "Summer", sourceThroughShow: "2026-08-03" };
  assert.equal(
    awardsForTourPlayer({ rank: 5, tiedCount: 2 }, {}, scope).some(
      (award) => award.id === "tour_top5_1"
    ),
    true
  );
  assert.deepEqual(awardsForTourPlayer({ rank: 6 }, {}, scope), []);
  const winners = awardsForTourPlayer({ rank: 1, tiedCount: 2 }, {}, scope);
  assert.equal(
    winners.some((award) => award.id === "tour_winner_1"),
    true
  );
});

test("buildYearRankSnapshot: that calendar year only, slugging floor is 10, not the all-time board", () => {
  const yearShows = [];
  for (let i = 0; i < 10; i += 1) {
    const day = String(i + 1).padStart(2, "0");
    yearShows.push({
      date: `2025-07-${day}`,
      picks: [
        gradedPick("long", "Long", 10, { correctSlotsCredited: 2 }),
        gradedPick("hot", "Hot", 30, { correctSlotsCredited: 6 }),
      ],
    });
  }
  yearShows.push({
    date: "2024-12-31",
    picks: [gradedPick("old", "Old", 500)],
  });
  yearShows.push({
    date: "2026-01-01",
    picks: [gradedPick("next", "Next", 500)],
  });
  // Hot only played 9 of the 10 shows.
  yearShows[9].picks = yearShows[9].picks.filter((pick) => pick.userId !== "hot");

  const snapshot = buildYearRankSnapshot({
    year: "2025",
    sourceThroughShow: "2025-07-10",
    picksByDate: yearShows,
  });
  assert.deepEqual(
    snapshot.players.map((row) => row.uid).sort(),
    ["hot", "long"]
  );
  const long = snapshot.players.find((row) => row.uid === "long");
  const hot = snapshot.players.find((row) => row.uid === "hot");
  assert.equal(long.shows, 10);
  assert.equal(hot.shows, 9);
  assert.equal(long.rank === 1 || hot.rank === 1, true);
  assert.notEqual(long.rank, hot.rank);
  assert.equal(hot.sluggingRank, null);
  assert.equal(long.sluggingEligible, true);
  assert.equal(long.sluggingRank, 1);
  assert.equal(snapshot.sluggingMinShows, ANNUAL_SLUGGING_MIN_SHOWS);
  assert.notEqual(ANNUAL_SLUGGING_MIN_SHOWS, 15);
  assert.notEqual(ANNUAL_SLUGGING_MIN_SHOWS, 3);
});

test("year awards: points tie shares the year, slugging top 5 repeats, second run is a no-op", () => {
  const leader = { rank: 1, tiedCount: 2, sluggingRank: 1, sluggingTiedCount: 1 };
  const first = awardsForYearPlayer(leader, {}, {
    year: "2025",
    sourceThroughShow: "2025-12-31",
  });
  assert.deepEqual(
    first.map((award) => award.id),
    ["year_winner_1", "year_slugging_leader_1", "year_slugging_top5_1"]
  );
  const existing = {};
  for (const award of first) {
    existing[award.id] = { awardedAt: "frozen", scope: award.scope };
  }
  assert.deepEqual(
    awardsForYearPlayer(leader, existing, {
      year: "2025",
      sourceThroughShow: "2025-12-31",
    }),
    []
  );
  const next = awardsForYearPlayer(
    { rank: 4, sluggingRank: 5 },
    existing,
    { year: "2026", sourceThroughShow: "2026-12-30" }
  );
  assert.deepEqual(
    next.map((award) => award.id),
    ["year_slugging_top5_2"]
  );
});

test("evangelist awards at 5 and does not rewrite awardedAt", () => {
  assert.equal(evangelistAward(4, {}, "2026-10-22"), null);
  const award = evangelistAward(5, {}, "2026-10-22");
  assert.equal(award.id, "pickem_evangelist");
  assert.equal(award.scope, "career");
  assert.equal(
    evangelistAward(6, { pickem_evangelist: { awardedAt: "frozen", scope: "career" } }, "2026-10-23"),
    null
  );
});

test("yearIsClosed waits until after 31 December UTC", () => {
  assert.equal(yearIsClosed("2025", new Date("2025-12-31T23:00:00.000Z")), false);
  assert.equal(yearIsClosed("2025", new Date("2026-01-01T00:00:00.000Z")), true);
  assert.equal(yearIsClosed("2026", new Date("2026-10-22T12:00:00.000Z")), false);
});
