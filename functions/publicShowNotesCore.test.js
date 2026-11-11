"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PUBLIC_NOTE_KEYS,
  buildPublicShowNotesIndex,
  projectPublicShowNote,
} = require("./publicShowNotesCore");

const SHOW_DATE = "2026-08-01";

function richContext(overrides = {}) {
  return {
    showDate: SHOW_DATE,
    tourKey: "2026 Summer Tour",
    opener_title: "Sample in a Jar",
    encore_title: "Harry Hood",
    bustout_entries: [{ title: "Harry Hood", gap: 412 }],
    bustout_titles: ["Harry Hood"],
    tour_debut_titles: ["Plasma", "Ruby Waves"],
    tour_debuts_trusted: true,
    set_counts: { set1: 8, set2: 9, encore: 1 },
    set_songs: {
      set1: ["Sample in a Jar", "ZZZUNIQUESETSONG", "Reba"],
      set2: ["Tweezer", "Maze"],
      encore: ["Harry Hood"],
    },
    song_gaps: { tweezer: 4 },
    last_played: { Tweezer: "2026-07-01" },
    lifetime_plays: { Tweezer: 400 },
    setlist_highlight: "You caught Harry Hood on your wildcard.",
    uid: "player-1",
    handle: "fan",
    score: 42,
    show_moment_tags: ["bustout", "tour_debut", "multi_encore"],
    ...overrides,
  };
}

test("opener and encore alone are too thin to publish", () => {
  const note = projectPublicShowNote(
    richContext({
      bustout_entries: [],
      bustout_titles: [],
      tour_debut_titles: [],
      tour_debuts_trusted: false,
    }),
  );
  assert.equal(note, null);
});

test("an untrusted first-show debut list is not a public note", () => {
  const note = projectPublicShowNote(
    richContext({
      bustout_entries: [],
      bustout_titles: [],
      tour_debuts_trusted: false,
      tour_debut_titles: ["A", "B", "C", "D", "E", "F", "G", "H"],
    }),
  );
  assert.equal(note, null);
});

test("a long trusted debut list is not published without a bustout", () => {
  const note = projectPublicShowNote(
    richContext({
      bustout_entries: [],
      bustout_titles: [],
      tour_debuts_trusted: true,
      tour_debut_titles: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
    }),
  );
  assert.equal(note, null);
});

test("a bustout night publishes show-level facts and drops the setlist", () => {
  const note = projectPublicShowNote(richContext(), {
    venue: "Madison Square Garden",
    city: "New York",
  });
  assert.ok(note);
  assert.deepEqual(Object.keys(note), PUBLIC_NOTE_KEYS);
  assert.equal(note.showDate, SHOW_DATE);
  assert.equal(note.tourSlug, "2026-summer-tour");
  assert.equal(note.venue, "Madison Square Garden");
  assert.equal(note.headline, "08/01/26: Harry Hood bustout");
  assert.equal(note.schemaVersion, 1);
  assert.equal(note.source, "comms_show_context");
  assert.deepEqual(note.bustouts, [{ title: "Harry Hood", gap: 412 }]);
  assert.deepEqual(note.tourDebuts, ["Plasma", "Ruby Waves"]);
  assert.equal(note.tourDebutMore, 0);
  assert.deepEqual(note.setCounts, { set1: 8, set2: 9, encore: 1 });
  assert.ok(note.paragraphs.length >= 2 && note.paragraphs.length <= 4);
  assert.match(note.paragraphs[0], /08\/01\/26 at Madison Square Garden, New York/);
  assert.match(note.paragraphs[0], /Set 1 opened with Sample in a Jar/);
  assert.match(note.paragraphs[0], /the encore was Harry Hood/);
  assert.match(note.paragraphs[1], /Bustout: Harry Hood \(a 412 show gap\)/);
  assert.match(note.paragraphs.join(" "), /New to this tour: Plasma and Ruby Waves/);
  assert.match(note.paragraphs.join(" "), /Set 1 ran 8 songs and Set 2 ran 9 songs/);
  const dumped = JSON.stringify(note);
  for (const hidden of [
    "ZZZUNIQUESETSONG",
    "Reba",
    "Tweezer",
    "Maze",
    "You caught",
    "player-1",
    "your wildcard",
    "set_songs",
    "song_gaps",
  ]) {
    assert.equal(dumped.includes(hidden), false, hidden);
  }
});

test("gap article follows the spoken number", () => {
  const note = projectPublicShowNote(
    richContext({
      bustout_entries: [
        { title: "Wolfman's Brother", gap: 87 },
        { title: "Fluffhead", gap: 142 },
      ],
      tour_debut_titles: [],
      tour_debuts_trusted: false,
    }),
  );
  assert.match(
    note.paragraphs[1],
    /Bustouts: Wolfman's Brother \(an 87 show gap\); Fluffhead \(a 142 show gap\)/,
  );
});

test("a short trusted debut list publishes without listing the rest of the set", () => {
  const note = projectPublicShowNote(
    richContext({
      bustout_entries: [],
      bustout_titles: [],
      tour_debuts_trusted: true,
      tour_debut_titles: ["Plasma", "Ruby Waves", "Ghost", "Twist", "Slave"],
      set_songs: {
        set1: ["ZZZUNIQUESETSONG", "Plasma"],
        set2: ["Reba"],
        encore: ["Harry Hood"],
      },
    }),
  );
  assert.ok(note);
  assert.equal(note.headline, "08/01/26: new to the tour");
  assert.deepEqual(note.tourDebuts, ["Plasma", "Ruby Waves", "Ghost", "Twist"]);
  assert.equal(note.tourDebutMore, 1);
  assert.match(
    note.paragraphs.join(" "),
    /New to this tour: Plasma, Ruby Waves, Ghost, and Twist, plus 1 more/,
  );
  assert.equal(JSON.stringify(note).includes("ZZZUNIQUESETSONG"), false);
  assert.equal(JSON.stringify(note).includes("Slave"), false);
});

test("a gap under 30 is not printed as a bustout gap", () => {
  const note = projectPublicShowNote(
    richContext({
      bustout_entries: [{ title: "Tube", gap: 12 }],
      tour_debut_titles: [],
      tour_debuts_trusted: false,
    }),
  );
  assert.match(note.paragraphs[1], /^Bustout: Tube\.$/);
  assert.equal(note.bustouts[0].gap, null);
});

test("the hub index keeps headlines only, newest first", () => {
  const older = projectPublicShowNote(richContext({ showDate: "2026-07-01" }));
  const newer = projectPublicShowNote(richContext());
  const index = buildPublicShowNotesIndex([older, newer], "2026-11-10T00:00:00.000Z");
  assert.deepEqual(
    index.notes.map((row) => row.showDate),
    ["2026-08-01", "2026-07-01"],
  );
  assert.equal(Object.hasOwn(index.notes[0], "paragraphs"), false);
  assert.equal(Object.hasOwn(index.notes[0], "bustouts"), false);
  assert.equal(index.writtenAt, "2026-11-10T00:00:00.000Z");
});
