/**
 * Accepted-invite count for Pick 'em Evangelist (#1115).
 *
 * A link click is not a join. The count moves only when a new account
 * finishes setup and names an inviter. Profile invites (`/invite/:handle`)
 * and pool invites (`?from=`) both count: the person joined the game.
 * Joining a pool alone, without a new account, does not.
 *
 * The client cannot write `acceptedInviteCount` or `invitedBy`. Past joins
 * are not reconstructed.
 */

"use strict";

const { evangelistAward } = require("./badgeRankSnapshots");

/** Setup window. Older accounts are not attributed. */
const ACCEPTED_INVITE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * @param {unknown} handle
 * @returns {string}
 */
function normalizeInviteHandle(handle) {
  return String(handle ?? "")
    .trim()
    .replace(/^@+/, "")
    .slice(0, 40);
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function timestampToMs(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (value && typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value);
    if (typeof record.toDate === "function") {
      const date = record.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime();
    }
    if (typeof record.seconds === "number" && Number.isFinite(record.seconds)) {
      return record.seconds * 1000;
    }
    if (typeof record._seconds === "number" && Number.isFinite(record._seconds)) {
      return record._seconds * 1000;
    }
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * @param {{
 *   callerUid?: string | null,
 *   inviterUid?: string | null,
 *   alreadyInvitedBy?: boolean,
 *   createdAtMs?: number | null,
 *   showsPlayed?: unknown,
 *   nowMs?: number,
 *   inviterCount?: number,
 * }} input
 * @returns {{
 *   counted: boolean,
 *   reason: string,
 *   nextCount: number | null,
 * }}
 */
function planAcceptedInvite(input) {
  const callerUid = typeof input.callerUid === "string" ? input.callerUid.trim() : "";
  const inviterUid = typeof input.inviterUid === "string" ? input.inviterUid.trim() : "";
  if (!callerUid || !inviterUid) {
    return { counted: false, reason: "missing", nextCount: null };
  }
  if (callerUid === inviterUid) {
    return { counted: false, reason: "self", nextCount: null };
  }
  if (input.alreadyInvitedBy) {
    return { counted: false, reason: "already-attributed", nextCount: null };
  }
  const createdAtMs =
    typeof input.createdAtMs === "number" && Number.isFinite(input.createdAtMs)
      ? input.createdAtMs
      : null;
  const nowMs =
    typeof input.nowMs === "number" && Number.isFinite(input.nowMs)
      ? input.nowMs
      : Date.now();
  if (createdAtMs == null || nowMs - createdAtMs > ACCEPTED_INVITE_MAX_AGE_MS || nowMs < createdAtMs) {
    return { counted: false, reason: "account-not-new", nextCount: null };
  }
  const shows =
    typeof input.showsPlayed === "number" && Number.isFinite(input.showsPlayed)
      ? input.showsPlayed
      : 0;
  if (shows > 0) {
    return { counted: false, reason: "already-played", nextCount: null };
  }
  const current =
    typeof input.inviterCount === "number" && Number.isFinite(input.inviterCount)
      ? input.inviterCount
      : 0;
  return { counted: true, reason: "accepted", nextCount: current + 1 };
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} handle
 * @returns {Promise<{ uid: string, handle: string } | null>}
 */
async function findUserByHandle(db, handle) {
  const snap = await db.collection("users").where("handle", "==", handle).limit(2).get();
  if (snap.size !== 1) return null;
  const doc = snap.docs[0];
  const data = doc.data() || {};
  const stored = typeof data.handle === "string" && data.handle.trim() ? data.handle.trim() : handle;
  return { uid: doc.id, handle: stored };
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   callerUid: string,
 *   handle: unknown,
 *   now?: Date,
 * }} params
 */
async function recordAcceptedInviteForCaller({
  db,
  admin,
  callerUid,
  handle,
  now = new Date(),
}) {
  const normalized = normalizeInviteHandle(handle);
  if (!callerUid || !normalized) {
    return { ok: true, counted: false, reason: "missing-handle" };
  }

  const inviter = await findUserByHandle(db, normalized);
  if (!inviter) return { ok: true, counted: false, reason: "unknown-handle" };

  const callerRef = db.collection("users").doc(callerUid);
  const inviterRef = db.collection("users").doc(inviter.uid);
  const sourceThroughShow = now.toISOString().slice(0, 10);

  return db.runTransaction(async (tx) => {
    const callerSnap = await tx.get(callerRef);
    const inviterSnap = await tx.get(inviterRef);
    if (!callerSnap.exists || !inviterSnap.exists) {
      return { ok: true, counted: false, reason: "missing" };
    }
    const caller = callerSnap.data() || {};
    const inviterData = inviterSnap.data() || {};
    const plan = planAcceptedInvite({
      callerUid,
      inviterUid: inviter.uid,
      alreadyInvitedBy: Boolean(caller.invitedBy && typeof caller.invitedBy === "object"),
      createdAtMs: timestampToMs(caller.createdAt),
      showsPlayed: caller.showsPlayed,
      nowMs: now.getTime(),
      inviterCount: inviterData.acceptedInviteCount,
    });
    if (!plan.counted || plan.nextCount == null) {
      return { ok: true, counted: false, reason: plan.reason };
    }

    const award = evangelistAward(
      plan.nextCount,
      inviterData.badges,
      sourceThroughShow
    );
    /** @type {Record<string, unknown>} */
    const inviterPatch = {
      acceptedInviteCount: admin.firestore.FieldValue.increment(1),
    };
    if (award) {
      inviterPatch.badges = {
        [award.id]: {
          awardedAt: admin.firestore.FieldValue.serverTimestamp(),
          scope: award.scope,
          sourceThroughShow: award.sourceThroughShow,
        },
      };
    }
    tx.set(
      callerRef,
      {
        invitedBy: { uid: inviter.uid, handle: inviter.handle },
      },
      { merge: true }
    );
    tx.set(inviterRef, inviterPatch, { merge: true });
    return {
      ok: true,
      counted: true,
      reason: "accepted",
      acceptedInviteCount: plan.nextCount,
      evangelistAwarded: Boolean(award),
    };
  });
}

module.exports = {
  ACCEPTED_INVITE_MAX_AGE_MS,
  findUserByHandle,
  normalizeInviteHandle,
  planAcceptedInvite,
  recordAcceptedInviteForCaller,
  timestampToMs,
};
