"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  aggregateTourStandings,
  assignDisplayRanks,
  formatRankChange,
  tourDatesForKey,
  priorTourShowDate,
  nextTourShowDate,
  buildTourRankingsDailyPayloadFields,
  buildTourRankingsDailyParagraphs,
} = require("./tourRankingsDailyCore");

function gradedPick(uid, handle, score) {
  return {
    userId: uid,
    handle,
    score,
    isGraded: true,
    picks: { opener: "Tweezer" },
  };
}

test("formatRankChange: up / down / held / null", () => {
  assert.equal(formatRankChange(6, 3), "up 3");
  assert.equal(formatRankChange(1, 6), "down 5");
  assert.equal(formatRankChange(4, 4), "held");
  assert.equal(formatRankChange(null, 1), null);
  assert.equal(formatRankChange(1, null), null);
});

test("assignDisplayRanks: ties share competition rank", () => {
  const rows = aggregateTourStandings([
    {
      date: "2026-07-07",
      picks: [
        gradedPick("a", "Alice", 10),
        gradedPick("b", "Bob", 10),
        gradedPick("c", "Cara", 5),
      ],
    },
  ]);
  const board = assignDisplayRanks(rows);
  assert.equal(board.get("a")?.rank, 1);
  assert.equal(board.get("b")?.rank, 1);
  assert.equal(board.get("a")?.tiedCount, 2);
  assert.equal(board.get("c")?.rank, 3);
  assert.equal(board.get("c")?.tiedCount, 1);
  assert.deepEqual(board.get("a")?.tiedHandles, ["Bob"]);
  assert.deepEqual(board.get("b")?.tiedHandles, ["Alice"]);
  assert.deepEqual(board.get("c")?.tiedHandles, []);
});

test("assignDisplayRanks: Fall Tour points tie is shared #3 and Jeff is #6", () => {
  const rows = [
    { uid: "book", handle: "I have the book", totalPoints: 115, wins: 3, shows: 8 },
    { uid: "meg", handle: "YarmouthMeg", totalPoints: 90, wins: 0, shows: 8 },
    { uid: "billy", handle: "HotDog Billy", totalPoints: 85, wins: 2, shows: 7 },
    { uid: "arm", handle: "ArmenianMan", totalPoints: 85, wins: 1, shows: 8 },
    { uid: "mul", handle: "TheManMulcahy", totalPoints: 85, wins: 1, shows: 7 },
    { uid: "jeff", handle: "Jeff", totalPoints: 80, wins: 1, shows: 8 },
  ];
  const board = assignDisplayRanks(rows);
  assert.equal(board.get("billy")?.rank, 3);
  assert.equal(board.get("arm")?.rank, 3);
  assert.equal(board.get("mul")?.rank, 3);
  assert.equal(board.get("billy")?.tiedCount, 3);
  assert.equal(board.get("jeff")?.rank, 6);
  assert.deepEqual(board.get("billy")?.tiedHandles, ["ArmenianMan", "TheManMulcahy"]);
  assert.deepEqual(board.get("arm")?.tiedHandles, ["HotDog Billy", "TheManMulcahy"]);
  assert.deepEqual(board.get("mul")?.tiedHandles, ["HotDog Billy", "ArmenianMan"]);
  assert.deepEqual(board.get("jeff")?.tiedHandles, []);
});

test("tour date helpers", () => {
  const showDatesByTour = [
    {
      tour: "Summer Tour 2026",
      shows: [
        { date: "2026-07-09" },
        { date: "2026-07-07" },
        { date: "2026-07-08" },
      ],
    },
  ];
  const dates = tourDatesForKey(showDatesByTour, "Summer Tour 2026");
  assert.deepEqual(dates, ["2026-07-07", "2026-07-08", "2026-07-09"]);
  assert.equal(priorTourShowDate(dates, "2026-07-07"), null);
  assert.equal(priorTourShowDate(dates, "2026-07-08"), "2026-07-07");
  assert.equal(nextTourShowDate(dates, "2026-07-08"), "2026-07-09");
});

test("payload: night-one debut has no rank_change", () => {
  const current = assignDisplayRanks(
    aggregateTourStandings([
      {
        date: "2026-07-07",
        picks: [gradedPick("u1", "ArmenianMan", 10), gradedPick("u2", "Other", 5)],
      },
    ])
  );
  const payload = buildTourRankingsDailyPayloadFields({
    uid: "u1",
    handle: "ArmenianMan",
    showDate: "2026-07-07",
    venueName: "Kohl Center",
    venueCity: "Madison, WI",
    showScore: 10,
    globalRank: 1,
    globalTotalPickers: 2,
    currentBoard: current,
    priorBoard: null,
    isTourNightOne: true,
    nextShowDate: "2026-07-08",
    nextShowVenue: "United Center",
  });
  assert.equal(payload.is_debut, true);
  assert.equal(payload.is_late_joiner, false);
  assert.equal(payload.rank_change, null);
  assert.equal(payload.tour_rank, 1);
  assert.equal(payload.tour_tier, "leader");
  assert.equal(payload.tour_rank_tied, false);
  assert.equal(payload.tour_tied_count, 1);
  assert.deepEqual(payload.tour_tied_handles, []);
});

test("payload: a points tie names the other handles at that rank", () => {
  const current = assignDisplayRanks([
    { uid: "book", handle: "I have the book", totalPoints: 115, wins: 3, shows: 8 },
    { uid: "meg", handle: "YarmouthMeg", totalPoints: 90, wins: 0, shows: 8 },
    { uid: "billy", handle: "HotDog Billy", totalPoints: 85, wins: 2, shows: 7 },
    { uid: "arm", handle: "ArmenianMan", totalPoints: 85, wins: 1, shows: 8 },
    { uid: "mul", handle: "TheManMulcahy", totalPoints: 85, wins: 1, shows: 7 },
    { uid: "jeff", handle: "Jeff", totalPoints: 80, wins: 1, shows: 8 },
  ]);
  const payload = buildTourRankingsDailyPayloadFields({
    uid: "arm",
    handle: "ArmenianMan",
    showDate: "2026-10-12",
    currentBoard: current,
    priorBoard: null,
    isTourNightOne: false,
  });
  assert.equal(payload.tour_rank, 3);
  assert.equal(payload.tour_rank_tied, true);
  assert.equal(payload.tour_tied_count, 3);
  assert.deepEqual(payload.tour_tied_handles, ["HotDog Billy", "TheManMulcahy"]);
});

test("payload: slip from #1 to #6 (ArmenianMan case)", () => {
  const prior = assignDisplayRanks(
    aggregateTourStandings([
      {
        date: "2026-07-07",
        picks: [
          gradedPick("u1", "ArmenianMan", 20),
          gradedPick("u2", "B", 10),
          gradedPick("u3", "C", 9),
          gradedPick("u4", "D", 8),
          gradedPick("u5", "E", 7),
          gradedPick("u6", "F", 6),
        ],
      },
    ])
  );
  const current = assignDisplayRanks(
    aggregateTourStandings([
      {
        date: "2026-07-07",
        picks: [
          gradedPick("u1", "ArmenianMan", 20),
          gradedPick("u2", "B", 10),
          gradedPick("u3", "C", 9),
          gradedPick("u4", "D", 8),
          gradedPick("u5", "E", 7),
          gradedPick("u6", "F", 6),
        ],
      },
      {
        date: "2026-07-08",
        picks: [
          gradedPick("u1", "ArmenianMan", 0),
          gradedPick("u2", "B", 20),
          gradedPick("u3", "C", 20),
          gradedPick("u4", "D", 20),
          gradedPick("u5", "E", 20),
          gradedPick("u6", "F", 20),
          gradedPick("u7", "G", 15),
        ],
      },
    ])
  );
  // Totals: B–F 30, G 15, ArmenianMan 20 → ranks 1–5 are B–F, AM is #6, G is #7
  const payload = buildTourRankingsDailyPayloadFields({
    uid: "u1",
    handle: "ArmenianMan",
    showDate: "2026-07-08",
    venueCity: "Madison, WI",
    currentBoard: current,
    priorBoard: prior,
    isTourNightOne: false,
  });
  assert.equal(payload.is_debut, false);
  assert.equal(payload.rank_change, "down 5");
  assert.equal(payload.tour_rank, 6);
  assert.equal(payload.total_tour_pickers, 7);
});

test("payload: late joiner mid-tour", () => {
  const prior = assignDisplayRanks(
    aggregateTourStandings([
      {
        date: "2026-07-07",
        picks: [gradedPick("u2", "Early", 10)],
      },
    ])
  );
  const current = assignDisplayRanks(
    aggregateTourStandings([
      {
        date: "2026-07-07",
        picks: [gradedPick("u2", "Early", 10)],
      },
      {
        date: "2026-07-08",
        picks: [gradedPick("u1", "LateBird", 8), gradedPick("u2", "Early", 5)],
      },
    ])
  );
  const payload = buildTourRankingsDailyPayloadFields({
    uid: "u1",
    handle: "LateBird",
    showDate: "2026-07-08",
    venueCity: "Chicago, IL",
    globalRank: 1,
    globalTotalPickers: 2,
    currentBoard: current,
    priorBoard: prior,
    isTourNightOne: false,
  });
  assert.equal(payload.is_late_joiner, true);
  assert.equal(payload.rank_change, null);
  assert.equal(payload.tour_rank, 2);
});

test("copy: band crossings", () => {
  const base = {
    handle: "Pat",
    venue_city: "Richmond, VA",
    total_tour_pickers: 17,
    tour_points: 50,
  };
  const line = (tour_rank, rank_change) =>
    buildTourRankingsDailyParagraphs({ ...base, tour_rank, rank_change }).join(" ");

  assert.match(line(5, "up 3"), /You climbed into the top 5 — ranked #5 of 17 with 50 points/);
  assert.doesNotMatch(line(5, "up 3"), /Still in the top 5/);
  assert.match(line(3, "up 2"), /Still in the top 5 — ranked #3 of 17 with 50 points/);
  assert.match(line(4, "held"), /Still in the top 5 — ranked #4/);
  assert.match(line(7, "down 3"), /You fell out of the top 5 — ranked #7 of 17 with 50 points/);
  assert.match(line(6, "down 5"), /You fell out of the top 5/);
  assert.match(line(8, "down 2"), /You're ranked #8 of 17 on tour with 50 points/);
  assert.doesNotMatch(line(8, "down 2"), /fell out of the top 5/);
  assert.match(line(1, "up 2"), /You took the lead with 50 points/);
  assert.match(line(1, "held"), /You're leading the tour with 50 points/);
  assert.match(line(3, "down 2"), /Out of the lead, still in the top 5 — ranked #3 of 17 with 50 points/);
  const unknown = buildTourRankingsDailyParagraphs({ ...base, tour_rank: 3 }).join(" ");
  assert.match(unknown, /In the top 5 — ranked #3 of 17 with 50 points/);
  assert.doesNotMatch(unknown, /Still in the top 5|climbed into|fell out/);
});

test("copy: slipped does not say held", () => {
  const paras = buildTourRankingsDailyParagraphs({
    handle: "ArmenianMan",
    venue_city: "Madison, WI",
    tour_rank: 6,
    total_tour_pickers: 11,
    tour_points: 15,
    rank_change: "down 5",
  });
  assert.match(paras[0], /slipped 5 spots/);
  assert.doesNotMatch(paras.join(" "), /held your spot/);
});

test("copy: debut leads with You're on the board", () => {
  const paras = buildTourRankingsDailyParagraphs({
    handle: "ArmenianMan",
    show_date: "2026-07-07",
    venue_name: "Kohl Center",
    venue_city: "Madison, WI",
    tour_rank: 1,
    total_tour_pickers: 11,
    tour_points: 10,
    is_debut: true,
  });
  assert.equal(paras[0], "You're on the board!");
  assert.match(paras[1], /after Kohl Center, Madison, WI you're ranked/);
  assert.doesNotMatch(paras[1], /2026-07-07/);
  assert.match(paras[1], /ranked #1 of 11 on tour with 10 points/);
  assert.match(paras.join(" "), /Night one sets the tour leaderboard/);
});

test("copy: tied at display rank", () => {
  const paras = buildTourRankingsDailyParagraphs({
    handle: "RiverTranced",
    venue_city: "Chicago, IL",
    tour_rank: 1,
    total_tour_pickers: 40,
    tour_points: 80,
    rank_change: "held",
    tour_rank_tied: true,
    tour_tier: "leader",
  });
  assert.match(paras.join(" "), /tied for #1/);
  assert.match(paras.join(" "), /leading the tour with 80 points/);
});

test("copy: combined email prose avoids repeating venue/city and uses same-venue next-up", () => {
  const paras = buildTourRankingsDailyParagraphs(
    {
      handle: "RiverTranced",
      show_date: "2026-07-19",
      venue_name: "MSG",
      venue_city: "New York, NY",
      tour_rank: 3,
      total_tour_pickers: 50,
      tour_points: 210,
      rank_change: "up 2",
      next_show_date: "2026-07-20",
      next_show_venue: "MSG",
    },
    { omitHandle: true },
  );

  const text = paras.join(" ");
  assert.match(text, /After last night's show you climbed 2 spots\./);
  assert.match(text, /Back at MSG 07\/20\/26\./);
  assert.doesNotMatch(text, /2026-07-20/);
  assert.doesNotMatch(text, /After New York, NY/);
  assert.doesNotMatch(text, /2026-07-19 — MSG/);
});
