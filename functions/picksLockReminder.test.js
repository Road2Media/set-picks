"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findReminderTonightShow,
  isPastPicksLock,
  reminderLogDocId,
  formatTimeToLock,
  buildPicksLockReminderRecipients,
} = require("./picksLockReminder");

test("reminderLogDocId", () => {
  assert.equal(reminderLogDocId("2026-07-01", "uid1"), "reminder_2026-07-01_uid1");
});

test("findReminderTonightShow returns null before T-3h window", () => {
  const shows = [{ date: "2099-06-15", timeZone: "America/Los_Angeles" }];
  // 4:00pm PDT — still before 4:30pm (lock 7:30 − 3h).
  const now = new Date("2099-06-15T23:00:00.000Z");
  assert.equal(findReminderTonightShow(shows, now), null);
});

test("findReminderTonightShow skips an invalid timezone and still finds tonight", () => {
  const shows = [
    { date: "2099-06-15", timeZone: "Not/A/Zone", venue: "Bad" },
    {
      date: "2099-06-15",
      timeZone: "America/Los_Angeles",
      venue: "MSG",
      city: "New York, NY",
    },
  ];
  const now = new Date("2099-06-16T00:30:00.000Z");
  const out = findReminderTonightShow(shows, now);
  assert.ok(out);
  assert.equal(out.venue_name, "MSG");
});

test("findReminderTonightShow returns show in T-3h–lock window with venue metadata", () => {
  const shows = [
    {
      date: "2099-06-15",
      timeZone: "America/Los_Angeles",
      venue: "MSG",
      city: "New York, NY",
    },
  ];
  // 5:30pm PDT — inside 4:30–7:30 window.
  const now = new Date("2099-06-16T00:30:00.000Z");
  const out = findReminderTonightShow(shows, now);
  assert.ok(out);
  assert.equal(out.showDate, "2099-06-15");
  assert.equal(out.venue_name, "MSG");
  assert.equal(out.venue_city, "New York, NY");
});

test("isPastPicksLock is true after local lock", () => {
  const afterLock = new Date("2099-06-16T04:10:00.000Z");
  assert.equal(
    isPastPicksLock("2099-06-15", "America/Los_Angeles", afterLock),
    true
  );
});

test("formatTimeToLock returns 3 hours at window open", () => {
  // 4:30pm PDT on show day → exactly 3 hours until 7:30pm lock.
  const now = new Date("2099-06-15T23:30:00.000Z");
  assert.equal(formatTimeToLock("2099-06-15", "America/Los_Angeles", now), "3 hours");
});

test("buildPicksLockReminderRecipients excludes users with picks and deduped uids", () => {
  const usersWithPicks = new Set(["has-picks"]);
  const dedupedUids = new Set(["already-sent"]);
  const userDocs = [
    { id: "has-picks", data: () => ({ handle: "a" }) },
    { id: "already-sent", data: () => ({ handle: "b" }) },
    { id: "eligible", data: () => ({ handle: "c", email: "c@example.com" }) },
    { id: "no-handle", data: () => ({ email: "d@example.com" }) },
  ];
  const recipients = buildPicksLockReminderRecipients({
    usersWithPicks,
    showDate: "2026-07-07",
    showMeta: {
      timeZone: "America/Chicago",
      venue_name: "Kohl Center",
      venue_city: "Madison, WI",
    },
    userDocs,
    dedupedUids,
    now: new Date("2026-07-07T22:00:00.000Z"),
    cap: 10,
  });

  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].uid, "eligible");
  assert.equal(recipients[0].payload.venue_name, "Kohl Center");
  assert.equal(recipients[0].vars.showYmd, "2026-07-07");
});
