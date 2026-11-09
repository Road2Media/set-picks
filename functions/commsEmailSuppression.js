/**
 * Email suppression list for comms (#442).
 *
 * Server-only collection `email_suppression/{sha256(email)}` — clients cannot
 * read or write. The email worker checks this before send; Resend webhooks and
 * the one-click unsubscribe endpoint populate it.
 */

"use strict";

const crypto = require("crypto");

const SUPPRESSION_COLLECTION = "email_suppression";

/**
 * @param {string | undefined | null} email
 * @returns {string}
 */
function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Stable Firestore doc id for an email address (avoids `@` in doc paths).
 * @param {string} email
 * @returns {string}
 */
function emailSuppressionDocId(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return "";
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function isEmailSuppressed(db, email) {
  const docId = emailSuppressionDocId(email);
  if (!docId) return false;
  const snap = await db.collection(SUPPRESSION_COLLECTION).doc(docId).get();
  return snap.exists && snap.data()?.suppressed === true;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {typeof import("firebase-admin")} admin
 * @param {{
 *   email: string,
 *   reason: string,
 *   source: string,
 *   eventId?: string | null,
 *   metadata?: Record<string, unknown>,
 * }} params
 * @returns {Promise<{ applied: boolean, docId: string, reason?: string }>}
 */
async function suppressEmail(db, admin, { email, reason, source, eventId, metadata }) {
  const normalized = normalizeEmail(email);
  const docId = emailSuppressionDocId(normalized);
  if (!docId) return { applied: false, docId: "", reason: "invalid_email" };

  const ref = db.collection(SUPPRESSION_COLLECTION).doc(docId);
  const existing = await ref.get();
  if (eventId && existing.exists && existing.data()?.lastEventId === eventId) {
    return { applied: false, docId, reason: "duplicate_event" };
  }

  await ref.set(
    {
      email: normalized,
      suppressed: true,
      reason,
      source,
      lastEventId: eventId || null,
      suppressedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    },
    { merge: true }
  );

  return { applied: true, docId };
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} email
 * @returns {Promise<Array<{ id: string, data: () => Record<string, unknown> }>>}
 */
async function findUserDocsByEmail(db, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const snap = await db.collection("users").where("email", "==", normalized).limit(20).get();
  return snap.docs;
}

/**
 * Opt a user out of lifecycle and commercial email only (#1045).
 * Push and in-app keep their own keys. A legacy flat opt-out is left as-is.
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} uid
 */
async function optOutUserEmailPrefs(db, uid) {
  if (!uid) return;
  await db.collection("users").doc(uid).set(
    {
      "notificationPrefs.email.lifecycle": false,
      "notificationPrefs.email.commercial": false,
    },
    { merge: true }
  );
}

/**
 * @param {string} uid
 * @param {string} email
 * @param {string} secret
 * @returns {string}
 */
function signUnsubscribeToken(uid, email, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${uid}:${normalizeEmail(email)}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * @param {string} uid
 * @param {string} email
 * @param {string} sig
 * @param {string} secret
 * @returns {boolean}
 */
function verifyUnsubscribeToken(uid, email, sig, secret) {
  if (!uid || !email || !sig || !secret) return false;
  const expected = signUnsubscribeToken(uid, email, secret);
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

module.exports = {
  SUPPRESSION_COLLECTION,
  normalizeEmail,
  emailSuppressionDocId,
  isEmailSuppressed,
  suppressEmail,
  findUserDocsByEmail,
  optOutUserEmailPrefs,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
};
