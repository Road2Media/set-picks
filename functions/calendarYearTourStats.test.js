/**
 * Calendar-year roll-up (#1141). Same aggregator as the tour pages.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCalendarYearStatsWrites,
  calendarYearOfShowDate,
} = require("./calendarYearTourStats");

function show(showDate, titles, bustouts = []) {
  const songGaps = {};
  for (const title of bustouts) songGaps[title.toLowerCase()] = 40;
  return {
    showDate,
    setlist: {
      officialSetlist: titles,
      bustouts,
      songGaps,
    },
  };
}

describe("calendarYearOfShowDate", () => {
  it("follows the show date, not the night the music ends", () => {
    assert.equal(calendarYearOfShowDate("2026-12-31"), 2026);
    assert.equal(calendarYearOfShowDate("2027-01-01"), 2027);
    assert.equal(calendarYearOfShowDate("2027-01-02"), 2027);
    assert.equal(calendarYearOfShowDate("2026-02-31"), null);
  });
});

describe("buildCalendarYearStatsWrites", () => {
  it("sums wholly-in-year tours and keeps January shows out of 2026", () => {
    const writes = buildCalendarYearStatsWrites([
      {
        tourSlug: "2026-sphere",
        tourLabel: "2026 Sphere",
        docs: [show("2026-04-16", ["Tweezer", "Ghost"], ["Ghost"])],
      },
      {
        tourSlug: "2026-summer-tour",
        tourLabel: "2026 Summer Tour",
        docs: [show("2026-07-14", ["Tweezer", "Harry Hood"])],
      },
      {
        tourSlug: "2026-2027-nye-run",
        tourLabel: "2026/2027 NYE Run",
        docs: [
          show("2026-12-30", ["Tube"]),
          show("2026-12-31", ["Tweezer"], ["Tweezer"]),
          show("2027-01-01", ["Piper"], ["Piper"]),
          show("2027-01-02", ["Ghost"]),
        ],
      },
    ]);

    const year2026 = writes.find((row) => row.year === 2026);
    const year2027 = writes.find((row) => row.year === 2027);
    assert.equal(year2026.docId, "_year_2026");
    assert.equal(year2026.body.yearRule, "calendar-show-date");
    assert.equal(year2026.body.schemaVersion, undefined);

    const showSum = year2026.body.tours.reduce(
      (sum, tour) => sum + tour.showsWithSetlist,
      0
    );
    const playSum = year2026.body.tours.reduce(
      (sum, tour) => sum + tour.totalSongPlays,
      0
    );
    assert.equal(year2026.body.showsWithSetlist, showSum);
    assert.equal(year2026.body.totalSongPlays, playSum);
    assert.equal(year2026.body.showsWithSetlist, 4);
    assert.equal(year2026.body.uniqueSongs, 4);
    assert.ok(year2026.body.uniqueSongs < 2 + 2 + 2);
    assert.deepEqual(
      year2026.body.tours.map((tour) => tour.tourSlug),
      ["2026-sphere", "2026-summer-tour", "2026-2027-nye-run"]
    );
    assert.equal(
      year2026.body.tours.find((tour) => tour.tourSlug === "2026-2027-nye-run")
        .showsWithSetlist,
      2
    );
    assert.deepEqual(
      year2026.body.tours.find((tour) => tour.tourSlug === "2026-2027-nye-run")
        .showDates,
      ["2026-12-30", "2026-12-31"]
    );
    assert.ok(
      !year2026.body.showDates.includes("2027-01-01") &&
        !year2026.body.showDates.includes("2027-01-02")
    );
    assert.ok(
      year2026.body.topSongs.every((row) => row.title !== "Piper")
    );
    assert.ok(
      year2026.body.bustouts.every((row) => row.showDate.startsWith("2026"))
    );

    assert.equal(year2027.body.showsWithSetlist, 2);
    assert.deepEqual(year2027.body.showDates, ["2027-01-01", "2027-01-02"]);
    assert.equal(
      year2027.body.tours[0].showsWithSetlist,
      year2027.body.showsWithSetlist
    );
    assert.ok(year2027.body.topSongs.some((row) => row.title === "Piper"));
    assert.ok(
      year2027.body.bustouts.some((row) => row.showDate === "2027-01-01")
    );
  });

  it("does not publish a year that has no setlists", () => {
    const writes = buildCalendarYearStatsWrites([
      {
        tourSlug: "2026-sphere",
        tourLabel: "2026 Sphere",
        docs: [{ showDate: "2026-04-16", setlist: null }],
      },
    ]);
    assert.equal(writes.length, 0);
  });
});
