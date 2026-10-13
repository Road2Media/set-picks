const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AUTO_FINALIZE_IDLE_MS,
  BUSTOUT_MIN_GAP,
  CONFIRMED_SET1_ELAPSED_MS,
  CONFIRMED_SET1_IDLE_MS,
  PROVISIONAL_SET1_ELAPSED_MS,
  PROVISIONAL_SET1_IDLE_MS,
  SHOW_SAFETY_CAP_MS,
  buildSetlistDocFromRows,
  candidateShowDates,
  deriveBustoutsFromRows,
  deriveSongGapsFromRows,
  evaluateAutoFinalize,
  evaluateSet1CloserStage,
  hourInTimeZone,
  isWithinLiveSetlistPollWindow,
  isWithinShowLocalPollWindow,
  normalizeSetlistRows,
  parseShowCalendarSnapshotToDateSet,
  parseShowCalendarSnapshotToShows,
  parseShowCalendarSnapshotToShowsByTour,
  pollSingleShowDate,
  randomScheduledPollDelayMs,
  scheduledCandidateShowDates,
  set1TitleSignatureFromRows,
  setlistPayloadEqual,
  signatureFromRows,
} = require("./phishnetLiveSetlistAutomation");

/** Fixture: `show_calendar/snapshot`-shaped doc (subset). */
const SHOW_CALENDAR_SNAPSHOT_FIXTURE = {
  schemaVersion: 2,
  showDates: [
    { date: "2026-07-03", venue: "A", timeZone: "America/New_York" },
    { date: "2026-07-04", venue: "B", timeZone: "America/New_York" },
  ],
};

test("candidateShowDates returns ET today and previous day (admin / force poll)", () => {
  const dates = candidateShowDates(new Date("2026-04-15T01:30:00.000Z"));
  assert.equal(dates.length, 2);
  assert.match(dates[0], /^\d{4}-\d{2}-\d{2}$/);
  assert.match(dates[1], /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(dates[0], dates[1]);
});

test("parseShowCalendarSnapshotToDateSet reads flat showDates", () => {
  const set = parseShowCalendarSnapshotToDateSet(SHOW_CALENDAR_SNAPSHOT_FIXTURE);
  assert.ok(set);
  assert.equal(set.has("2026-07-03"), true);
  assert.equal(set.has("2026-07-04"), true);
});

test("parseShowCalendarSnapshotToShows reads date + timezone + venue/city/tour", () => {
  const shows = parseShowCalendarSnapshotToShows({
    showDates: [
      {
        date: "2026-07-03",
        venue: "Kohl Center, Madison, WI",
        city: "Madison, WI",
        tour_name: "2026 Summer Tour",
        timeZone: "America/Chicago",
      },
      { date: "2026-07-04", venue: "United Center, Chicago, IL" },
      "2026-07-05",
    ],
  });
  assert.deepEqual(shows, [
    {
      date: "2026-07-03",
      timeZone: "America/Chicago",
      venue: "Kohl Center, Madison, WI",
      city: "Madison, WI",
      tour_name: "2026 Summer Tour",
    },
    {
      date: "2026-07-04",
      timeZone: "America/Los_Angeles",
      venue: "United Center, Chicago, IL",
    },
    { date: "2026-07-05", timeZone: "America/Los_Angeles" },
  ]);
});

test("parseShowCalendarSnapshotToShowsByTour stamps tour from showDatesByTour (#514)", () => {
  const shows = parseShowCalendarSnapshotToShowsByTour({
    showDates: [
      { date: "2026-04-16", venue: "Sphere" },
      { date: "2026-07-07", venue: "Kohl Center" },
    ],
    showDatesByTour: [
      {
        tour: "Sphere Run 2026",
        shows: [
          { date: "2026-04-16", venue: "Sphere", timeZone: "America/Los_Angeles" },
        ],
      },
      {
        tour: "Summer Tour 2026",
        shows: [
          {
            date: "2026-07-07",
            venue: "Kohl Center",
            city: "Madison, WI",
            timeZone: "America/Chicago",
          },
        ],
      },
    ],
  });
  assert.ok(shows);
  assert.equal(shows.length, 2);
  assert.equal(shows[0].tour, "Sphere Run 2026");
  assert.equal(shows[1].tour, "Summer Tour 2026");
  assert.equal(shows[1].city, "Madison, WI");
});

test("parseShowCalendarSnapshotToDateSet accepts string dates", () => {
  const set = parseShowCalendarSnapshotToDateSet({
    showDates: ["2026-08-01", "2026-08-02"],
  });
  assert.ok(set);
  assert.equal(set.has("2026-08-01"), true);
});

test("parseShowCalendarSnapshotToDateSet returns null when strict-invalid", () => {
  assert.equal(parseShowCalendarSnapshotToDateSet(null), null);
  assert.equal(parseShowCalendarSnapshotToDateSet({}), null);
  assert.equal(parseShowCalendarSnapshotToDateSet({ showDates: [] }), null);
  assert.equal(parseShowCalendarSnapshotToDateSet({ showDates: [{ venue: "x" }] }), null);
});

test("isWithinLiveSetlistPollWindow: 4pm–4am ET (summer EDT)", () => {
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-07-04T20:00:00-04:00")),
    true
  );
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-07-04T15:00:00-04:00")),
    false
  );
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-07-04T02:30:00-04:00")),
    true
  );
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-07-04T03:00:00-04:00")),
    true
  );
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-07-04T03:59:00-04:00")),
    true
  );
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-07-04T04:00:00-04:00")),
    false
  );
});

test("isWithinLiveSetlistPollWindow: winter EST", () => {
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-01-15T21:00:00-05:00")),
    true
  );
  assert.equal(
    isWithinLiveSetlistPollWindow(new Date("2026-01-15T14:00:00-05:00")),
    false
  );
});

test("isWithinShowLocalPollWindow: evaluates window in provided timezone", () => {
  const now = new Date("2026-07-04T20:00:00.000Z");
  assert.equal(isWithinShowLocalPollWindow(now, "America/New_York"), true); // 16:00
  assert.equal(isWithinShowLocalPollWindow(now, "America/Los_Angeles"), false); // 13:00
});

test("hourInTimeZone: handles DST fall-back repeated hour", () => {
  const beforeFallback = new Date("2026-11-01T05:30:00.000Z");
  const afterFallback = new Date("2026-11-01T06:30:00.000Z");
  assert.equal(hourInTimeZone(beforeFallback, "America/New_York"), 1);
  assert.equal(hourInTimeZone(afterFallback, "America/New_York"), 1);
});

test("scheduledCandidateShowDates: evening uses today only when in calendar", () => {
  const cal = parseShowCalendarSnapshotToShows(SHOW_CALENDAR_SNAPSHOT_FIXTURE);
  const dates = scheduledCandidateShowDates(
    new Date("2026-07-04T22:00:00-04:00"),
    cal
  );
  assert.deepEqual(dates, ["2026-07-04"]);
});

test("scheduledCandidateShowDates: after midnight adds yesterday when still a show date", () => {
  const cal = parseShowCalendarSnapshotToShows(SHOW_CALENDAR_SNAPSHOT_FIXTURE);
  const dates = scheduledCandidateShowDates(
    new Date("2026-07-04T01:30:00-04:00"),
    cal
  );
  assert.deepEqual(dates, ["2026-07-04", "2026-07-03"]);
});

test("scheduledCandidateShowDates: 3am hour still includes yesterday", () => {
  const cal = parseShowCalendarSnapshotToShows(SHOW_CALENDAR_SNAPSHOT_FIXTURE);
  const dates = scheduledCandidateShowDates(
    new Date("2026-07-04T03:15:00-04:00"),
    cal
  );
  assert.deepEqual(dates, ["2026-07-04", "2026-07-03"]);
});

test("scheduledCandidateShowDates: post-midnight only prior night when today not on calendar", () => {
  const cal = parseShowCalendarSnapshotToShows({
    showDates: [{ date: "2026-07-03", venue: "x" }],
  });
  const dates = scheduledCandidateShowDates(
    new Date("2026-07-04T01:00:00-04:00"),
    cal
  );
  assert.deepEqual(dates, ["2026-07-03"]);
});

test("scheduledCandidateShowDates skips a show with an invalid timezone", () => {
  const dates = scheduledCandidateShowDates(new Date("2026-07-04T22:00:00-04:00"), [
    { date: "2026-07-04", timeZone: "America/New_York" },
    { date: "2026-07-05", timeZone: "Not/A/Zone" },
  ]);
  assert.deepEqual(dates, ["2026-07-04"]);
});

test("scheduledCandidateShowDates: different zones evaluated independently", () => {
  const cal = parseShowCalendarSnapshotToShows({
    showDates: [
      { date: "2026-07-04", venue: "MSG", timeZone: "America/New_York" },
      { date: "2026-07-04", venue: "Hollywood Bowl", timeZone: "America/Los_Angeles" },
    ],
  });
  // 20:00Z = 16:00 ET, 13:00 PT
  const dates = scheduledCandidateShowDates(new Date("2026-07-04T20:00:00.000Z"), cal);
  assert.deepEqual(dates, ["2026-07-04"]);
});

test("randomScheduledPollDelayMs is within 90–150 seconds (#311)", () => {
  for (let i = 0; i < 50; i += 1) {
    const ms = randomScheduledPollDelayMs(Math.random);
    assert.ok(ms >= 90 * 1000 && ms <= 150 * 1000);
  }
  assert.equal(randomScheduledPollDelayMs(() => 0), 90 * 1000);
  assert.equal(randomScheduledPollDelayMs(() => 0.999999), 150 * 1000);
});

test("normalizeSetlistRows parses + sorts phish.net row shape", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "2", idx: 2, song: "Zero" },
      { set: "1", idx: 1, song: "AC/DC Bag" },
      { set: "2", idx: 1, song: "Down with Disease" },
      { set: "E", idx: 1, song: "Tweezer Reprise" },
      { set: "1", idx: 2, song: "Bathtub Gin" },
    ],
  });
  assert.equal(rows[0].title, "AC/DC Bag");
  assert.equal(rows[rows.length - 1].title, "Tweezer Reprise");
});

test("buildSetlistDocFromRows maps slots and ordered list", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "AC/DC Bag" },
      { set: "1", idx: 2, song: "Bathtub Gin" },
      { set: "2", idx: 1, song: "Down with Disease" },
      { set: "2", idx: 2, song: "Zero" },
      { set: "E", idx: 1, song: "Tweezer Reprise" },
    ],
  });
  const out = buildSetlistDocFromRows(rows, {});
  assert.equal(out.setlist.s1o, "AC/DC Bag");
  assert.equal(out.setlist.s1c, "Bathtub Gin");
  assert.equal(out.setlist.s2o, "Down with Disease");
  assert.equal(out.setlist.s2c, "Zero");
  assert.equal(out.setlist.enc, "Tweezer Reprise");
  assert.deepEqual(out.encoreSongs, ["Tweezer Reprise"]);
  assert.equal(out.officialSetlist.length, 5);
});

test("buildSetlistDocFromRows preserves non-empty prior slots for partial feed", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [{ set: "1", idx: 1, song: "AC/DC Bag" }],
  });
  const out = buildSetlistDocFromRows(rows, {
    setlist: { s1o: "AC/DC Bag", s1c: "Bathtub Gin", s2o: "Carini", s2c: "Zero", enc: "Loving Cup" },
    encoreSongs: ["Loving Cup"],
  });
  assert.equal(out.setlist.s1o, "AC/DC Bag");
  assert.equal(out.setlist.s1c, "");
  assert.equal(out.setlist.s2o, "Carini");
  assert.equal(out.setlist.s2c, "");
  assert.equal(out.setlist.enc, "Loving Cup");
  assert.deepEqual(out.encoreSongs, ["Loving Cup"]);
});

test("buildSetlistDocFromRows records every encore song", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "A" },
      { set: "2", idx: 1, song: "B" },
      { set: "E", idx: 1, song: "E1" },
      { set: "E", idx: 2, song: "E2" },
    ],
  });
  const out = buildSetlistDocFromRows(rows, {});
  assert.deepEqual(out.encoreSongs, ["E1", "E2"]);
  assert.equal(out.setlist.enc, "E1");
});

test("signatureFromRows stable and changes with song edits", () => {
  const base = normalizeSetlistRows({
    error: false,
    data: [{ set: "1", idx: 1, song: "AC/DC Bag" }],
  });
  const same = normalizeSetlistRows({
    error: false,
    data: [{ set: "1", idx: 1, song: "AC/DC Bag" }],
  });
  const changed = normalizeSetlistRows({
    error: false,
    data: [{ set: "1", idx: 1, song: "Possum" }],
  });
  assert.equal(signatureFromRows(base), signatureFromRows(same));
  assert.notEqual(signatureFromRows(base), signatureFromRows(changed));
});

test("setlistPayloadEqual compares slots and official ordering", () => {
  const a = {
    setlist: { s1o: "A", s1c: "B", s2o: "", s2c: "", enc: "" },
    officialSetlist: ["A", "B"],
  };
  const b = {
    setlist: { s1o: "A", s1c: "B", s2o: "", s2c: "", enc: "" },
    officialSetlist: ["A", "B"],
  };
  const c = {
    setlist: { s1o: "A", s1c: "B", s2o: "", s2c: "", enc: "" },
    officialSetlist: ["B", "A"],
  };
  assert.equal(setlistPayloadEqual(a, b), true);
  assert.equal(setlistPayloadEqual(a, c), false);
});

test("historical progression replay keeps slots stable as show grows", () => {
  const snapshots = [
    { error: false, data: [{ set: "1", idx: 1, song: "AC/DC Bag" }] },
    {
      error: false,
      data: [
        { set: "1", idx: 1, song: "AC/DC Bag" },
        { set: "1", idx: 2, song: "Bathtub Gin" },
      ],
    },
    {
      error: false,
      data: [
        { set: "1", idx: 1, song: "AC/DC Bag" },
        { set: "1", idx: 2, song: "Bathtub Gin" },
        { set: "2", idx: 1, song: "Carini" },
        { set: "E", idx: 1, song: "Tweezer Reprise" },
      ],
    },
  ];

  let doc = {
    setlist: { s1o: "", s1c: "", s2o: "", s2c: "", enc: "" },
    officialSetlist: [],
    encoreSongs: [],
  };
  for (const payload of snapshots) {
    doc = buildSetlistDocFromRows(normalizeSetlistRows(payload), doc);
  }

  assert.equal(doc.setlist.s1o, "AC/DC Bag");
  assert.equal(doc.setlist.s1c, "Bathtub Gin");
  assert.equal(doc.setlist.s2o, "Carini");
  assert.equal(doc.setlist.s2c, "Carini");
  assert.equal(doc.setlist.enc, "Tweezer Reprise");
  assert.deepEqual(doc.encoreSongs, ["Tweezer Reprise"]);
  assert.equal(doc.officialSetlist.length, 4);
});

// ---------- per-show bustouts snapshot (#214) ----------

test("normalizeSetlistRows preserves per-row gap (number and numeric string)", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "A", gap: 12 },
      { set: "1", idx: 2, song: "B", gap: "40" },
      { set: "1", idx: 3, song: "C", gap: null },
      { set: "1", idx: 4, song: "D" },
    ],
  });
  const byTitle = Object.fromEntries(rows.map((r) => [r.title, r.gap]));
  assert.equal(byTitle.A, 12);
  assert.equal(byTitle.B, 40);
  assert.equal(byTitle.C, null);
  assert.equal(byTitle.D, null);
});

test("deriveBustoutsFromRows selects titles with gap >= BUSTOUT_MIN_GAP", () => {
  const rows = [
    { setKey: "1", position: 1, title: "Low Gap", gap: 5 },
    { setKey: "1", position: 2, title: "Exact Threshold", gap: BUSTOUT_MIN_GAP },
    { setKey: "1", position: 3, title: "Big Gap", gap: 137 },
    { setKey: "1", position: 4, title: "Unknown Gap", gap: null },
  ];
  const bustouts = deriveBustoutsFromRows(rows);
  assert.deepEqual(bustouts, ["Exact Threshold", "Big Gap"]);
});

test("deriveBustoutsFromRows dedupes by normalized title, keeps first casing", () => {
  const rows = [
    { setKey: "1", position: 1, title: "Colonel Forbin's Ascent", gap: 98 },
    { setKey: "E", position: 1, title: "COLONEL FORBIN'S ASCENT", gap: 98 },
  ];
  const bustouts = deriveBustoutsFromRows(rows);
  assert.deepEqual(bustouts, ["Colonel Forbin's Ascent"]);
});

test("deriveSongGapsFromRows freezes every dated row gap by normalized title", () => {
  const rows = [
    { setKey: "1", position: 1, title: "AC/DC Bag", gap: 8 },
    { setKey: "1", position: 2, title: "Big Gap", gap: 137 },
    { setKey: "1", position: 3, title: "Zero Gap", gap: 0 },
    { setKey: "1", position: 4, title: "Unknown", gap: null },
    { setKey: "2", position: 1, title: "Negative", gap: -3 },
  ];
  const gaps = deriveSongGapsFromRows(rows);
  assert.deepEqual(gaps, {
    "ac/dc bag": 8,
    "big gap": 137,
    "zero gap": 0,
  });
});

test("deriveSongGapsFromRows keeps first occurrence for a repeated normalized title", () => {
  const rows = [
    { setKey: "1", position: 1, title: "Tweezer", gap: 12 },
    { setKey: "E", position: 1, title: "TWEEZER", gap: 99 },
  ];
  assert.deepEqual(deriveSongGapsFromRows(rows), { tweezer: 12 });
});

test("buildSetlistDocFromRows emits songGaps and keeps songs absent from this poll", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "AC/DC Bag", gap: 8 },
      { set: "2", idx: 1, song: "Colonel Forbin's Ascent", gap: 98 },
    ],
  });
  const out = buildSetlistDocFromRows(rows, {
    songGaps: { "bathtub gin": 14 },
  });
  assert.deepEqual(out.songGaps, {
    "ac/dc bag": 8,
    "colonel forbin's ascent": 98,
    "bathtub gin": 14,
  });
});

test("buildSetlistDocFromRows keeps the first positive gap and ignores a live 0", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "Melt the Guns", gap: 2052 },
      { set: "1", idx: 2, song: "AC/DC Bag", gap: 0 },
      { set: "2", idx: 1, song: "Oblivion", gap: 0 },
      { set: "2", idx: 2, song: "Down with Disease", gap: 4 },
    ],
  });
  const out = buildSetlistDocFromRows(rows, {
    songGaps: {
      "melt the guns": 2051,
      "ac/dc bag": 8,
      oblivion: 3,
      "bathtub gin": 14,
      ghost: 0,
    },
    bustouts: ["Melt the Guns"],
  });
  assert.equal(out.songGaps["melt the guns"], 2051);
  assert.equal(out.songGaps["ac/dc bag"], 8);
  assert.equal(out.songGaps.oblivion, 3);
  assert.equal(out.songGaps["bathtub gin"], 14);
  assert.equal(out.songGaps["down with disease"], 4);
  assert.equal(out.songGaps.ghost, undefined);
  assert.deepEqual(out.bustouts, ["Melt the Guns"]);
});

test("buildSetlistDocFromRows records a positive gap over a stored placeholder 0", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "2", idx: 1, song: "Oblivion", gap: 3 },
      { set: "1", idx: 1, song: "Fuego", gap: 0 },
    ],
  });
  const out = buildSetlistDocFromRows(rows, {
    songGaps: { oblivion: 0, fuego: 0 },
  });
  assert.deepEqual(out.songGaps, { oblivion: 3 });
});

test("buildSetlistDocFromRows emits bustouts from per-row gap", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "AC/DC Bag", gap: 8 },
      { set: "1", idx: 2, song: "Bathtub Gin", gap: 14 },
      { set: "2", idx: 1, song: "Colonel Forbin's Ascent", gap: 98 },
      { set: "2", idx: 2, song: "Down with Disease", gap: 2 },
      { set: "E", idx: 1, song: "Fluff's Travels", gap: 1884 },
    ],
  });
  const out = buildSetlistDocFromRows(rows, {});
  assert.deepEqual(out.bustouts, ["Colonel Forbin's Ascent", "Fluff's Travels"]);
});

test("buildSetlistDocFromRows merges prior bustouts as a superset (partial feed safety)", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      // Set 1 already played; Phish.net might already include gap here.
      { set: "1", idx: 1, song: "AC/DC Bag", gap: 8 },
      // Set 2 not yet played in this feed; prior snapshot has a bustout from
      // an earlier partial poll. We must preserve it.
    ],
  });
  const out = buildSetlistDocFromRows(rows, {
    bustouts: ["Colonel Forbin's Ascent"],
  });
  // Prior bustout preserved even though it is not in the current rows slice.
  assert.ok(out.bustouts.includes("Colonel Forbin's Ascent"));
});

test("setlistPayloadEqual detects bustouts membership change, ignores casing/order", () => {
  const base = {
    setlist: { s1o: "A", s1c: "", s2o: "", s2c: "", enc: "" },
    officialSetlist: ["A"],
    encoreSongs: [],
    bustouts: ["Colonel Forbin's Ascent", "Fluff's Travels"],
  };
  const reordered = { ...base, bustouts: ["Fluff's Travels", "Colonel Forbin's Ascent"] };
  const recased = { ...base, bustouts: ["colonel forbin's ascent", "fluff's travels"] };
  const removed = { ...base, bustouts: ["Colonel Forbin's Ascent"] };
  const added = { ...base, bustouts: [...base.bustouts, "Minkin"] };

  assert.equal(setlistPayloadEqual(base, reordered), true);
  assert.equal(setlistPayloadEqual(base, recased), true);
  assert.equal(setlistPayloadEqual(base, removed), false);
  assert.equal(setlistPayloadEqual(base, added), false);
});

test("setlistPayloadEqual: absent bustouts on both sides still compares equal", () => {
  const a = {
    setlist: { s1o: "A", s1c: "", s2o: "", s2c: "", enc: "" },
    officialSetlist: ["A"],
    encoreSongs: [],
  };
  const b = { ...a };
  assert.equal(setlistPayloadEqual(a, b), true);
});

test("setlistPayloadEqual detects a songGaps correction with an unchanged setlist (#1062)", () => {
  const base = {
    setlist: { s1o: "Melt the Guns", s1c: "", s2o: "", s2c: "", enc: "" },
    officialSetlist: ["Melt the Guns"],
    encoreSongs: [],
    bustouts: ["Melt the Guns"],
    songGaps: { "melt the guns": 2051 },
  };
  const corrected = {
    ...base,
    songGaps: { "melt the guns": 2052 },
  };
  const reorderedKeys = {
    ...base,
    songGaps: { "melt the guns": 2051 },
  };
  assert.equal(setlistPayloadEqual(base, corrected), false);
  assert.equal(setlistPayloadEqual(base, reorderedKeys), true);
});

// ---------- #264 time-gated set 1 closer ----------

/** Fixture helper: set-1-only rows, `n` songs, positions 1..n. */
function set1OnlyRows(titles) {
  return normalizeSetlistRows({
    error: false,
    data: titles.map((song, i) => ({ set: "1", idx: i + 1, song })),
  });
}

test("set1TitleSignatureFromRows: stable for identical set 1, ignores set 2 / encore", () => {
  const a = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "AC/DC Bag" },
      { set: "1", idx: 2, song: "Bathtub Gin" },
    ],
  });
  const b = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "AC/DC Bag" },
      { set: "1", idx: 2, song: "Bathtub Gin" },
      { set: "2", idx: 1, song: "Carini" },
      { set: "E", idx: 1, song: "Loving Cup" },
    ],
  });
  const c = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "AC/DC Bag" },
      { set: "1", idx: 2, song: "Bathtub Gin" },
      { set: "1", idx: 3, song: "Possum" },
    ],
  });
  assert.equal(set1TitleSignatureFromRows(a), set1TitleSignatureFromRows(b));
  assert.notEqual(set1TitleSignatureFromRows(a), set1TitleSignatureFromRows(c));
  assert.equal(set1TitleSignatureFromRows([]), "");
});

test("evaluateSet1CloserStage: provisional at 75m + 8m idle", () => {
  const nowMs = 1_000_000_000_000;
  const stage = evaluateSet1CloserStage({
    set1Count: 3,
    set2Count: 0,
    nowMs,
    firstRowObservedAtMs: nowMs - PROVISIONAL_SET1_ELAPSED_MS,
    lastSet1ChangeAtMs: nowMs - PROVISIONAL_SET1_IDLE_MS,
  });
  assert.equal(stage, "provisional");
});

test("evaluateSet1CloserStage: confirmed at 85m + 12m idle", () => {
  const nowMs = 1_000_000_000_000;
  const stage = evaluateSet1CloserStage({
    set1Count: 3,
    set2Count: 0,
    nowMs,
    firstRowObservedAtMs: nowMs - CONFIRMED_SET1_ELAPSED_MS,
    lastSet1ChangeAtMs: nowMs - CONFIRMED_SET1_IDLE_MS,
  });
  assert.equal(stage, "confirmed");
});

test("evaluateSet1CloserStage: set 2 start hard-confirms", () => {
  const stage = evaluateSet1CloserStage({
    set1Count: 2,
    set2Count: 1,
    nowMs: null,
    firstRowObservedAtMs: null,
    lastSet1ChangeAtMs: null,
  });
  assert.equal(stage, "confirmed");
});

test("buildSetlistDocFromRows: provisional close fires at elapsed ≥ 75m and idle ≥ 8m", () => {
  const rows = set1OnlyRows(["AC/DC Bag", "Bathtub Gin", "Carini"]);
  const nowMs = 1_000_000_000_000;
  const out = buildSetlistDocFromRows(rows, {}, {
    nowMs,
    firstRowObservedAtMs: nowMs - PROVISIONAL_SET1_ELAPSED_MS,
    lastSet1ChangeAtMs: nowMs - PROVISIONAL_SET1_IDLE_MS,
  });
  assert.equal(out.setlist.s1o, "AC/DC Bag");
  assert.equal(out.setlist.s1c, "Carini");
  assert.equal(out.set1CloserStage, "provisional");
  assert.equal(out.setlist.s2o, "");
  assert.equal(out.setlist.s2c, "");
});

test("buildSetlistDocFromRows: early-elapsed guard keeps s1c empty even when idle is long", () => {
  const rows = set1OnlyRows(["AC/DC Bag", "Bathtub Gin"]);
  const nowMs = 1_000_000_000_000;
  const out = buildSetlistDocFromRows(rows, {}, {
    nowMs,
    firstRowObservedAtMs: nowMs - (60 * 60_000), // 60 min elapsed (< 75)
    lastSet1ChangeAtMs: nowMs - (30 * 60_000),   // 30 min idle (> 8)
  });
  assert.equal(out.setlist.s1c, "");
  assert.equal(out.set1CloserStage, null);
});

test("buildSetlistDocFromRows: idle guard keeps s1c empty during a long jam", () => {
  const rows = set1OnlyRows(["AC/DC Bag", "Bathtub Gin"]);
  const nowMs = 1_000_000_000_000;
  const out = buildSetlistDocFromRows(rows, {}, {
    nowMs,
    firstRowObservedAtMs: nowMs - (90 * 60_000), // 90 min elapsed (> 75)
    lastSet1ChangeAtMs: nowMs - (5 * 60_000),    // 5 min idle (< 8)
  });
  assert.equal(out.setlist.s1c, "");
  assert.equal(out.set1CloserStage, null);
});

test("buildSetlistDocFromRows: missing timing state behaves like pre-#264 (no timing close)", () => {
  const rows = set1OnlyRows(["AC/DC Bag", "Bathtub Gin"]);
  const out = buildSetlistDocFromRows(rows, {});
  assert.equal(out.setlist.s1c, "");
  assert.equal(out.set1CloserStage, null);
});

test("buildSetlistDocFromRows: set 2 start still forces s1c regardless of timing inputs", () => {
  const rows = normalizeSetlistRows({
    error: false,
    data: [
      { set: "1", idx: 1, song: "AC/DC Bag" },
      { set: "1", idx: 2, song: "Bathtub Gin" },
      { set: "2", idx: 1, song: "Carini" },
    ],
  });
  const nowMs = 1_000_000_000_000;
  const out = buildSetlistDocFromRows(rows, {}, {
    nowMs,
    firstRowObservedAtMs: nowMs - (10 * 60_000), // would block on timing
    lastSet1ChangeAtMs: nowMs - (1 * 60_000),    // would block on idle
  });
  assert.equal(out.setlist.s1c, "Bathtub Gin");
  assert.equal(out.setlist.s2o, "Carini");
  assert.equal(out.set1CloserStage, "confirmed");
});

test("buildSetlistDocFromRows: long-set edge — new set-1 song after stage fires rewrites s1c on re-fire", () => {
  const nowMs = 1_000_000_000_000;
  // Poll A: 3 songs, provisional threshold met → s1c = "Carini".
  const pollA = buildSetlistDocFromRows(
    set1OnlyRows(["AC/DC Bag", "Bathtub Gin", "Carini"]),
    {},
    {
      nowMs,
      firstRowObservedAtMs: nowMs - (80 * 60_000),
      lastSet1ChangeAtMs: nowMs - (9 * 60_000),
    }
  );
  assert.equal(pollA.setlist.s1c, "Carini");
  assert.equal(pollA.set1CloserStage, "provisional");

  // Poll B: 4th song just arrived; lastSet1ChangeAt reset to now → idle < 8m.
  const pollBNow = nowMs + (4 * 60_000);
  const pollB = buildSetlistDocFromRows(
    set1OnlyRows(["AC/DC Bag", "Bathtub Gin", "Carini", "Down with Disease"]),
    pollA,
    {
      nowMs: pollBNow,
      firstRowObservedAtMs: nowMs - (80 * 60_000),
      lastSet1ChangeAtMs: pollBNow, // just changed
    }
  );
  assert.equal(pollB.setlist.s1c, "");
  assert.equal(pollB.set1CloserStage, null);

  // Poll C: 8+ min later, no new song → provisional stage re-fires.
  const pollCNow = pollBNow + (8 * 60_000);
  const pollC = buildSetlistDocFromRows(
    set1OnlyRows(["AC/DC Bag", "Bathtub Gin", "Carini", "Down with Disease"]),
    pollB,
    {
      nowMs: pollCNow,
      firstRowObservedAtMs: nowMs - (80 * 60_000),
      lastSet1ChangeAtMs: pollBNow,
    }
  );
  assert.equal(pollC.setlist.s1c, "Down with Disease");
  assert.equal(pollC.set1CloserStage, "provisional");
});

test("buildSetlistDocFromRows: exact-threshold provisional elapsed + idle fires (inclusive)", () => {
  const nowMs = 1_000_000_000_000;
  const out = buildSetlistDocFromRows(
    set1OnlyRows(["AC/DC Bag", "Bathtub Gin"]),
    {},
    {
      nowMs,
      firstRowObservedAtMs: nowMs - PROVISIONAL_SET1_ELAPSED_MS,
      lastSet1ChangeAtMs: nowMs - PROVISIONAL_SET1_IDLE_MS,
    }
  );
  assert.equal(out.setlist.s1c, "Bathtub Gin");
  assert.equal(out.set1CloserStage, "provisional");
});

test("buildSetlistDocFromRows: confirmed stage fires on stricter idle threshold", () => {
  const nowMs = 1_000_000_000_000;
  const out = buildSetlistDocFromRows(
    set1OnlyRows(["AC/DC Bag", "Bathtub Gin", "Carini"]),
    {},
    {
      nowMs,
      firstRowObservedAtMs: nowMs - CONFIRMED_SET1_ELAPSED_MS,
      lastSet1ChangeAtMs: nowMs - CONFIRMED_SET1_IDLE_MS,
    }
  );
  assert.equal(out.setlist.s1c, "Carini");
  assert.equal(out.set1CloserStage, "confirmed");
});

// ---------- #266 auto-finalize ----------

test("evaluateAutoFinalize: fires on encore + 25 min idle", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: nowMs - (3 * 60 * 60_000), // 3h into show
    lastRowsChangedAtMs: nowMs - AUTO_FINALIZE_IDLE_MS,
    encoreSongsCount: 1,
    set2Count: 6,
    alreadyAutoFinalized: false,
  });
  assert.equal(decision.shouldFinalize, true);
  assert.equal(decision.reason, "encore-idle");
});

test("evaluateAutoFinalize: encore but idle under threshold does not fire", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: nowMs - (3 * 60 * 60_000),
    lastRowsChangedAtMs: nowMs - (10 * 60_000),
    encoreSongsCount: 1,
    set2Count: 6,
    alreadyAutoFinalized: false,
  });
  assert.equal(decision.shouldFinalize, false);
});

test("evaluateAutoFinalize: idle long but no encore does not fire (below safety cap)", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: nowMs - (3 * 60 * 60_000),
    lastRowsChangedAtMs: nowMs - (30 * 60_000),
    encoreSongsCount: 0,
    set2Count: 6,
    alreadyAutoFinalized: false,
  });
  assert.equal(decision.shouldFinalize, false);
});

test("evaluateAutoFinalize: safety cap fires past 4h30m when set 2 has songs", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: nowMs - SHOW_SAFETY_CAP_MS,
    lastRowsChangedAtMs: nowMs - (5 * 60_000), // idle short — cap still fires
    encoreSongsCount: 0,
    set2Count: 1,
    alreadyAutoFinalized: false,
  });
  assert.equal(decision.shouldFinalize, true);
  assert.equal(decision.reason, "safety-cap");
});

test("evaluateAutoFinalize: safety cap does NOT fire if set 2 has no songs", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: nowMs - SHOW_SAFETY_CAP_MS,
    lastRowsChangedAtMs: nowMs - (60 * 60_000),
    encoreSongsCount: 0,
    set2Count: 0,
    alreadyAutoFinalized: false,
  });
  assert.equal(decision.shouldFinalize, false);
});

test("evaluateAutoFinalize: skips when already auto-finalized", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: nowMs - (3 * 60 * 60_000),
    lastRowsChangedAtMs: nowMs - AUTO_FINALIZE_IDLE_MS,
    encoreSongsCount: 1,
    set2Count: 6,
    alreadyAutoFinalized: true,
  });
  assert.equal(decision.shouldFinalize, false);
});

test("evaluateAutoFinalize: missing firstRowObservedAtMs → no fire", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: null,
    lastRowsChangedAtMs: nowMs - AUTO_FINALIZE_IDLE_MS,
    encoreSongsCount: 1,
    set2Count: 6,
    alreadyAutoFinalized: false,
  });
  assert.equal(decision.shouldFinalize, false);
});

test("evaluateAutoFinalize: exact-threshold idle + encore fires (inclusive)", () => {
  const nowMs = 1_000_000_000_000;
  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs: nowMs - (3 * 60 * 60_000),
    lastRowsChangedAtMs: nowMs - AUTO_FINALIZE_IDLE_MS,
    encoreSongsCount: 1,
    set2Count: 4,
    alreadyAutoFinalized: false,
  });
  assert.equal(decision.shouldFinalize, true);
});

// ---------- #266 pollSingleShowDate integration with auto-finalize ----------

/** Minimal Firestore/admin harness for `pollSingleShowDate` wiring tests. */
function buildFakeFirestoreHarness(initialDocs = {}) {
  /** @type {Map<string, Record<string, unknown>>} */
  const docs = new Map(Object.entries(initialDocs));
  /** @type {Array<{ path: string, data: Record<string, unknown>, merge: boolean }>} */
  const writes = [];

  function path(collection, id) {
    return `${collection}/${id}`;
  }

  function makeRef(collection, id) {
    const key = path(collection, id);
    return {
      path: key,
      async get() {
        const data = docs.get(key);
        return {
          exists: data !== undefined,
          data: () => (data ? { ...data } : undefined),
        };
      },
      async set(value, opts) {
        const merge = Boolean(opts?.merge);
        const prev = docs.get(key) || {};
        const next = merge ? { ...prev, ...value } : { ...value };
        docs.set(key, next);
        writes.push({ path: key, data: { ...value }, merge });
      },
    };
  }

  const db = {
    collection(name) {
      return {
        doc: (id) => makeRef(name, id),
      };
    },
    batch() {
      /** @type {Array<() => void>} */
      const ops = [];
      return {
        set(ref, value, opts) {
          ops.push(async () => {
            await ref.set(value, opts);
          });
        },
        async commit() {
          for (const op of ops) {
            await op();
          }
        },
      };
    },
  };

  const admin = {
    firestore: {
      Timestamp: {
        fromMillis: (ms) => ({ _millis: ms, toMillis: () => ms }),
        fromDate: (d) => ({
          _millis: d.getTime(),
          toMillis: () => d.getTime(),
        }),
      },
      FieldValue: {
        serverTimestamp: () => ({ _sentinel: "serverTimestamp" }),
        delete: () => ({ _sentinel: "delete" }),
        increment: (n) => ({ _sentinel: "increment", n }),
      },
    },
  };

  return { db, admin, docs, writes };
}

/** Build a Phish.net API JSON response envelope from a list of rows. */
function phishnetResponseFromRows(rows) {
  return { data: rows };
}

/** Minimal `fetch` stub mirroring what `fetchPhishnetSetlistForDate` consumes. */
function makeFakeFetch(rows) {
  const bodyText = JSON.stringify(phishnetResponseFromRows(rows));
  return async () => ({
    ok: true,
    status: 200,
    async text() {
      return bodyText;
    },
  });
}

test("pollSingleShowDate: encore + idle triggers auto-finalize and stamps automation doc", async () => {
  const showDate = "2026-07-03";
  const nowMs = 1_000_000_000_000;
  const firstRowMs = nowMs - 3 * 60 * 60_000; // 3h in
  const lastRowsChangedMs = nowMs - AUTO_FINALIZE_IDLE_MS - 60_000; // idle past threshold

  const signature = "pre-existing-signature"; // matches what the harness will produce
  const rows = [
    { set: "1", position: 1, song: "AC/DC Bag" },
    { set: "1", position: 2, song: "Bathtub Gin" },
    { set: "2", position: 1, song: "Tweezer" },
    { set: "2", position: 2, song: "Simple" },
    { set: "e", position: 1, song: "Loving Cup" },
  ];
  const normalized = normalizeSetlistRows({ data: rows });
  const realSignature = signatureFromRows(normalized);

  const initialSetlist = {
    showDate,
    status: "LIVE",
    isScored: false,
    setlist: { s1o: "AC/DC Bag", s2o: "Tweezer", enc: "Loving Cup" },
    officialSetlist: { set1: [], set2: [], encore: [] },
    encoreSongs: ["Loving Cup"],
    sourceMeta: { signature: realSignature, songCount: rows.length },
  };
  const initialAutomation = {
    showDate,
    enabled: true,
    firstRowObservedAt: { _millis: firstRowMs, toMillis: () => firstRowMs },
    lastRowsChangedAt: {
      _millis: lastRowsChangedMs,
      toMillis: () => lastRowsChangedMs,
    },
  };

  const harness = buildFakeFirestoreHarness({
    [`official_setlists/${showDate}`]: initialSetlist,
    [`live_setlist_automation/${showDate}`]: initialAutomation,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeFakeFetch(rows);

  let rollupCalled = null;
  const runRollup = async ({ showDate: sd, trigger }) => {
    rollupCalled = { showDate: sd, trigger };
    return { processedPicks: 3, skippedPicks: 0, totalPicks: 3, setlistExists: true };
  };

  const originalNow = Date.now;
  Date.now = () => nowMs;

  try {
    const result = await pollSingleShowDate({
      db: harness.db,
      admin: harness.admin,
      showDate,
      apiKey: "test-key",
      logger: { info() {}, warn() {}, error() {} },
      runRollup,
    });

    // Payload may differ from the prior doc (s1c/other built fields), so the
    // write may take the "changed" branch even though the rows signature is
    // identical. Auto-finalize should still fire because the prior
    // `lastRowsChangedAt` anchor is preserved (rows signature unchanged).
    assert.deepEqual(rollupCalled, { showDate, trigger: "auto" });

    const autoStamp = harness.docs.get(`live_setlist_automation/${showDate}`);
    assert.ok(
      autoStamp?.autoFinalizedAt,
      "automation doc should be stamped with autoFinalizedAt"
    );
    assert.equal(autoStamp.autoFinalizeTrigger, "encore-idle");
    assert.equal(result.autoFinalize.fired, true);
    assert.equal(result.autoFinalize.trigger, "auto");
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("pollSingleShowDate: idempotent — prior autoFinalizedAt + no row change = no rollup", async () => {
  const showDate = "2026-07-03";
  const nowMs = 1_000_000_000_000;
  const firstRowMs = nowMs - 3 * 60 * 60_000;
  const lastRowsChangedMs = nowMs - 30 * 60_000;
  const autoFinalizedMs = nowMs - 5 * 60_000;

  const rows = [
    { set: "1", position: 1, song: "AC/DC Bag" },
    { set: "2", position: 1, song: "Tweezer" },
    { set: "e", position: 1, song: "Loving Cup" },
  ];
  const normalized = normalizeSetlistRows({ data: rows });
  const realSignature = signatureFromRows(normalized);

  const harness = buildFakeFirestoreHarness({
    [`official_setlists/${showDate}`]: {
      showDate,
      sourceMeta: { signature: realSignature, songCount: rows.length },
      encoreSongs: ["Loving Cup"],
      setlist: { s1o: "AC/DC Bag", s2o: "Tweezer", enc: "Loving Cup" },
      officialSetlist: { set1: [], set2: [], encore: [] },
    },
    [`live_setlist_automation/${showDate}`]: {
      showDate,
      enabled: true,
      firstRowObservedAt: { _millis: firstRowMs, toMillis: () => firstRowMs },
      lastRowsChangedAt: {
        _millis: lastRowsChangedMs,
        toMillis: () => lastRowsChangedMs,
      },
      autoFinalizedAt: {
        _millis: autoFinalizedMs,
        toMillis: () => autoFinalizedMs,
      },
      autoFinalizeTrigger: "encore-idle",
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeFakeFetch(rows);

  let rollupCallCount = 0;
  const runRollup = async () => {
    rollupCallCount += 1;
    return { processedPicks: 0, skippedPicks: 0, totalPicks: 0, setlistExists: true };
  };

  const originalNow = Date.now;
  Date.now = () => nowMs;

  try {
    const result = await pollSingleShowDate({
      db: harness.db,
      admin: harness.admin,
      showDate,
      apiKey: "test-key",
      logger: { info() {}, warn() {}, error() {} },
      runRollup,
    });

    assert.equal(rollupCallCount, 0, "no rollup call expected on already-finalized no-change poll");
    assert.equal(result.autoFinalize.fired, false);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("pollSingleShowDate: post-finalize row change triggers auto-reconcile", async () => {
  const showDate = "2026-07-03";
  const nowMs = 1_000_000_000_000;
  const firstRowMs = nowMs - 4 * 60 * 60_000;
  const autoFinalizedMs = nowMs - 30 * 60_000;

  const rows = [
    { set: "1", position: 1, song: "AC/DC Bag" },
    { set: "2", position: 1, song: "Tweezer" },
    { set: "e", position: 1, song: "Loving Cup" },
    { set: "e", position: 2, song: "Tweezer Reprise" },
  ];

  const harness = buildFakeFirestoreHarness({
    [`official_setlists/${showDate}`]: {
      showDate,
      sourceMeta: { signature: "stale-signature", songCount: 3 },
      encoreSongs: ["Loving Cup"],
      setlist: { s1o: "AC/DC Bag", s2o: "Tweezer", enc: "Loving Cup" },
      officialSetlist: { set1: [], set2: [], encore: [] },
    },
    [`live_setlist_automation/${showDate}`]: {
      showDate,
      enabled: true,
      firstRowObservedAt: { _millis: firstRowMs, toMillis: () => firstRowMs },
      autoFinalizedAt: {
        _millis: autoFinalizedMs,
        toMillis: () => autoFinalizedMs,
      },
      autoFinalizeTrigger: "encore-idle",
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeFakeFetch(rows);

  let rollupCalled = null;
  const runRollup = async ({ showDate: sd, trigger }) => {
    rollupCalled = { showDate: sd, trigger };
    return { processedPicks: 2, skippedPicks: 0, totalPicks: 2, setlistExists: true };
  };

  const originalNow = Date.now;
  Date.now = () => nowMs;

  try {
    const result = await pollSingleShowDate({
      db: harness.db,
      admin: harness.admin,
      showDate,
      apiKey: "test-key",
      logger: { info() {}, warn() {}, error() {} },
      runRollup,
    });

    assert.equal(result.changed, true, "signature differs → changed branch");
    assert.deepEqual(rollupCalled, { showDate, trigger: "auto-reconcile" });
    assert.equal(result.autoFinalize.trigger, "auto-reconcile");
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("pollSingleShowDate: runRollup not injected → auto-finalize is a no-op", async () => {
  const showDate = "2026-07-03";
  const nowMs = 1_000_000_000_000;
  const firstRowMs = nowMs - 3 * 60 * 60_000;
  const lastRowsChangedMs = nowMs - AUTO_FINALIZE_IDLE_MS - 60_000;

  const rows = [
    { set: "1", position: 1, song: "AC/DC Bag" },
    { set: "2", position: 1, song: "Tweezer" },
    { set: "e", position: 1, song: "Loving Cup" },
  ];
  const normalized = normalizeSetlistRows({ data: rows });
  const realSignature = signatureFromRows(normalized);

  const harness = buildFakeFirestoreHarness({
    [`official_setlists/${showDate}`]: {
      showDate,
      sourceMeta: { signature: realSignature, songCount: rows.length },
      encoreSongs: ["Loving Cup"],
      setlist: { s1o: "AC/DC Bag", s2o: "Tweezer", enc: "Loving Cup" },
      officialSetlist: { set1: [], set2: [], encore: [] },
    },
    [`live_setlist_automation/${showDate}`]: {
      showDate,
      enabled: true,
      firstRowObservedAt: { _millis: firstRowMs, toMillis: () => firstRowMs },
      lastRowsChangedAt: {
        _millis: lastRowsChangedMs,
        toMillis: () => lastRowsChangedMs,
      },
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeFakeFetch(rows);

  const originalNow = Date.now;
  Date.now = () => nowMs;

  try {
    const result = await pollSingleShowDate({
      db: harness.db,
      admin: harness.admin,
      showDate,
      apiKey: "test-key",
      logger: { info() {}, warn() {}, error() {} },
      // No runRollup — simulates the admin "Poll Now" path.
    });

    assert.equal(result.autoFinalize.fired, false);
    assert.equal(result.autoFinalize.reason, "no-runner");
    const autoStamp = harness.docs.get(`live_setlist_automation/${showDate}`);
    assert.equal(
      autoStamp.autoFinalizedAt,
      undefined,
      "no stamp should be written when runRollup absent"
    );
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
