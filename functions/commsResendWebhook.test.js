"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("./commsEmailTags.test.js");

const { Webhook } = require("svix");
const {
  handleResendWebhookEvent,
  extractRecipientEmails,
  verifyResendWebhookPayload,
} = require("./commsResendWebhook");

const webhookSecret =
  "whsec_" + Buffer.from("test-secret-key-32bytes-pad!!").toString("base64");

function signedResendHeaders(rawBody, { id = "msg_svix_2", secret = webhookSecret } = {}) {
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, rawBody);
  return {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

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
            };
          },
          where(field, op, value) {
            return {
              limit() {
                return {
                  async get() {
                    const matches = [];
                    for (const [id, data] of users.entries()) {
                      if (data[field] === value) {
                        matches.push({ id, data: () => data });
                      }
                    }
                    return { docs: matches };
                  },
                };
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
  firestore: {
    FieldValue: {
      serverTimestamp: () => ({ __ts: true }),
    },
  },
};

test("extractRecipientEmails normalizes array payload", () => {
  assert.deepEqual(
    extractRecipientEmails({ data: { to: ["A@Example.com"] } }),
    ["a@example.com"]
  );
});

test("permanent bounce suppresses email", async () => {
  const db = fakeDb();
  const result = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "msg_1",
    event: {
      type: "email.bounced",
      data: {
        to: ["bad@example.com"],
        bounce: { type: "Permanent", subType: "Suppressed" },
      },
    },
  });
  assert.equal(result.handled, true);
  assert.equal(result.results[0].applied, true);
  const { isEmailSuppressed } = require("./commsEmailSuppression");
  assert.equal(await isEmailSuppressed(db, "bad@example.com"), true);
});

test("temporary bounce is ignored", async () => {
  const db = fakeDb();
  const result = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "msg_2",
    event: {
      type: "email.bounced",
      data: {
        to: ["soft@example.com"],
        bounce: { type: "Temporary" },
      },
    },
  });
  assert.equal(result.handled, false);
  assert.equal(result.reason, "temporary_bounce_ignored");
});

test("spam complaint suppresses and opts user out", async () => {
  const db = fakeDb();
  db._users.set("u1", { email: "spam@example.com", notificationPrefs: { lifecycle: true } });
  const result = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "msg_3",
    event: {
      type: "email.complained",
      data: { to: ["spam@example.com"] },
    },
  });
  assert.equal(result.handled, true);
  const { isEmailSuppressed } = require("./commsEmailSuppression");
  assert.equal(await isEmailSuppressed(db, "spam@example.com"), true);
  assert.equal(db._users.get("u1")["notificationPrefs.lifecycle"], false);
});

test("email.opened persists engagement from tags; duplicate delivery is a no-op", async () => {
  const db = fakeDb();
  const opened = {
    type: "email.opened",
    data: {
      email_id: "re_open_1",
      to: ["picker@example.com"],
      tags: {
        uid: "u42",
        triggerId: "marketing_summer_tour_2026_launch",
        campaignId: "summer_tour_2026",
      },
    },
  };

  const first = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "svix_open_1",
    event: opened,
  });
  assert.equal(first.handled, true);
  assert.equal(first.applied, true);
  assert.equal(first.uid, "u42");
  assert.equal(first.triggerId, "marketing_summer_tour_2026_launch");
  assert.equal(first.campaignId, "summer_tour_2026");

  const stored = db._docs.get("comms_email_engagement/re_open_1");
  assert.equal(stored.uid, "u42");
  assert.equal(stored.triggerId, "marketing_summer_tour_2026_launch");
  assert.equal(stored.campaignId, "summer_tour_2026");
  assert.deepEqual(stored.openedAt, { __ts: true });
  assert.equal(stored.clickedAt, undefined);

  const dup = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "svix_open_1_retry",
    event: opened,
  });
  assert.equal(dup.handled, true);
  assert.equal(dup.applied, false);
  assert.equal(dup.reason, "duplicate_event");
  assert.equal(db._docs.get("comms_email_engagement/re_open_1").openedEventId, "svix_open_1");
});

test("email.clicked after open stamps clickedAt; duplicate click is a no-op", async () => {
  const db = fakeDb();
  const tags = {
    uid: "u9",
    triggerId: "show_recap",
    campaignId: "summer_tour_2026",
  };
  const opened = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "svix_o",
    event: {
      type: "email.opened",
      data: { email_id: "re_click_1", to: ["fan@example.com"], tags },
    },
  });
  assert.equal(opened.applied, true);

  const clicked = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "svix_c",
    event: {
      type: "email.clicked",
      data: { email_id: "re_click_1", to: ["fan@example.com"], tags },
    },
  });
  assert.equal(clicked.applied, true);
  assert.equal(clicked.type, "email.clicked");

  const stored = db._docs.get("comms_email_engagement/re_click_1");
  assert.deepEqual(stored.openedAt, { __ts: true });
  assert.deepEqual(stored.clickedAt, { __ts: true });
  assert.equal(stored.clickedEventId, "svix_c");

  const dupClick = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "svix_c_retry",
    event: {
      type: "email.clicked",
      data: { email_id: "re_click_1", to: ["fan@example.com"], tags },
    },
  });
  assert.equal(dupClick.applied, false);
  assert.equal(dupClick.reason, "duplicate_event");
  assert.equal(db._docs.get("comms_email_engagement/re_click_1").clickedEventId, "svix_c");
});

test("email.clicked before open still stamps openedAt (out-of-order webhook)", async () => {
  const db = fakeDb();
  const result = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "svix_click_first",
    event: {
      type: "email.clicked",
      data: {
        email_id: "re_ooo",
        to: ["fan@example.com"],
        tags: [{ name: "uid", value: "u7" }, { name: "triggerId", value: "show_recap" }],
      },
    },
  });
  assert.equal(result.applied, true);
  const stored = db._docs.get("comms_email_engagement/re_ooo");
  assert.equal(stored.uid, "u7");
  assert.deepEqual(stored.openedAt, { __ts: true });
  assert.deepEqual(stored.clickedAt, { __ts: true });
});

test("open without tags falls back to a unique user email match", async () => {
  const db = fakeDb();
  db._users.set("legacy_uid", { email: "legacy@example.com" });
  const result = await handleResendWebhookEvent({
    db,
    admin: fakeAdmin,
    eventId: "svix_legacy",
    event: {
      type: "email.opened",
      data: { email_id: "re_legacy", to: ["legacy@example.com"] },
    },
  });
  assert.equal(result.applied, true);
  assert.equal(result.uid, "legacy_uid");
  assert.equal(db._docs.get("comms_email_engagement/re_legacy").uid, "legacy_uid");
});

test("verifyResendWebhookPayload returns the parsed event after svix 2 verification", () => {
  const event = {
    type: "email.opened",
    data: { email_id: "re_1", to: ["fan@example.com"] },
  };
  const rawBody = JSON.stringify(event);
  const parsed = verifyResendWebhookPayload(rawBody, signedResendHeaders(rawBody), webhookSecret);
  assert.deepEqual(parsed, event);
});

test("verifyResendWebhookPayload rejects a bad signature", () => {
  const rawBody = JSON.stringify({ type: "email.opened", data: { email_id: "re_bad" } });
  assert.throws(() =>
    verifyResendWebhookPayload(
      rawBody,
      {
        "svix-id": "msg_bad",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "v1,not-a-real-signature",
      },
      webhookSecret
    )
  );
});

test("verifyResendWebhookPayload rejects a missing secret", () => {
  assert.throws(
    () => verifyResendWebhookPayload("{}", { "svix-id": "msg" }, ""),
    /missing_webhook_secret/
  );
});

test("engagement event without email_id is ignored", async () => {
  const result = await handleResendWebhookEvent({
    db: fakeDb(),
    admin: fakeAdmin,
    event: { type: "email.opened", data: { to: ["x@example.com"], tags: { uid: "u1" } } },
  });
  assert.equal(result.handled, false);
  assert.equal(result.reason, "missing_email_id");
});
