"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTourRecapEmailBoard,
  buildTourRecapPayload,
  buildTourRecapPodium,
  closingVenueForTour,
  derivePlayerWrapFacts,
  deriveSharedWrapFacts,
} = require("./tourRecapCore");

function graded(uid, handle, score, guesses) {
  return {
    userId: uid,
    handle,
    isGraded: true,
    score,
    picks: guesses,
  };
}

const setlists = [
  {
    date: "2026-07-01",
    doc: {
      officialSetlist: ["Tweezer", "The Curtain With"],
      bustouts: ["Tweezer", "The Curtain"],
      songGaps: { tweezer: 200, "the curtain": 197, "the curtain with": 11 },
    },
  },
  {
    date: "2026-07-02",
    doc: { officialSetlist: ["Farmhouse"], bustouts: [], songGaps: {} },
  },
  {
    date: "2026-07-03",
    doc: {
      officialSetlist: ["Ghost"],
      bustouts: ["Ghost"],
      songGaps: { ghost: 40 },
    },
  },
];

const picksByDate = [
  {
    date: "2026-07-01",
    picks: [
      graded("a", "Ada", 30, { s1o: "Tweezer" }),
      graded("b", "Bea", 10, { s1o: "Farmhouse" }),
      graded("c", "Cy", 5, { s1o: "Ghost" }),
    ],
  },
  {
    date: "2026-07-02",
    picks: [
      graded("a", "Ada", 10, { s1o: "Farmhouse" }),
      graded("b", "Bea", 40, { s1o: "Ghost" }),
    ],
  },
  {
    date: "2026-07-03",
    picks: [
      graded("a", "Ada", 10, { s2o: "Ghost" }),
      graded("b", "Bea", 50, { s1o: "Farmhouse" }),
      graded("c", "Cy", 0, { s1o: "Tweezer" }),
    ],
  },
];

const calendar = [
  {
    tour: "Sample Tour",
    shows: [
      { date: "2026-07-01", venue: "First Room" },
      { date: "2026-07-03", venue: "Last Room" },
    ],
  },
];

test("shared opening uses the rarest played bustout and drops a title that was not played", () => {
  const shared = deriveSharedWrapFacts({
    setlists,
    picksByDate,
    showCount: 3,
    closingVenue: closingVenueForTour(calendar, "Sample Tour"),
  });
  assert.deepEqual(shared.rarestHit, {
    title: "Tweezer",
    gap: 200,
    date: "2026-07-01",
    venue: "",
    openingNight: true,
    lastPlayed: "",
    debutYear: null,
  });
  assert.equal(shared.leadChangeCount, 1);
  assert.equal(shared.closingVenue, "Last Room");
  assert.equal(JSON.stringify(shared).includes("The Curtain"), false);
  assert.match(JSON.stringify(shared), /Tweezer/);
});

test("a player who caught the rare hit hears that song once, plus any other bustout", () => {
  const shared = deriveSharedWrapFacts({ setlists, picksByDate, showCount: 3 });
  const ada = derivePlayerWrapFacts({
    uid: "a",
    picksByDate,
    setlists,
    shared,
    showsPlayed: 3,
    showCount: 3,
    points: 50,
    wins: 1,
    tourKey: "Sample Tour",
    seasonStats: { "Older Tour": { totalPoints: 10, wins: 0 } },
  });
  const payload = buildTourRecapPayload({
    handle: "Ada",
    rank: 2,
    points: 50,
    wins: 1,
    showsPlayed: 3,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { rows: [], honorableMentions: [] },
    shared,
    player: ada,
  });
  assert.deepEqual(payload.opening_paras, [
    "Sample Tour is officially in the books.",
    "3 shows and 3 players. The rarest hit of the run was Tweezer, a 200 show gap, on opening night, 07/01/26. The tour lead changed hands once. Bea took it on 07/02/26 and held it through the close.",
    "Before the next run, here is the final tape.",
  ]);
  assert.equal(
    payload.personal_line,
    "You finished #2 of 3 with 50 points and 1 nightly win, playing 3 of 3 shows. Your best night was 07/01/26 with 30 points. You caught Ghost. You caught Tweezer — a 200 show gap — on 07/01/26. You lost the lead on 07/02/26.",
  );
  assert.equal(
    payload.personal_clause,
    "You caught Tweezer — a 200 show gap — on 07/01/26. You lost the lead on 07/02/26.",
  );
  assert.doesNotMatch(payload.personal_line, /highest tour point total/);
  assert.equal((payload.personal_line.match(/Tweezer/g) || []).length, 1);
  assert.doesNotMatch(payload.personal_line, /The Curtain/);
  assert.doesNotMatch(payload.personal_line, /sat out/);
  assert.deepEqual(payload.fact_label.slots, [
    "rank",
    "points",
    "nightly_wins",
    "shows_played",
    "best_night",
    "bustouts_caught",
    "rare_hit_picked",
    "lead_change_involved",
    "tour_scale",
    "rarest_hit",
    "lead_changes",
  ]);
});

test("a lead change is the personal sentence when they caught no rare hit", () => {
  const shared = deriveSharedWrapFacts({ setlists, picksByDate, showCount: 3 });
  const bea = derivePlayerWrapFacts({
    uid: "b",
    picksByDate,
    setlists,
    shared,
    showsPlayed: 3,
    showCount: 3,
    points: 100,
    wins: 2,
  });
  const payload = buildTourRecapPayload({
    handle: "Bea",
    rank: 1,
    points: 100,
    wins: 2,
    showsPlayed: 3,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { rows: [], honorableMentions: [] },
    shared,
    player: bea,
  });
  assert.equal(payload.personal_clause, "You took the lead on 07/02/26.");
  assert.match(payload.personal_line, /Your best night was 07\/03\/26 with 50 points/);
  assert.doesNotMatch(payload.personal_line, /caught/);
  assert.ok(payload.fact_label.slots.includes("lead_change_involved"));
  assert.equal(payload.fact_label.slots.includes("rare_hit_picked"), false);
});

test("shows sat out and a stored personal mark fill in when no rarer fact exists", () => {
  const shared = deriveSharedWrapFacts({ setlists, picksByDate, showCount: 3 });
  const cy = derivePlayerWrapFacts({
    uid: "c",
    picksByDate,
    setlists,
    shared,
    showsPlayed: 2,
    showCount: 3,
    points: 5,
    wins: 0,
    tourKey: "Sample Tour",
    seasonStats: {
      "Sample Tour": { totalPoints: 5, wins: 0 },
      "Older Tour": { totalPoints: 1, wins: 2 },
    },
  });
  const payload = buildTourRecapPayload({
    handle: "Cy",
    rank: 3,
    points: 5,
    wins: 0,
    showsPlayed: 2,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { rows: [], honorableMentions: [] },
    shared,
    player: cy,
  });
  assert.match(payload.personal_line, /You sat out 1 show/);
  assert.equal(payload.personal_clause, "This is your highest tour point total.");
  assert.equal((payload.personal_line.match(/sat out 0/g) || []).length, 0);
  assert.ok(payload.fact_label.slots.includes("shows_sat_out"));
  assert.ok(payload.fact_label.slots.includes("personal_mark"));
});

test("a one-tour account does not get a new personal mark", () => {
  const player = derivePlayerWrapFacts({
    uid: "c",
    picksByDate,
    setlists,
    shared: deriveSharedWrapFacts({ setlists, picksByDate, showCount: 3 }),
    showsPlayed: 2,
    showCount: 3,
    points: 5,
    wins: 0,
    tourKey: "Sample Tour",
    seasonStats: { "Sample Tour": { totalPoints: 5, wins: 0 } },
  });
  assert.equal(player.personalMark, null);
});

test("without a played bustout the opening falls through to lead changes, then the venue, then today's sentence", () => {
  const quiet = setlists.map((row) => ({
    date: row.date,
    doc: { ...row.doc, bustouts: ["The Curtain"], officialSetlist: ["Farmhouse"] },
  }));
  const lead = deriveSharedWrapFacts({ setlists: quiet, picksByDate, showCount: 3, closingVenue: "Last Room" });
  const leadCopy = buildTourRecapPayload({
    handle: "Bea",
    rank: 1,
    points: 100,
    wins: 2,
    showsPlayed: 3,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { rows: [], honorableMentions: [] },
    shared: lead,
    player: derivePlayerWrapFacts({ uid: "b", picksByDate, setlists: quiet, shared: lead, showsPlayed: 3, showCount: 3 }),
  });
  assert.equal(
    leadCopy.opening_paras[1],
    "3 shows and 3 players. The tour lead changed hands once. Bea took it on 07/02/26 and held it through the close at Last Room.",
  );
  assert.ok(leadCopy.fact_label.slots.includes("lead_changes"));
  assert.ok(leadCopy.fact_label.slots.includes("closing_stand"));
  assert.equal(leadCopy.fact_label.slots.includes("rarest_hit"), false);
  assert.doesNotMatch(leadCopy.opening_paras.join(" "), /The Curtain/);
  const ada = buildTourRecapPayload({
    handle: "Ada",
    rank: 2,
    points: 50,
    wins: 1,
    showsPlayed: 3,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { rows: [], honorableMentions: [] },
    shared: lead,
    player: derivePlayerWrapFacts({
      uid: "a",
      picksByDate,
      setlists: quiet,
      shared: lead,
      showsPlayed: 3,
      showCount: 3,
      points: 50,
      wins: 1,
    }),
  });
  assert.equal(ada.personal_clause, "You lost the lead on 07/02/26.");

  const oneNight = deriveSharedWrapFacts({
    setlists: [],
    picksByDate: picksByDate.slice(0, 1),
    showCount: 3,
    closingVenue: "Last Room",
  });
  const venueCopy = buildTourRecapPayload({
    handle: "Bea",
    rank: 1,
    points: 10,
    wins: 1,
    showsPlayed: 1,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { rows: [], honorableMentions: [] },
    shared: oneNight,
  });
  assert.equal(
    venueCopy.opening_paras[1],
    "3 shows and 3 players. Last Room closed the run after 3 shows.",
  );
  assert.equal(venueCopy.fact_label.slots.at(-1), "closing_stand");

  const empty = buildTourRecapPayload({
    handle: "Bea",
    rank: 1,
    points: 10,
    wins: 1,
    showsPlayed: 1,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { rows: [], honorableMentions: [] },
  });
  assert.match(empty.opening_paras[1], /inexact science/);
  assert.equal(empty.fact_label.slots.at(-1), "opening_fallback");
});

test("recap payload says tied for the official rank and names the other handles", () => {
  const payload = buildTourRecapPayload({
    handle: "ArmenianMan",
    rank: 3,
    tiedCount: 3,
    tiedHandles: ["HotDog Billy", "TheManMulcahy"],
    points: 85,
    wins: 1,
    showsPlayed: 8,
    participantCount: 20,
    tourId: "2026 Fall Tour",
    tourName: "2026 Fall Tour",
    showCount: 8,
    podium: { rows: [], honorableMentions: [] },
  });
  assert.equal(payload.rank, 3);
  assert.equal(payload.tiedCount, 3);
  assert.deepEqual(payload.tiedHandles, ["HotDog Billy", "TheManMulcahy"]);
  assert.equal(
    payload.personal_line,
    "You finished tied for #3 of 20 with HotDog Billy and TheManMulcahy, with 85 points and 1 nightly win, playing 8 of 8 shows.",
  );
});

test("a three-way points tie is one podium place, and ranks past 5 stay off the board", () => {
  const leaders = [
    { handle: "I have the book", totalPoints: 115, wins: 3, shows: 8 },
    { handle: "YarmouthMeg", totalPoints: 90, wins: 0, shows: 8 },
    { handle: "HotDog Billy", totalPoints: 85, wins: 2, shows: 7 },
    { handle: "ArmenianMan", totalPoints: 85, wins: 1, shows: 8 },
    { handle: "TheManMulcahy", totalPoints: 85, wins: 1, shows: 7 },
    { handle: "Jeff", totalPoints: 80, wins: 1, shows: 8 },
  ];
  const podium = buildTourRecapPodium(leaders);
  assert.deepEqual(
    podium.places.map((place) => place.label),
    ["Tour Winner", "Runner-up", "Tied for third"],
  );
  assert.equal(podium.places[2].rank, 3);
  assert.equal(podium.places[2].tied, true);
  assert.deepEqual(
    podium.places[2].members.map((member) => member.handle),
    ["HotDog Billy", "ArmenianMan", "TheManMulcahy"],
  );
  assert.equal(podium.places.some((place) => place.members.some((member) => member.handle === "Jeff")), false);
  assert.equal(podium.honorableMentions.length, 0);
  const board = buildTourRecapEmailBoard(leaders);
  assert.deepEqual(board.map((row) => row.rank), [1, 2, 3, 3, 3]);
  assert.equal(board.some((row) => row.handle === "Jeff"), false);
});

test("a tie at 5th names everyone, including players past the fifth row", () => {
  const leaders = [
    { handle: "A", totalPoints: 100, wins: 3, shows: 8 },
    { handle: "B", totalPoints: 90, wins: 2, shows: 8 },
    { handle: "C", totalPoints: 80, wins: 1, shows: 8 },
    { handle: "D", totalPoints: 70, wins: 1, shows: 7 },
    { handle: "E", totalPoints: 60, wins: 0, shows: 4 },
    { handle: "F", totalPoints: 60, wins: 0, shows: 4 },
    { handle: "G", totalPoints: 40, wins: 0, shows: 2 },
  ];
  const podium = buildTourRecapPodium(leaders);
  const fifth = podium.places.find((place) => place.rank === 5);
  assert.equal(fifth.label, "Tied for 5th");
  assert.deepEqual(fifth.members.map((member) => member.handle), ["E", "F"]);
  assert.equal(podium.places.some((place) => place.rank > 5), false);
  const board = buildTourRecapEmailBoard(leaders);
  assert.deepEqual(board.map((row) => row.handle), ["A", "B", "C", "D", "E", "F"]);
  assert.equal(board[4].rank, 5);
  assert.equal(board[5].rank, 5);
});

test("the gap clause keeps last played and debut year, and drops them when the row has neither", () => {
  const shared = deriveSharedWrapFacts({
    setlists,
    picksByDate,
    showCount: 3,
    shows: [
      { date: "2026-07-01", venue: "First Room", city: "Atlantic City" },
      { date: "2026-07-03", venue: "Last Room" },
    ],
    songFacts: {
      uniqueSongs: 12,
      bustouts: [
        { title: "Tweezer", showDate: "2026-07-01", lastPlayed: "2023-07-12", debutYear: 1990 },
        { title: "Ghost", showDate: "2026-07-03", lastPlayed: "2024-08-01", debutYear: 1997 },
      ],
    },
  });
  const payload = buildTourRecapPayload({
    handle: "Ada",
    rank: 2,
    points: 50,
    wins: 1,
    showsPlayed: 3,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { places: [], rows: [], honorableMentions: [] },
    shared,
    player: derivePlayerWrapFacts({
      uid: "a",
      picksByDate,
      setlists,
      shared,
      showsPlayed: 3,
      showCount: 3,
      points: 50,
      wins: 1,
    }),
  });
  assert.match(
    payload.opening_paras[1],
    /3 shows, 3 players, and 12 different songs\. The rarest hit of the run was Tweezer, a 200 show gap, on opening night, 07\/01\/26, at First Room, Atlantic City, last played 07\/12\/23, debut 1990\./,
  );
  assert.match(payload.opening_paras[1], /The tour lead changed hands once/);
  assert.match(payload.personal_clause, /You caught Tweezer — a 200 show gap — on 07\/01\/26 at First Room, Atlantic City\./);
  assert.doesNotMatch(payload.personal_clause, /last played/);
  assert.match(payload.personal_clause, /You lost the lead on 07\/02\/26/);
});

test("the wrap does not read the rankings case-study page or send its sample paragraph", () => {
  const src = fs.readFileSync(path.join(__dirname, "tourRecapCore.js"), "utf8");
  const adapter = fs.readFileSync(path.join(__dirname, "commsEventAdapters.js"), "utf8");
  for (const file of [src, adapter]) {
    assert.equal(file.includes("TOUR_RANKINGS"), false);
    assert.equal(file.includes("Alumni Blues"), false);
    assert.equal(file.includes("Orion Amphitheater"), false);
  }
  const payload = buildTourRecapPayload({
    handle: "Ada",
    rank: 2,
    points: 50,
    wins: 1,
    showsPlayed: 3,
    participantCount: 3,
    tourId: "Sample Tour",
    tourName: "Sample Tour",
    showCount: 3,
    podium: { places: [], rows: [], honorableMentions: [] },
    shared: deriveSharedWrapFacts({ setlists, picksByDate, showCount: 3 }),
    player: derivePlayerWrapFacts({ uid: "a", picksByDate, setlists, showsPlayed: 3, showCount: 3 }),
  });
  const sample = "Eight shows, twenty players, 109 different songs. The rarest hit of the run was Alumni Blues";
  assert.equal(payload.opening_paras.join(" ").includes(sample), false);
});
