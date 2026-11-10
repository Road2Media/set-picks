"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  HUNDREDTH_SHOW_DATE,
  HUNDREDTH_SHOW_PATH,
  DRY_RUN_SAMPLE_ROWS,
  HUNDREDTH_EMPTY_BOARD_COPY,
  HUNDREDTH_DRY_RUN_COPY,
  resolveHundredthShowDate,
  hundredthShowCardMark,
  projectPublicNightBoard,
  privateLeakPaths,
  shouldPublishHundredthBoard,
  buildPublicNightBoardDoc,
  hundredthSharePack,
  withHundredthSharePack,
  hundredthRecapSentSpec,
} = require("./hundredthShowBoard.cjs");
const { rankHundredthBoardRows, scoredRowsFromPicks } = require("./hundredthShowPublish.cjs");

const POISON = {
  rank: 1,
  handle: "Fan Handle",
  points: 42,
  exactSlots: 3,
  email: "fan@example.com",
  uid: "uid-secret",
  userId: "uid-secret",
  photoURL: "https://example.com/a.jpg",
  notificationPrefs: { email: { results: true } },
  picks: { s1o: "Tweezer" },
};

test("public board keeps handles and drops emails and private fields (#1147)", () => {
  const rows = projectPublicNightBoard([
    POISON,
    { rank: 2, handle: "secret@example.com", points: 10, exactSlots: 1, email: "secret@example.com" },
    { rank: 3, handle: "  ", points: 9, exactSlots: 0, email: "blank@example.com" },
    { handle: "No Rank", points: 4, exactSlots: 0, userId: "u9" },
  ]);
  assert.deepEqual(rows, [
    { rank: 1, handle: "Fan Handle", points: 42, exactSlots: 3 },
    { rank: 0, handle: "No Rank", points: 4, exactSlots: 0 },
  ]);
  const blob = JSON.stringify(rows);
  assert.equal(blob.includes("@"), false);
  assert.equal(blob.includes("uid-secret"), false);
  assert.equal(blob.includes("photoURL"), false);
  assert.equal(blob.includes("Tweezer"), false);
  assert.deepEqual(privateLeakPaths(rows), []);
  assert.equal(JSON.stringify(DRY_RUN_SAMPLE_ROWS).includes("@"), false);
  assert.equal(/chair/i.test(HUNDREDTH_EMPTY_BOARD_COPY), false);
  assert.equal(/chair/i.test(HUNDREDTH_DRY_RUN_COPY), false);
});

test("ranking uses the live show order, then the public projection (#1147)", () => {
  const rows = rankHundredthBoardRows([
    { uid: "u2", email: "b@example.com", handle: "Second", points: 10, exactHits: 1, correctPicks: 2 },
    { uid: "u1", email: "a@example.com", handle: "First", points: 30, exactHits: 2, correctPicks: 3 },
    { uid: "u3", email: "c@example.com", handle: "c@example.com", points: 99, exactHits: 4, correctPicks: 4 },
  ]);
  assert.deepEqual(rows, [
    { rank: 1, handle: "First", points: 30, exactSlots: 2 },
    { rank: 2, handle: "Second", points: 10, exactSlots: 1 },
  ]);
  assert.equal(JSON.stringify(rows).includes("@"), false);
});

test("pick rows do not carry an email onto the board (#1147)", () => {
  const scored = scoredRowsFromPicks(
    [
      {
        id: "2026-07-29_u1",
        data: () => ({
          userId: "u1",
          email: "fan@example.com",
          handle: "fan@example.com",
          picks: { s1o: "Tweezer" },
          score: 10,
        }),
      },
      {
        id: "2026-07-29_u2",
        data: () => ({
          userId: "u2",
          email: "ok@example.com",
          handle: "Real Handle",
          picks: { s1o: "Ghost" },
          score: 20,
        }),
      },
    ],
    null,
    null,
    new Map([["u1", "From User"]]),
  );
  const board = buildPublicNightBoardDoc("2026-07-29", rankHundredthBoardRows(scored), {
    dryRun: true,
  });
  assert.deepEqual(
    board.rows.map((row) => row.handle),
    ["Real Handle", "From User"],
  );
  assert.equal(JSON.stringify(board).includes("@"), false);
  assert.equal(board.dryRun, true);
});

test("production ignores a dry-run date (#1147)", () => {
  assert.deepEqual(
    resolveHundredthShowDate({
      mode: "production",
      search: "?dryRunDate=2026-07-29",
    }),
    { date: HUNDREDTH_SHOW_DATE, dryRun: false },
  );
  assert.deepEqual(resolveHundredthShowDate({ mode: "staging", search: "" }), {
    date: HUNDREDTH_SHOW_DATE,
    dryRun: false,
  });
  assert.deepEqual(
    resolveHundredthShowDate({ mode: "staging", search: "?dryRunDate=2026-07-29" }),
    { date: "2026-07-29", dryRun: true },
  );
  assert.equal(shouldPublishHundredthBoard("2026-07-29"), false);
  assert.equal(shouldPublishHundredthBoard("2026-07-29", { allowDryRun: true }), true);
  assert.equal(shouldPublishHundredthBoard(HUNDREDTH_SHOW_DATE), true);
  const card = hundredthShowCardMark("2026-07-29", {
    mode: "staging",
    search: "?dryRunDate=2026-07-29",
  });
  assert.equal(card.eyebrow, "The 100th dry run");
  assert.equal(/chair/i.test(`${card.eyebrow} ${card.line}`), false);
  assert.equal(
    hundredthShowCardMark("2026-07-29", {
      mode: "production",
      search: "?dryRunDate=2026-07-29",
    }),
    null,
  );
  assert.equal(hundredthShowCardMark(HUNDREDTH_SHOW_DATE).eyebrow, "The 100th");
});

test("share pack is only the hundredth show and has no email (#1147)", () => {
  assert.equal(hundredthSharePack("2026-07-29"), null);
  const pack = hundredthSharePack(HUNDREDTH_SHOW_DATE);
  assert.equal(pack.path, HUNDREDTH_SHOW_PATH);
  assert.match(pack.url, /utm_content=pick-the-100th/);
  assert.equal(JSON.stringify(pack).includes("@"), false);
  assert.equal(/chair/i.test(JSON.stringify(pack)), false);
  const payload = withHundredthSharePack(
    { handle: "Fan", email: "should-stay-off-the-pack@example.com" },
    HUNDREDTH_SHOW_DATE,
  );
  assert.equal(payload.share_pack.text.includes("Handles only"), true);
  assert.equal(payload.share_pack.email, undefined);
  const other = withHundredthSharePack({ handle: "Fan" }, "2026-07-29");
  assert.equal(other.share_pack, undefined);
});

test("hundredth recap sent spec fires once and only for that date (#1147)", () => {
  assert.equal(hundredthRecapSentSpec("2026-07-29", { processed: 4, delivered: 4 }), null);
  assert.equal(hundredthRecapSentSpec(HUNDREDTH_SHOW_DATE, { processed: 0, delivered: 0 }), null);
  const spec = hundredthRecapSentSpec(HUNDREDTH_SHOW_DATE, { processed: 3, delivered: 3 });
  assert.equal(spec.triggerId, "show_recap");
  assert.equal(spec.scope, HUNDREDTH_SHOW_DATE);
  assert.equal(spec.status, "sent");
  assert.equal(spec.extra.sharePack, true);
  assert.equal(JSON.stringify(spec).includes("@"), false);
});
