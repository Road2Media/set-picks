"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTourRecapPayload,
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
  assert.deepEqual(shared.rarestHit, { title: "Tweezer", gap: 200, date: "2026-07-01" });
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
    "The rarest hit of the run was Tweezer, a 200 show gap.",
    "Before the next run, here is the final tape.",
  ]);
  assert.equal(
    payload.personal_line,
    "You finished #2 of 3 with 50 points and 1 nightly win, playing 3 of 3 shows. Your best night was 2026-07-01 with 30 points. You caught Ghost. You caught Tweezer — a 200 show gap — on 2026-07-01.",
  );
  assert.equal(payload.personal_clause, "You caught Tweezer — a 200 show gap — on 2026-07-01.");
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
    "rarest_hit",
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
  assert.equal(payload.personal_clause, "You took the lead on 2026-07-02.");
  assert.match(payload.personal_line, /Your best night was 2026-07-03 with 50 points/);
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
  assert.equal(leadCopy.opening_paras[1], "The tour lead changed hands once.");
  assert.equal(leadCopy.fact_label.slots.at(-1), "lead_changes");
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
  assert.equal(ada.personal_clause, "You lost the lead on 2026-07-02.");

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
  assert.equal(venueCopy.opening_paras[1], "Last Room closed the run after 3 shows.");
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

test("recap payload carries the shared rank and the other handles without rewriting the sentence", () => {
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
  assert.match(payload.personal_line, /You finished #3 of 20/);
  assert.equal(payload.personal_line.includes("tied for"), false);
});
