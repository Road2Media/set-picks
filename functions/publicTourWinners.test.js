"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isFinishedPublicTour,
  loadPublicTourWinners,
  publicTourWinnersFromPicks,
} = require("./publicTourWinners");

function gradedPick(uid, handle, score, showDate) {
  return {
    userId: uid,
    handle,
    score,
    showDate,
    isGraded: true,
    picks: { opener: "Tweezer" },
  };
}

test("isFinishedPublicTour: complete past tours only", () => {
  const fall = {
    showsWithSetlist: 8,
    tourShowCount: 8,
    lastShowDate: "2026-10-12",
  };
  assert.equal(isFinishedPublicTour(fall, "2026-10-22"), true);
  assert.equal(
    isFinishedPublicTour({ ...fall, showsWithSetlist: 7 }, "2026-10-22"),
    false
  );
  assert.equal(
    isFinishedPublicTour({ ...fall, lastShowDate: "2026-10-22" }, "2026-10-22"),
    false
  );
  assert.equal(
    isFinishedPublicTour(
      { showsWithSetlist: 21, tourShowCount: 21, lastShowDate: "2026-09-06" },
      "2026-10-22"
    ),
    true
  );
});

test("publicTourWinnersFromPicks: sole winner, tie, and Anonymous dropped", () => {
  const sole = publicTourWinnersFromPicks([
    {
      date: "2026-10-11",
      picks: [
        gradedPick("a", "I have the book", 115, "2026-10-11"),
        gradedPick("b", "YarmouthMeg", 90, "2026-10-11"),
      ],
    },
  ]);
  assert.deepEqual(sole, {
    handles: ["I have the book"],
    points: 115,
    tied: false,
  });
  assert.equal(JSON.stringify(sole).includes("uid"), false);

  const tied = publicTourWinnersFromPicks([
    {
      date: "2026-10-11",
      picks: [
        gradedPick("a", "Ada", 40, "2026-10-11"),
        gradedPick("b", "Bea", 40, "2026-10-11"),
        gradedPick("c", "Cara", 10, "2026-10-11"),
      ],
    },
  ]);
  assert.equal(tied.tied, true);
  assert.equal(tied.points, 40);
  assert.deepEqual(tied.handles, ["Ada", "Bea"]);

  const anon = publicTourWinnersFromPicks([
    {
      date: "2026-10-11",
      picks: [gradedPick("a", "Anonymous", 20, "2026-10-11")],
    },
  ]);
  assert.equal(anon, null);
});

test("loadPublicTourWinners reads picks for the tour dates only", async () => {
  const stored = [
    gradedPick("a", "Ada", 50, "2026-07-11"),
    gradedPick("b", "Bea", 10, "2026-07-11"),
    gradedPick("c", "Other Tour", 999, "2026-04-18"),
  ];
  const db = {
    collection() {
      return {
        where(_field, _op, chunk) {
          return {
            async get() {
              return {
                docs: stored
                  .filter((row) => chunk.includes(row.showDate))
                  .map((row, i) => ({
                    id: String(i),
                    data: () => row,
                  })),
              };
            },
          };
        },
      };
    },
  };
  const winners = await loadPublicTourWinners(db, ["2026-07-11"]);
  assert.deepEqual(winners, { handles: ["Ada"], points: 50, tied: false });
  assert.equal(await loadPublicTourWinners(db, []), null);
});
