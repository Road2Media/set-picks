/**
 * Phish.in row mapping (#1002). No network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { phishinSetKey, rowsFromPhishinTracks } from "./phishin.mjs";
import { showRecordFromPhishinShow } from "./dataset.mjs";

test("phishinSetKey maps set names and drops soundcheck", () => {
  assert.equal(phishinSetKey("Set 1"), "1");
  assert.equal(phishinSetKey("Set 2"), "2");
  assert.equal(phishinSetKey("Set 3"), "3");
  assert.equal(phishinSetKey("Encore"), "encore");
  assert.equal(phishinSetKey("Encore 2"), "encore");
  assert.equal(phishinSetKey("Soundcheck"), null);
});

test("show record keeps slot labels and set-3 songs in the played list", () => {
  const record = showRecordFromPhishinShow({
    date: "2024-12-31",
    tracks: [
      { title: "Mike's Song", set_name: "Set 1", position: 1 },
      { title: "Coil", set_name: "Set 1", position: 2 },
      { title: "Sigma Oasis", set_name: "Set 2", position: 1 },
      { title: "First Tube", set_name: "Set 2", position: 2 },
      { title: "Character Zero", set_name: "Set 3", position: 1 },
      { title: "Grind", set_name: "Encore", position: 1 },
      { title: "Soundcheck Jam", set_name: "Soundcheck", position: 1 },
    ],
  });
  assert.equal(record.showDate, "2024-12-31");
  assert.equal(record.slots.s1o, "Mike's Song");
  assert.equal(record.slots.s1c, "Coil");
  assert.equal(record.slots.s2o, "Sigma Oasis");
  assert.equal(record.slots.s2c, "First Tube");
  assert.equal(record.slots.enc, "Grind");
  assert.ok(record.songs.includes("Character Zero"));
  assert.equal(record.songs.includes("Soundcheck Jam"), false);
  assert.equal(rowsFromPhishinTracks([{ title: "", set_name: "Set 1" }]).length, 0);
});
