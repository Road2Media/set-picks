/**
 * Signed-in email subscription status + self-serve subscribe/unsubscribe (#455).
 *
 * Clients cannot read `email_suppression` directly (server-only collection).
 * These helpers back authenticated callables used by `/dashboard/profile/account`.
 */

"use strict";

const {
  SUPPRESSION_COLLECTION,
  normalizeEmail,
  emailSuppressionDocId,
  suppressEmail,
  optOutUserEmailPrefs,
} = require("./commsEmailSuppression");
const { prefAllows } = require("./notificationPrefs");

/** Reasons a user may clear via the Notifications screen (not deliverability blocks). */
const RESUBSCRIBABLE_REASONS = new Set([
  "one_click_unsubscribe",
  "mailto_unsubscribe",
  "user_preferences",
]);

/**
 * @param {string | null | undefined} reason
 * @returns {string | null}
 */
function userFacingSuppressionLabel(reason) {
  switch (reason) {
    case "one_click_unsubscribe":
    case "mailto_unsubscribe":
    case "user_preferences":
      return "You unsubscribed from email updates.";
    case "hard_bounce":
      return "Email is paused because messages to this address could not be delivered.";
    case "spam_complaint":
      return "Email is paused after a spam report was received for this address.";
    case "resend_suppressed":
      return "Email is paused by our delivery provider for this address.";
    default:
      return reason ? "Email is paused for this address." : null;
  }
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} uid
 * @returns {Promise<{
 *   ok: boolean,
 *   hasEmail: boolean,
 *   suppressed: boolean,
 *   reason: string | null,
 *   canResubscribe: boolean,
 *   message: string | null,
 *   lifecycleEnabled: boolean,
 * }>}
 */
async function getCommsEmailStatusForUser(db, uid) {
  if (!uid) return { ok: false, hasEmail: false, suppressed: false, reason: null, canResubscribe: false, message: null, lifecycleEnabled: true };

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return {
      ok: true,
      hasEmail: false,
      suppressed: false,
      reason: null,
      canResubscribe: false,
      message: "Add an email address to your account to receive updates.",
      lifecycleEnabled: true,
    };
  }

  const userData = userSnap.data() || {};
  const email = normalizeEmail(userData.email);
  const lifecycleEnabled = prefAllows(userData, "lifecycle", "email");

  if (!email) {
    return {
      ok: true,
      hasEmail: false,
      suppressed: false,
      reason: null,
      canResubscribe: false,
      message: "Add an email address to your account to receive updates.",
      lifecycleEnabled,
    };
  }

  const docId = emailSuppressionDocId(email);
  const snap = await db.collection(SUPPRESSION_COLLECTION).doc(docId).get();
  const suppressed = snap.exists && snap.data()?.suppressed === true;
  const reason = suppressed ? String(snap.data()?.reason || "unknown") : null;
  const canResubscribe = suppressed && RESUBSCRIBABLE_REASONS.has(reason);

  return {
    ok: true,
    hasEmail: true,
    suppressed,
    reason,
    canResubscribe,
    message: suppressed ? userFacingSuppressionLabel(reason) : null,
    lifecycleEnabled,
  };
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {typeof import("firebase-admin")} admin
 * @param {string} uid
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function resubscribeCommsEmailForUser(db, admin, uid) {
  const status = await getCommsEmailStatusForUser(db, uid);
  if (!status.hasEmail) return { ok: false, reason: "no_email" };
  if (!status.suppressed) return { ok: true };
  if (!status.canResubscribe) return { ok: false, reason: "not_resubscribable" };

  const userSnap = await db.collection("users").doc(uid).get();
  const email = normalizeEmail(userSnap.data()?.email);
  const docId = emailSuppressionDocId(email);
  if (!docId) return { ok: false, reason: "invalid_email" };

  await db.collection(SUPPRESSION_COLLECTION).doc(docId).delete();
  await db.collection("users").doc(uid).set(
    {
      "notificationPrefs.email.lifecycle": true,
    },
    { merge: true }
  );

  return { ok: true };
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {typeof import("firebase-admin")} admin
 * @param {string} uid
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function unsubscribeCommsEmailForUser(db, admin, uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return { ok: false, reason: "no_user" };
  const email = normalizeEmail(userSnap.data()?.email);
  if (!email) return { ok: false, reason: "no_email" };

  await suppressEmail(db, admin, {
    email,
    reason: "user_preferences",
    source: "notifications_preferences",
    eventId: null,
  });
  await optOutUserEmailPrefs(db, uid);
  return { ok: true };
}

module.exports = {
  RESUBSCRIBABLE_REASONS,
  userFacingSuppressionLabel,
  getCommsEmailStatusForUser,
  resubscribeCommsEmailForUser,
  unsubscribeCommsEmailForUser,
};
