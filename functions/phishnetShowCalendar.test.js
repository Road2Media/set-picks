const test = require("node:test");
const assert = require("node:assert/strict");

const {
  labelGenericCluster,
  buildShowDatesByTour,
  enrichGroupsWithOfficialSchedule,
  flattenSnapshotScheduleByDate,
  flattenSnapshotTourByDate,
  mergeToursWithSnapshotPreservation,
  normalizePhishShows,
  parseTourOverridesDoc,
} = require("./phishnetShowCalendar");

test("official schedule enrichment prefers fresh data and preserves prior timing", () => {
  const groups = [
    {
      tour: "Summer Tour 2026",
      shows: [
        { date: "2026-07-21", venue: "Syracuse" },
        { date: "2026-07-22", venue: "MSG" },
      ],
    },
  ];
  const fresh = new Map([
    [
      "2026-07-21",
      {
        date: "2026-07-21",
        doorsLocal: "17:30",
        scheduledStartLocal: "19:00",
        scheduleSource: "phish.com",
      },
    ],
  ]);
  const previous = flattenSnapshotScheduleByDate({
    showDates: [
      {
        date: "2026-07-22",
        doorsLocal: "18:30",
        scheduleSource: "phish.com",
      },
    ],
  });

  const enriched = enrichGroupsWithOfficialSchedule(groups, fresh, previous);
  assert.equal(enriched[0].shows[0].doorsLocal, "17:30");
  assert.equal(enriched[0].shows[0].date, "2026-07-21");
  assert.equal(enriched[0].shows[1].doorsLocal, "18:30");
});

test("labelGenericCluster: Sphere Run", () => {
  const shows = [
    { date: "2026-04-16", venue: "Sphere, Las Vegas, NV" },
    { date: "2026-04-17", venue: "Sphere, Las Vegas, NV" },
  ];
  assert.equal(
    labelGenericCluster(shows, "2026-04-16", "2026-05-02"),
    "Sphere Run"
  );
});

test("labelGenericCluster: Dick's venue rolls into Summer Tour heuristic", () => {
  const shows = [
    {
      date: "2026-09-04",
      venue: "Dick's Sporting Goods Park, Commerce City, CO",
    },
    {
      date: "2026-09-05",
      venue: "Dick's Sporting Goods Park, Commerce City, CO",
    },
  ];
  assert.equal(
    labelGenericCluster(shows, "2026-09-04", "2026-09-05"),
    "Summer Tour 2026"
  );
});

test("labelGenericCluster: NPT Mexico year prefix", () => {
  const shows = [
    { date: "2026-01-28", venue: "Moon Palace, Cancun, Quintana Roo, Mexico" },
  ];
  assert.equal(
    labelGenericCluster(shows, "2026-01-28", "2026-01-28"),
    "2026 Mexico"
  );
});

test("labelGenericCluster: Summer Tour when majority Jun–Sep", () => {
  const shows = [
    { date: "2026-07-07", venue: "Kohl Center, Madison, WI" },
    { date: "2026-07-08", venue: "Kohl Center, Madison, WI" },
  ];
  assert.equal(
    labelGenericCluster(shows, "2026-07-07", "2026-07-08"),
    "Summer Tour 2026"
  );
});

test("labelGenericCluster: date span fallback for odd spring leg", () => {
  const shows = [
    { date: "2026-04-05", venue: "Some Arena, Boston, MA" },
    { date: "2026-04-06", venue: "Some Arena, Boston, MA" },
  ];
  const label = labelGenericCluster(shows, "2026-04-05", "2026-04-06");
  assert.match(label, /Apr/);
  assert.match(label, /2026/);
});

test("buildShowDatesByTour: preserves Phish.net tour_name when not NPT", () => {
  const shows = [
    {
      date: "2026-01-28",
      venue: "Moon Palace, Cancun, Mexico",
      tour_name: "2026 Mexico",
    },
  ];
  const groups = buildShowDatesByTour(shows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].tour, "2026 Mexico");
});

test("merge: preserves previous snapshot tour for same date", () => {
  const shows = [
    {
      date: "2026-07-07",
      venue: "Kohl Center, Madison, WI",
      tour_name: "Not Part of a Tour",
    },
  ];
  const computed = buildShowDatesByTour(shows);
  const prev = flattenSnapshotTourByDate({
    showDatesByTour: [
      {
        tour: "Custom Legacy Name",
        shows: [{ date: "2026-07-07", venue: "Kohl Center, Madison, WI" }],
      },
    ],
  });
  const { showDatesByTour } = mergeToursWithSnapshotPreservation(
    shows,
    computed,
    prev,
    new Map(),
    { isFirstSnapshot: false }
  );
  assert.equal(showDatesByTour[0].tour, "Custom Legacy Name");
});

test("merge: Phish.net named tour_name beats previous snapshot", () => {
  const shows = [
    {
      date: "2026-07-07",
      venue: "Kohl Center, Madison, WI",
      tour_name: "Summer Tour 2026",
    },
  ];
  const computed = buildShowDatesByTour(shows);
  const prev = flattenSnapshotTourByDate({
    showDatesByTour: [
      { tour: "Wrong Old Label", shows: [{ date: "2026-07-07", venue: "x" }] },
    ],
  });
  const { showDatesByTour } = mergeToursWithSnapshotPreservation(
    shows,
    computed,
    prev,
    new Map(),
    { isFirstSnapshot: false }
  );
  assert.equal(showDatesByTour[0].tour, "Summer Tour 2026");
});

test("merge: override beats previous snapshot", () => {
  const shows = [
    {
      date: "2026-07-07",
      venue: "Kohl Center, Madison, WI",
      tour_name: "Not Part of a Tour",
    },
  ];
  const computed = buildShowDatesByTour(shows);
  const prev = flattenSnapshotTourByDate({
    showDatesByTour: [
      { tour: "Old", shows: [{ date: "2026-07-07", venue: "x" }] },
    ],
  });
  const ov = new Map([["2026-07-07", "Summer Tour 2026"]]);
  const { showDatesByTour } = mergeToursWithSnapshotPreservation(
    shows,
    computed,
    prev,
    ov,
    { isFirstSnapshot: false }
  );
  assert.equal(showDatesByTour[0].tour, "Summer Tour 2026");
});

test("merge: first snapshot skips reviewQueue noise", () => {
  const shows = [
    {
      date: "2026-07-07",
      venue: "Kohl Center, Madison, WI",
      tour_name: "Not Part of a Tour",
    },
  ];
  const computed = buildShowDatesByTour(shows);
  const { reviewQueue } = mergeToursWithSnapshotPreservation(
    shows,
    computed,
    new Map(),
    new Map(),
    { isFirstSnapshot: true }
  );
  assert.equal(reviewQueue.length, 0);
});

test("merge: new date gets reviewQueue entry", () => {
  const shows = [
    {
      date: "2026-07-07",
      venue: "Kohl Center, Madison, WI",
      tour_name: "Not Part of a Tour",
    },
    {
      date: "2026-12-31",
      venue: "MSG, New York, NY",
      tour_name: "Not Part of a Tour",
    },
  ];
  const computed = buildShowDatesByTour(shows);
  const prev = flattenSnapshotTourByDate({
    showDatesByTour: [
      {
        tour: "Summer Tour 2026",
        shows: [{ date: "2026-07-07", venue: "Kohl Center, Madison, WI" }],
      },
    ],
  });
  const { reviewQueue } = mergeToursWithSnapshotPreservation(
    shows,
    computed,
    prev,
    new Map(),
    { isFirstSnapshot: false }
  );
  assert.equal(reviewQueue.length, 1);
  assert.equal(reviewQueue[0].date, "2026-12-31");
});

test("parseTourOverridesDoc", () => {
  const m = parseTourOverridesDoc({
    byShowDate: { "2026-09-04": "Summer Tour 2026" },
  });
  assert.equal(m.get("2026-09-04"), "Summer Tour 2026");
});

test("normalizePhishShows: drops excluded postponed dates and keeps the reschedule", () => {
  const out = normalizePhishShows([
    {
      artistid: 1,
      showdate: "2026-10-10",
      venue: "Orion Amphitheater",
      city: "Huntsville",
      state: "AL",
      country: "USA",
      tour_name: "2026 Fall Tour",
      exclude_from_stats: 1,
    },
    {
      artistid: 1,
      showdate: "2026-10-11",
      venue: "Orion Amphitheater",
      city: "Huntsville",
      state: "AL",
      country: "USA",
      tour_name: "2026 Fall Tour",
      exclude_from_stats: 0,
    },
    {
      artistid: 1,
      showdate: "2026-10-12",
      venue: "Orion Amphitheater",
      city: "Huntsville",
      state: "AL",
      country: "USA",
      tour_name: "2026 Fall Tour",
      exclude_from_stats: 0,
    },
  ]);

  assert.deepEqual(
    out.map((show) => show.date),
    ["2026-10-11", "2026-10-12"]
  );
  assert.equal(out[1].venue, "Orion Amphitheater, Huntsville, AL");
  assert.equal(out[1].timeZone, "America/Chicago");
});

test("normalizePhishShows: stamps per-show IANA timezone from location", () => {
  const out = normalizePhishShows([
    {
      artistid: 1,
      showdate: "2026-07-07",
      venue: "Kohl Center",
      city: "Madison",
      state: "WI",
      country: "USA",
      tour_name: "Not Part of a Tour",
    },
    {
      artistid: 1,
      showdate: "2026-01-28",
      venue: "Moon Palace",
      city: "Cancun",
      state: "",
      country: "Mexico",
      tour_name: "2026 Mexico",
    },
  ]);

  assert.equal(out[0].timeZone, "America/Cancun");
  assert.equal(out[0].city, "Cancun, Mexico");
  assert.equal(out[1].timeZone, "America/Chicago");
  assert.equal(out[1].city, "Madison, WI");
  assert.equal(out[1].venue, "Kohl Center, Madison, WI");
});
