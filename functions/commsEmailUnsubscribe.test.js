"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOneClickUnsubscribeUrl,
  processOneClickUnsubscribe,
  verifyOneClickUnsubscribeToken,
  renderUnsubscribeConfirmPage,
  renderUnsubscribeSuccessPage,
  resolveUnsubscribeBaseUrl,
  DEFAULT_UNSUBSCRIBE_BASE_URL,
} = require("./commsEmailUnsubscribe");
const { signUnsubscribeToken, isEmailSuppressed } = require("./commsEmailSuppression");

const SECRET = "test-signing-secret";
const UID = "u1";
const EMAIL = "picker@example.com";

function fakeDb() {
  const docs = new Map();
  const users = new Map();
  return {
    collection(name) {
      if (name === "users") {
        return {
          doc(id) {
            return {
              async set(data, opts) {
                const prev = users.get(id) || {};
                users.set(id, opts?.merge ? { ...prev, ...data } : data);
              },
              async get() {
                return { exists: users.has(id), data: () => users.get(id) };
              },
            };
          },
        };
      }
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async get() {
              return { exists: docs.has(key), data: () => docs.get(key) };
            },
            async set(data, opts) {
              const prev = docs.get(key) || {};
              docs.set(key, opts?.merge ? { ...prev, ...data } : data);
            },
          };
        },
      };
    },
    _docs: docs,
    _users: users,
  };
}

const fakeAdmin = {
  firestore: { FieldValue: { serverTimestamp: () => ({ __ts: true }) } },
};

test("buildOneClickUnsubscribeUrl signs uid + email into the query string", () => {
  const url = buildOneClickUnsubscribeUrl("https://www.setlistpickem.com", {
    uid: UID,
    email: EMAIL,
    signingSecret: SECRET,
  });
  const expectedSig = signUnsubscribeToken(UID, EMAIL, SECRET);
  assert.match(url, new RegExp(`^${DEFAULT_UNSUBSCRIBE_BASE_URL}\\?`));
  assert.match(url, /uid=u1/);
  assert.match(url, new RegExp(`email=${encodeURIComponent(EMAIL)}`));
  assert.match(url, new RegExp(`sig=${expectedSig}`));
});

test("buildOneClickUnsubscribeUrl falls back to the notifications settings page when unsigned", () => {
  const url = buildOneClickUnsubscribeUrl("https://www.setlistpickem.com", {
    uid: "",
    email: "",
    signingSecret: "",
  });
  assert.equal(url, "https://www.setlistpickem.com/dashboard/profile/account");
});

test("resolveUnsubscribeBaseUrl honors COMMS_UNSUBSCRIBE_BASE_URL override", () => {
  const prev = process.env.COMMS_UNSUBSCRIBE_BASE_URL;
  process.env.COMMS_UNSUBSCRIBE_BASE_URL = "https://example.test/unsub/";
  try {
    assert.equal(resolveUnsubscribeBaseUrl(), "https://example.test/unsub");
  } finally {
    if (prev === undefined) delete process.env.COMMS_UNSUBSCRIBE_BASE_URL;
    else process.env.COMMS_UNSUBSCRIBE_BASE_URL = prev;
  }
});

test("processOneClickUnsubscribe suppresses + opts out prefs on a valid signature", async () => {
  const db = fakeDb();
  const sig = signUnsubscribeToken(UID, EMAIL, SECRET);
  const result = await processOneClickUnsubscribe({
    db,
    admin: fakeAdmin,
    uid: UID,
    email: EMAIL,
    sig,
    signingSecret: SECRET,
  });
  assert.equal(result.ok, true);
  assert.equal(await isEmailSuppressed(db, EMAIL), true);
  assert.equal(db._users.get(UID)["notificationPrefs.email.lifecycle"], false);
  assert.equal(db._users.get(UID)["notificationPrefs.email.commercial"], false);
  assert.equal(db._users.get(UID)["notificationPrefs.lifecycle"], undefined);
});

test("processOneClickUnsubscribe rejects a tampered signature", async () => {
  const db = fakeDb();
  const result = await processOneClickUnsubscribe({
    db,
    admin: fakeAdmin,
    uid: UID,
    email: EMAIL,
    sig: "not-the-real-signature",
    signingSecret: SECRET,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_token");
  assert.equal(await isEmailSuppressed(db, EMAIL), false);
});

test("processOneClickUnsubscribe rejects a signature minted for a different uid/email", async () => {
  const db = fakeDb();
  const sig = signUnsubscribeToken("someone-else", EMAIL, SECRET);
  const result = await processOneClickUnsubscribe({
    db,
    admin: fakeAdmin,
    uid: UID,
    email: EMAIL,
    sig,
    signingSecret: SECRET,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_token");
});

test("processOneClickUnsubscribe rejects missing uid or email", async () => {
  const db = fakeDb();
  const sig = signUnsubscribeToken(UID, EMAIL, SECRET);
  assert.equal(
    (await processOneClickUnsubscribe({ db, admin: fakeAdmin, uid: "", email: EMAIL, sig, signingSecret: SECRET })).ok,
    false
  );
  assert.equal(
    (await processOneClickUnsubscribe({ db, admin: fakeAdmin, uid: UID, email: "", sig, signingSecret: SECRET })).ok,
    false
  );
});

test("verifyOneClickUnsubscribeToken matches a valid token and does not mutate state", () => {
  const sig = signUnsubscribeToken(UID, EMAIL, SECRET);
  assert.equal(
    verifyOneClickUnsubscribeToken({ uid: UID, email: EMAIL, sig, signingSecret: SECRET }),
    true
  );
});

test("verifyOneClickUnsubscribeToken rejects tampering", () => {
  const sig = signUnsubscribeToken(UID, EMAIL, SECRET);
  assert.equal(
    verifyOneClickUnsubscribeToken({ uid: UID, email: "other@example.com", sig, signingSecret: SECRET }),
    false
  );
  assert.equal(
    verifyOneClickUnsubscribeToken({ uid: UID, email: EMAIL, sig: "garbage", signingSecret: SECRET }),
    false
  );
});

test("renderUnsubscribeConfirmPage requires a real POST form submit, not a bare link", () => {
  const sig = signUnsubscribeToken(UID, EMAIL, SECRET);
  const html = renderUnsubscribeConfirmPage({ uid: UID, email: EMAIL, sig });
  assert.match(html, /<form method="POST"/);
  assert.match(html, new RegExp(`uid=${UID}`));
  assert.match(html, new RegExp(`email=${encodeURIComponent(EMAIL)}`));
  assert.match(html, new RegExp(`sig=${sig}`));
});

test("renderUnsubscribeSuccessPage returns a confirmation message", () => {
  assert.match(renderUnsubscribeSuccessPage(), /unsubscribed/i);
});
