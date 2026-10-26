"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACCEPTED_INVITE_MAX_AGE_MS,
  planAcceptedInvite,
  recordAcceptedInviteForCaller,
} = require("./acceptedInvites");

const NOW = Date.parse("2026-10-22T16:00:00.000Z");

test("planAcceptedInvite: a click is not a join, and a finished signup counts once", () => {
  assert.equal(planAcceptedInvite({ callerUid: "", inviterUid: "a" }).counted, false);

  const accepted = planAcceptedInvite({
    callerUid: "new",
    inviterUid: "host",
    createdAtMs: NOW - 60_000,
    showsPlayed: 0,
    nowMs: NOW,
    inviterCount: 4,
  });
  assert.equal(accepted.counted, true);
  assert.equal(accepted.nextCount, 5);

  assert.equal(
    planAcceptedInvite({
      callerUid: "new",
      inviterUid: "new",
      createdAtMs: NOW,
      nowMs: NOW,
    }).reason,
    "self"
  );
  assert.equal(
    planAcceptedInvite({
      callerUid: "new",
      inviterUid: "host",
      alreadyInvitedBy: true,
      createdAtMs: NOW,
      nowMs: NOW,
    }).reason,
    "already-attributed"
  );
  assert.equal(
    planAcceptedInvite({
      callerUid: "new",
      inviterUid: "host",
      createdAtMs: NOW - ACCEPTED_INVITE_MAX_AGE_MS - 1,
      nowMs: NOW,
    }).reason,
    "account-not-new"
  );
  assert.equal(
    planAcceptedInvite({
      callerUid: "new",
      inviterUid: "host",
      createdAtMs: NOW,
      showsPlayed: 2,
      nowMs: NOW,
    }).reason,
    "already-played"
  );
});

test("recordAcceptedInviteForCaller: increments once and awards evangelist at 5", async () => {
  const users = new Map([
    [
      "new",
      {
        handle: "Newbie",
        createdAt: { seconds: Math.floor((NOW - 1000) / 1000) },
        showsPlayed: 0,
      },
    ],
    ["host", { handle: "Mikey", acceptedInviteCount: 4, badges: {} }],
  ]);

  const admin = {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TS",
        increment: (n) => ({ increment: n }),
      },
    },
  };

  function userRef(uid) {
    return {
      id: uid,
      async get() {
        const data = users.get(uid);
        return { exists: Boolean(data), id: uid, data: () => data || {} };
      },
    };
  }

  const db = {
    collection() {
      return {
        doc: (uid) => userRef(uid),
        where() {
          return {
            limit() {
              return {
                async get() {
                  return {
                    size: 1,
                    docs: [
                      {
                        id: "host",
                        data: () => users.get("host"),
                      },
                    ],
                  };
                },
              };
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return ref.get();
        },
        set(ref, patch) {
          const current = users.get(ref.id) || {};
          const next = { ...current };
          if (patch.invitedBy) next.invitedBy = patch.invitedBy;
          if (patch.acceptedInviteCount && patch.acceptedInviteCount.increment) {
            next.acceptedInviteCount =
              (current.acceptedInviteCount || 0) + patch.acceptedInviteCount.increment;
          }
          if (patch.badges) next.badges = { ...(current.badges || {}), ...patch.badges };
          users.set(ref.id, next);
        },
      };
      return fn(tx);
    },
  };

  const first = await recordAcceptedInviteForCaller({
    db,
    admin,
    callerUid: "new",
    handle: "@Mikey",
    now: new Date(NOW),
  });
  assert.equal(first.counted, true);
  assert.equal(first.acceptedInviteCount, 5);
  assert.equal(first.evangelistAwarded, true);
  assert.equal(users.get("host").acceptedInviteCount, 5);
  assert.equal(users.get("host").badges.pickem_evangelist.awardedAt, "SERVER_TS");
  assert.deepEqual(users.get("new").invitedBy, { uid: "host", handle: "Mikey" });

  const again = await recordAcceptedInviteForCaller({
    db,
    admin,
    callerUid: "new",
    handle: "Mikey",
    now: new Date(NOW),
  });
  assert.equal(again.counted, false);
  assert.equal(again.reason, "already-attributed");
  assert.equal(users.get("host").acceptedInviteCount, 5);
  assert.equal(users.get("host").badges.pickem_evangelist.awardedAt, "SERVER_TS");
});
