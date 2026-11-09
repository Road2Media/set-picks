"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { prefAllows } = require("./notificationPrefs");

test("prefAllows defaults allow-categories on and commercial off", () => {
  assert.equal(prefAllows({}, "lifecycle", "email"), true);
  assert.equal(prefAllows({}, "commercial", "push"), false);
  assert.equal(prefAllows({ notificationPrefs: {} }, "results", "inApp"), true);
});

test("a flat opt-out still blocks every channel that has no explicit boolean", () => {
  const userData = { notificationPrefs: { lifecycle: false, commercial: true } };
  assert.equal(prefAllows(userData, "lifecycle", "push"), false);
  assert.equal(prefAllows(userData, "lifecycle", "inApp"), false);
  assert.equal(prefAllows(userData, "lifecycle", "email"), false);
  assert.equal(prefAllows(userData, "commercial", "email"), true);
});

test("an explicit channel boolean overrides the flat key for that channel only", () => {
  const userData = {
    notificationPrefs: {
      results: false,
      push: { results: true },
      email: { lifecycle: false },
    },
  };
  assert.equal(prefAllows(userData, "results", "push"), true);
  assert.equal(prefAllows(userData, "results", "inApp"), false);
  assert.equal(prefAllows(userData, "results", "email"), false);
  assert.equal(prefAllows(userData, "lifecycle", "email"), false);
  assert.equal(prefAllows(userData, "lifecycle", "push"), true);
});

test("non-boolean channel values fall through to the flat key", () => {
  const userData = {
    notificationPrefs: {
      reminders: false,
      push: { reminders: "no" },
      email: null,
    },
  };
  assert.equal(prefAllows(userData, "reminders", "push"), false);
  assert.equal(prefAllows(userData, "reminders", "email"), false);
});

test("omitting the channel reads the flat key only", () => {
  const userData = { notificationPrefs: { push: { lifecycle: false }, lifecycle: true } };
  assert.equal(prefAllows(userData, "lifecycle"), true);
  assert.equal(prefAllows(userData, "lifecycle", "push"), false);
});
