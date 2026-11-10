"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  refreshPublicShowNotes,
  syncPublicShowNote,
} = require("./publicShowNotes");

/**
 * @param {Record<string, Record<string, Record<string, unknown>>>} seed
 */
function memoryDb(seed) {
  const data = structuredClone(seed);
  function collection(name) {
    if (!data[name]) data[name] = {};
    return {
      doc(id) {
        const ref = { id, _col: name };
        ref.get = async () => {
          const value = data[name][id];
          return {
            exists: value != null,
            id,
            data: () => value,
          };
        };
        ref.set = async (value) => {
          data[name][id] = value;
        };
        ref.delete = async () => {
          delete data[name][id];
        };
        return ref;
      },
      async get() {
        return {
          docs: Object.entries(data[name] || {}).map(([id, value]) => ({
            id,
            data: () => value,
          })),
        };
      },
    };
  }
  return {
    collection,
    batch() {
      /** @type {Function[]} */
      const ops = [];
      return {
        set(ref, value) {
          ops.push(() => {
            data[ref._col][ref.id] = value;
          });
        },
        delete(ref) {
          ops.push(() => {
            delete data[ref._col][ref.id];
          });
        },
        async commit() {
          for (const op of ops) op();
        },
      };
    },
    _data: data,
  };
}

const rich = {
  showDate: "2026-08-01",
  tourKey: "2026 Summer Tour",
  opener_title: "Sample in a Jar",
  encore_title: "Harry Hood",
  bustout_entries: [{ title: "Harry Hood", gap: 412 }],
  tour_debuts_trusted: false,
  set_songs: { set1: ["ZZZUNIQUESETSONG"], set2: [], encore: ["Harry Hood"] },
  setlist_highlight: "You caught Harry Hood on your board.",
  uid: "player-1",
};

test("refresh writes the rich night, drops a thin one, and leaves context untouched", async () => {
  const db = memoryDb({
    comms_show_context: {
      "2026-08-01": rich,
      "2026-08-02": {
        showDate: "2026-08-02",
        opener_title: "Golgi Apparatus",
        encore_title: "Tweezer Reprise",
        tour_debuts_trusted: false,
      },
    },
    show_calendar: {
      snapshot: {
        showDates: [
          { date: "2026-08-01", venue: "Madison Square Garden", city: "New York" },
        ],
      },
    },
    public_show_notes: {
      "2026-07-04": {
        showDate: "2026-07-04",
        paragraphs: ["Old note.", "Bustout: Tube."],
        headline: "07/04/26: Tube bustout",
      },
    },
  });

  const result = await refreshPublicShowNotes(db, {
    now: "2026-11-10T00:00:00.000Z",
  });
  assert.deepEqual(result, { written: 1, deleted: 1 });

  const published = db._data.public_show_notes["2026-08-01"];
  assert.equal(published.venue, "Madison Square Garden");
  assert.equal(published.writtenAt, "2026-11-10T00:00:00.000Z");
  assert.equal(Object.hasOwn(published, "set_songs"), false);
  assert.equal(Object.hasOwn(published, "uid"), false);
  assert.equal(JSON.stringify(published).includes("ZZZUNIQUESETSONG"), false);
  assert.equal(JSON.stringify(published).includes("You caught"), false);
  assert.equal(db._data.public_show_notes["2026-08-02"], undefined);
  assert.equal(db._data.public_show_notes["2026-07-04"], undefined);
  assert.deepEqual(db._data.public_show_notes._index.notes.map((row) => row.showDate), [
    "2026-08-01",
  ]);
  assert.equal(Object.hasOwn(db._data.public_show_notes._index.notes[0], "paragraphs"), false);
  assert.equal(db._data.comms_show_context["2026-08-01"].uid, "player-1");
  assert.deepEqual(db._data.comms_show_context["2026-08-01"].set_songs.set1, [
    "ZZZUNIQUESETSONG",
  ]);
});

test("sync removes a night that no longer clears the gate", async () => {
  const db = memoryDb({
    show_calendar: { snapshot: { showDates: [] } },
    public_show_notes: {
      "2026-08-02": {
        showDate: "2026-08-02",
        paragraphs: ["08/02/26.", "Bustout: Tube."],
        headline: "08/02/26: Tube bustout",
      },
    },
  });
  const result = await syncPublicShowNote(db, {
    showDate: "2026-08-02",
    opener_title: "Golgi Apparatus",
    encore_title: "Tweezer Reprise",
    tour_debuts_trusted: false,
  });
  assert.deepEqual(result, { showDate: "2026-08-02", published: false });
  assert.equal(db._data.public_show_notes["2026-08-02"], undefined);
  assert.deepEqual(db._data.public_show_notes._index.notes, []);
});
