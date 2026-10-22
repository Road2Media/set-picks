"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { deliverCommsInbox } = require("./commsInboxWorker");

test("inbox write keeps the dedup id and stores triggerId plus campaignId", async () => {
  /** @type {object | null} */
  let written = null;
  let docId = "";
  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {
        doc(uid) {
          assert.equal(uid, "u1");
          return {
            collection(sub) {
              assert.equal(sub, "commsInbox");
              return {
                doc(id) {
                  docId = id;
                  return {
                    async set(payload, opts) {
                      assert.equal(opts?.merge, true);
                      written = payload;
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  const admin = {
    firestore: { FieldValue: { serverTimestamp: () => "TS" } },
  };
  const result = await deliverCommsInbox({
    db,
    admin,
    uid: "u1",
    dedupId: "tour_recap:2026 Summer Tour:u1",
    triggerId: "tour_recap",
    campaignId: "2026-summer",
    rendered: {
      inApp: {
        templateId: "tour-recap",
        payload: { tour_id: "2026 Summer Tour", rank: 3 },
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.messageId, "tour_recap:2026 Summer Tour:u1");
  assert.equal(docId, "tour_recap:2026 Summer Tour:u1");
  assert.equal(written.templateId, "tour-recap");
  assert.equal(written.triggerId, "tour_recap");
  assert.equal(written.payload.tour_id, "2026 Summer Tour");
  assert.equal(written.payload.rank, 3);
  assert.equal(written.payload.campaignId, "2026-summer");
  assert.equal(written.createdAt, "TS");
});

test("inbox dry-run does not write and still returns the dedup id", async () => {
  const db = {
    collection() {
      throw new Error("dry-run must not touch Firestore");
    },
  };
  const result = await deliverCommsInbox({
    db,
    admin: {},
    uid: "u1",
    dedupId: "show_recap:u1:2026-07-18",
    triggerId: "show_recap",
    dryRun: true,
    rendered: { inApp: { templateId: "show-recap", payload: {} } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipReason, "dry_run");
  assert.equal(result.messageId, "show_recap:u1:2026-07-18");
});
