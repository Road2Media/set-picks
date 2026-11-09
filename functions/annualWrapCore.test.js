"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  GAME_LAUNCH_SHOW_DATE,
  MIN_HIT_RATE_CARDS,
  showsInCalendarYear,
  isLastShowOfYear,
  shouldAttemptPendingAnnualWrap,
  yearFinaleReady,
  buildYearCrowdPulse,
  yearPersonalMark,
  assembleAnnualWrapRecipients,
} = require("./annualWrapCore");

const SHOWS = [
  { date: "2026-07-01", venue: "The Gorge", city: "George" },
  { date: "2026-07-02", venue: "The Gorge", city: "George" },
  { date: "2026-12-31", venue: "Madison Square Garden", city: "New York" },
];

function card(userId, handle, score, title) {
  return {
    userId,
    handle,
    isGraded: true,
    score,
    picks: { s1o: title },
  };
}

function fixture() {
  const crowd = Array.from({ length: 10 }, (_, i) => ({
    uid: `c${i}`,
    handle: `Crowd${i}`,
  }));
  const picksByDate = [
    {
      date: "2026-07-01",
      picks: [
        card("ada", "Ada", 30, "Tweezer"),
        card("bea", "Bea", 10, "Ghost"),
        card("cy", "Cy", 5, "Ghost"),
        ...crowd.map((row) => card(row.uid, row.handle, 1, "Tweezer")),
      ],
    },
    {
      date: "2026-07-02",
      picks: [
        card("ada", "Ada", 10, "Ghost"),
        card("bea", "Bea", 40, "Ghost"),
        card("cy", "Cy", 0, "You Enjoy Myself"),
        ...crowd.map((row) => card(row.uid, row.handle, 0, "You Enjoy Myself")),
      ],
    },
    {
      date: "2026-12-31",
      picks: [
        card("ada", "Ada", 10, "Harry Hood"),
        card("bea", "Bea", 50, "Harry Hood"),
        card("dee", "Dee", 4, "Harry Hood"),
        card("eve", "Eve", 3, "Harry Hood"),
      ],
    },
  ];
  const setlists = [
    {
      date: "2026-07-01",
      doc: {
        officialSetlist: ["Tweezer", "Ghost"],
        bustouts: ["The Curtain", "Tweezer"],
        songGaps: { tweezer: 200, "the curtain": 197 },
      },
    },
    {
      date: "2026-07-02",
      doc: { officialSetlist: ["Ghost"], bustouts: [], songGaps: {} },
    },
    {
      date: "2026-12-31",
      doc: { officialSetlist: ["Harry Hood"], bustouts: [], songGaps: {} },
    },
  ];
  return {
    picksByDate,
    setlists,
    songFacts: {
      uniqueSongs: 40,
      bustouts: [{ title: "Tweezer", lastPlayed: "2019-08-31", debutYear: 1990 }],
    },
  };
}

test("game launch date matches the client constant", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "src", "shared", "config", "gameLaunch.js"),
    "utf8",
  );
  assert.match(src, new RegExp(GAME_LAUNCH_SHOW_DATE));
});

test("a Dec 31 show stays in that year and a Jan 1 show does not", () => {
  const shows = showsInCalendarYear(
    [
      {
        tour: "NYE",
        shows: [
          { date: "2026-04-15", venue: "Before launch" },
          { date: "2026-12-31", venue: "MSG" },
          { date: "2027-01-01", venue: "MSG" },
        ],
      },
    ],
    2026,
  );
  assert.deepEqual(shows.map((show) => show.date), ["2026-12-31"]);
  assert.equal(isLastShowOfYear("2026-12-31", shows), true);
  assert.equal(isLastShowOfYear("2026-07-01", SHOWS), false);
});

test("morning lookback waits until the day after the finale and stops after 14 days", () => {
  assert.equal(shouldAttemptPendingAnnualWrap("2026-12-31", "2026-12-31"), false);
  assert.equal(shouldAttemptPendingAnnualWrap("2026-12-31", "2027-01-01"), true);
  assert.equal(shouldAttemptPendingAnnualWrap("2026-12-31", "2027-01-14"), true);
  assert.equal(shouldAttemptPendingAnnualWrap("2026-12-31", "2027-01-15"), false);
});

test("finale is ready only when every submitted card that night is graded", () => {
  assert.equal(yearFinaleReady([]), true);
  assert.equal(yearFinaleReady([{ picks: { s1o: "Ghost" }, isGraded: false }]), false);
  assert.equal(yearFinaleReady([{ picks: { s1o: "Ghost" }, isGraded: true }]), true);
});

test("a song under 10 cards is not a hit rate, and a title missing from the setlist is not a hit", () => {
  const pulse = buildYearCrowdPulse(
    [
      {
        date: "2026-07-01",
        picks: Array.from({ length: 9 }, (_, i) => card(`u${i}`, `U${i}`, 1, "Tweezer")),
      },
    ],
    [{ date: "2026-07-01", doc: { officialSetlist: ["Ghost"], bustouts: ["Tweezer"] } }],
  );
  assert.equal(pulse.highestHitRate.length, 0);
  assert.equal(pulse.lowestHitRate.length, 0);
  assert.equal(pulse.songs[0].hits, 0);
  assert.ok(pulse.songs[0].cardCount < MIN_HIT_RATE_CARDS);
});

test("the shared crowd block is the same on every copy, and the personal section stays personal", () => {
  const data = fixture();
  const assembled = assembleAnnualWrapRecipients({
    year: 2026,
    shows: SHOWS,
    ...data,
  });
  assert.equal(assembled.skipped, null);
  const ada = assembled.recipients.find((row) => row.uid === "ada");
  const bea = assembled.recipients.find((row) => row.uid === "bea");
  const cy = assembled.recipients.find((row) => row.uid === "cy");
  assert.ok(ada && bea && cy);
  assert.equal(ada.payload.crowd_summary, bea.payload.crowd_summary);
  assert.equal(ada.payload.crowd_summary, cy.payload.crowd_summary);
  assert.match(ada.payload.crowd_summary, /Tweezer and You Enjoy Myself the most, on 11 cards each, then Ghost on 4/);
  assert.match(ada.payload.crowd_summary, /Tweezer \(all 11 calls\) was in the setlist the most/);
  assert.match(ada.payload.crowd_summary, /You Enjoy Myself \(none of 11 calls\) was in the setlist the least/);
  assert.match(ada.payload.crowd_summary, /The room named 4 different songs\. 19 of 30 calls were in the setlist/);
  assert.doesNotMatch(ada.payload.crowd_summary, /Ada|Bea|Cy/);

  const shared = ada.payload.opening_paras.join("\n");
  assert.match(shared, /^2026 is officially in the books\./);
  assert.match(shared, /The rarest song played all year was Tweezer, a 200 show gap, on opening night, 07\/01\/26, at The Gorge, George, last played 08\/31\/19, debut 1990\./);
  assert.doesNotMatch(shared, /The Curtain/);
  assert.doesNotMatch(shared, /annual lead/);
  assert.match(shared, /Before the next year, here is the final tape\./);

  assert.match(ada.payload.personal_line, /You finished #2 of 15 with 50 points and 1 nightly win, playing 3 of 3 shows/);
  assert.match(ada.payload.personal_line, /Your best night was 07\/01\/26 with 30 points/);
  assert.match(ada.payload.personal_line, /You caught Tweezer, a 200 show gap, on 07\/01\/26 at The Gorge, George\./);
  assert.match(ada.payload.personal_line, /You lost the lead on 07\/02\/26/);
  assert.doesNotMatch(ada.payload.personal_line, /last played/);
  assert.doesNotMatch(ada.payload.personal_line, /chair/);

  assert.match(bea.payload.personal_line, /You finished #1 of 15 with 100 points and 2 nightly wins/);
  assert.match(bea.payload.personal_line, /You took the lead on 07\/02\/26/);
  assert.doesNotMatch(bea.payload.personal_line, /You caught Tweezer/);

  assert.match(cy.payload.personal_line, /You finished #3 of 15 with 5 points and 0 nightly wins, playing 2 of 3 shows/);
  assert.match(cy.payload.personal_line, /You sat out 1 show/);

  assert.equal(ada.payload.email_board[0].avg, "");
  assert.equal(ada.payload.podium.places[0].label, "Annual Winner");
  assert.equal(ada.payload.podium.places[0].members[0].handle, "Bea");
  assert.equal(ada.payload.fact_label.map, "annual_wrap");
  assert.equal(ada.payload.fact_label.year, "2026");
  assert.ok(ada.payload.fact_label.slots.includes("crowd_most_picked"));
  assert.ok(ada.payload.fact_label.slots.includes("crowd_highest_hit_rate"));
  assert.ok(ada.payload.fact_label.slots.includes("crowd_lowest_hit_rate"));
  assert.ok(ada.payload.fact_label.slots.includes("crowd_room_rates"));
  assert.ok(ada.payload.fact_label.slots.includes("rarest_hit"));
  assert.ok(ada.payload.fact_label.slots.includes("rare_hit_picked"));
  assert.equal(ada.payload.fact_label.slots.includes("lead_changes"), false);
});

test("when the rarest song is missing, the annual lead is the shared fact", () => {
  const assembled = assembleAnnualWrapRecipients({
    year: 2026,
    shows: SHOWS.slice(0, 2).map((show) => ({ ...show, venue: "", city: "" })),
    picksByDate: [
      { date: "2026-07-01", picks: [card("ada", "Ada", 10, "Ghost")] },
      { date: "2026-07-02", picks: [card("bea", "Bea", 30, "Ghost"), card("ada", "Ada", 5, "Ghost")] },
    ],
    setlists: [
      { date: "2026-07-01", doc: { officialSetlist: ["Ghost"], bustouts: [] } },
      { date: "2026-07-02", doc: { officialSetlist: ["Ghost"], bustouts: [] } },
    ],
    songFacts: null,
  });
  const line = assembled.recipients[0].payload.opening_paras.join(" ");
  assert.match(line, /The annual lead changed hands once/);
  assert.doesNotMatch(line, /rarest song/);
});

test("a one-song year does not call the same song both the highest and the lowest rate", () => {
  const picks = Array.from({ length: 10 }, (_, i) => card(`u${i}`, `U${i}`, 1, "Ghost"));
  const pulse = buildYearCrowdPulse(
    [{ date: "2026-07-01", picks }],
    [{ date: "2026-07-01", doc: { officialSetlist: ["Ghost"] } }],
  );
  assert.equal(pulse.highestHitRate.length, 0);
  assert.equal(pulse.lowestHitRate.length, 0);
  assert.equal(pulse.uniqueSongs, 1);
});

test("a prior year mark is spoken only when an earlier year is already lower", () => {
  assert.equal(yearPersonalMark(null, 100, 2), null);
  assert.equal(yearPersonalMark({ points: 40, wins: 1 }, 100, 2), "points");
  assert.equal(yearPersonalMark({ points: 100, wins: 1 }, 80, 4), "wins");
  assert.equal(yearPersonalMark({ points: 100, wins: 4 }, 80, 2), null);
});

test("a night with no official setlist is left out of the year crowd count", () => {
  const pulse = buildYearCrowdPulse(
    [{ date: "2026-07-01", picks: [card("ada", "Ada", 10, "Tweezer"), card("bea", "Bea", 10, "Tweezer")] }],
    [{ date: "2026-07-01", doc: null }],
  );
  assert.equal(pulse.uniqueSongs, 0);
});
