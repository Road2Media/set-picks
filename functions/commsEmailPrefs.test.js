"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getCommsEmailStatusForUser,
  resubscribeCommsEmailForUser,
  unsubscribeCommsEmailForUser,
  userFacingSuppressionLabel,
} = require("./commsEmailPrefs");
const { emailSuppressionDocId } = require("./commsEmailSuppression");

function fakeDb({ users = {}, suppressions = {} } = {}) {
  const userDocs = new Map(Object.entries(users));
  const suppressionDocs = new Map(Object.entries(suppressions));
  return {
    collection(name) {
      if (name === "users") {
        return {
          doc(id) {
            return {
              async get() {
                const data = userDocs.get(id);
                return { exists: userDocs.has(id), data: () => data };
              },
              async set(data, opts) {
                const prev = userDocs.get(id) || {};
                userDocs.set(id, opts?.merge ? { ...prev, ...data } : data);
              },
            };
          },
        };
      }
      if (name === "email_suppression") {
        return {
          doc(id) {
            return {
              async get() {
                const data = suppressionDocs.get(id);
                return { exists: suppressionDocs.has(id), data: () => data };
              },
              async delete() {
                suppressionDocs.delete(id);
              },
              async set(data, opts) {
                const prev = suppressionDocs.get(id) || {};
                suppressionDocs.set(id, opts?.merge ? { ...prev, ...data } : data);
              },
            };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    _userDocs: userDocs,
    _suppressionDocs: suppressionDocs,
  };
}

const fakeAdmin = {
  firestore: { FieldValue: { serverTimestamp: () => ({ __ts: true }) } },
};

test("userFacingSuppressionLabel maps known reasons", () => {
  assert.match(userFacingSuppressionLabel("one_click_unsubscribe"), /unsubscribed/i);
  assert.match(userFacingSuppressionLabel("mailto_unsubscribe"), /unsubscribed/i);
  assert.match(userFacingSuppressionLabel("hard_bounce"), /delivered/i);
});

test("getCommsEmailStatusForUser reports not suppressed when no doc exists", async () => {
  const db = fakeDb({
    users: {
      u1: { email: "picker@example.com", notificationPrefs: { lifecycle: true } },
    },
  });
  const status = await getCommsEmailStatusForUser(db, "u1");
  assert.equal(status.suppressed, false);
  assert.equal(status.hasEmail, true);
  assert.equal(status.lifecycleEnabled, true);
});

test("getCommsEmailStatusForUser reports one-click suppression as resubscribable", async () => {
  const email = "picker@example.com";
  const docId = emailSuppressionDocId(email);
  const db = fakeDb({
    users: { u1: { email, notificationPrefs: { lifecycle: false } } },
    suppressions: {
      [docId]: { suppressed: true, reason: "one_click_unsubscribe" },
    },
  });
  const status = await getCommsEmailStatusForUser(db, "u1");
  assert.equal(status.suppressed, true);
  assert.equal(status.canResubscribe, true);
  assert.match(status.message, /unsubscribed/i);
});

test("getCommsEmailStatusForUser treats hard bounce as not resubscribable", async () => {
  const email = "bad@example.com";
  const docId = emailSuppressionDocId(email);
  const db = fakeDb({
    users: { u1: { email } },
    suppressions: {
      [docId]: { suppressed: true, reason: "hard_bounce" },
    },
  });
  const status = await getCommsEmailStatusForUser(db, "u1");
  assert.equal(status.canResubscribe, false);
});

test("resubscribeCommsEmailForUser clears a one-click suppression and re-enables lifecycle", async () => {
  const email = "picker@example.com";
  const docId = emailSuppressionDocId(email);
  const db = fakeDb({
    users: { u1: { email, notificationPrefs: { lifecycle: false } } },
    suppressions: {
      [docId]: { suppressed: true, reason: "one_click_unsubscribe" },
    },
  });
  const result = await resubscribeCommsEmailForUser(db, fakeAdmin, "u1");
  assert.equal(result.ok, true);
  assert.equal(db._suppressionDocs.has(docId), false);
  assert.equal(db._userDocs.get("u1")["notificationPrefs.email.lifecycle"], true);
});

test("unsubscribeCommsEmailForUser writes suppression and opts out lifecycle prefs", async () => {
  const db = fakeDb({
    users: { u1: { email: "picker@example.com", notificationPrefs: { lifecycle: true } } },
  });
  const result = await unsubscribeCommsEmailForUser(db, fakeAdmin, "u1");
  assert.equal(result.ok, true);
  const docId = emailSuppressionDocId("picker@example.com");
  assert.equal(db._suppressionDocs.get(docId).reason, "user_preferences");
  assert.equal(db._userDocs.get("u1")["notificationPrefs.email.lifecycle"], false);
  assert.equal(db._userDocs.get("u1")["notificationPrefs.email.commercial"], false);
  assert.equal(db._userDocs.get("u1")["notificationPrefs.lifecycle"], undefined);
});
