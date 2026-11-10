"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { stampBandId } = require("./bandScope");

/** Must match client copy in `DeleteAccountSection.jsx`. */
const DELETE_ACCOUNT_CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

const MAX_BATCH = 500;

/**
 * @param {unknown} data — `request.data` from callable
 */
function validateDeletionRequest(data) {
  const acknowledged = data?.acknowledgedPermanentDeletion === true;
  if (!acknowledged) {
    throw new HttpsError(
      "invalid-argument",
      "Confirm that you understand account deletion is permanent."
    );
  }
  const phrase =
    typeof data?.confirmationPhrase === "string"
      ? data.confirmationPhrase.trim()
      : "";
  if (phrase !== DELETE_ACCOUNT_CONFIRMATION_PHRASE) {
    throw new HttpsError(
      "invalid-argument",
      `Type "${DELETE_ACCOUNT_CONFIRMATION_PHRASE}" exactly to confirm.`
    );
  }
}

/**
 * Self-serve account deletion: pool membership cleanup, picks, user subcollections,
 * audit doc, user profile doc, then Auth record (caller must match uid).
 *
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   callerUid: string,
 *   requestData: unknown,
 * }} ctx
 * @returns {Promise<{ ok: true, reportId: string, picksDeleted: number, poolsUpdated: number }>}
 */
async function runAccountDeletionForCaller({
  db,
  admin,
  callerUid,
  requestData,
}) {
  validateDeletionRequest(requestData);

  const owned = await db
    .collection("pools")
    .where("ownerId", "==", callerUid)
    .limit(1)
    .get();
  if (!owned.empty) {
    throw new HttpsError(
      "failed-precondition",
      "You still own one or more pools. Delete each pool from its admin settings first, then try again."
    );
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUser(callerUid);
  } catch (e) {
    logger.error("deleteAccount: auth getUser failed", { callerUid, err: e });
    throw new HttpsError("not-found", "Account not found.");
  }

  const userRef = db.collection("users").doc(callerUid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  const memberPoolsSnap = await db
    .collection("pools")
    .where("members", "array-contains", callerUid)
    .get();

  const poolIdsTouched = memberPoolsSnap.docs.map((d) => d.id);

  let batch = db.batch();
  let opCount = 0;
  let poolsUpdated = 0;

  for (const poolDoc of memberPoolsSnap.docs) {
    if (opCount >= MAX_BATCH) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
    const poolData = poolDoc.data() || {};
    batch.update(poolDoc.ref, stampBandId({
      members: admin.firestore.FieldValue.arrayRemove(callerUid),
      bandId: poolData.bandId,
    }));
    opCount += 1;
    poolsUpdated += 1;
  }
  if (opCount > 0) {
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  }

  let picksDeleted = 0;
  for (;;) {
    const picksSnap = await db
      .collection("picks")
      .where("userId", "==", callerUid)
      .limit(MAX_BATCH)
      .get();
    if (picksSnap.empty) break;

    const delBatch = db.batch();
    for (const p of picksSnap.docs) {
      delBatch.delete(p.ref);
    }
    await delBatch.commit();
    picksDeleted += picksSnap.size;
    if (picksSnap.size < MAX_BATCH) break;
  }

  for (const sub of ["private_fcmTokens", "commsInbox"]) {
    for (;;) {
      const subSnap = await userRef.collection(sub).limit(MAX_BATCH).get();
      if (subSnap.empty) break;
      const subBatch = db.batch();
      for (const d of subSnap.docs) {
        subBatch.delete(d.ref);
      }
      await subBatch.commit();
      if (subSnap.size < MAX_BATCH) break;
    }
  }

  const reportRef = db.collection("account_deletion_reports").doc();
  const providerIds = Array.isArray(userRecord.providerData)
    ? userRecord.providerData
        .map((p) => (typeof p?.providerId === "string" ? p.providerId : ""))
        .filter(Boolean)
    : [];

  await reportRef.set({
    uid: callerUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    email: userRecord.email || null,
    emailVerified: userRecord.emailVerified === true,
    handle: typeof userData.handle === "string" ? userData.handle : null,
    displayName:
      typeof userRecord.displayName === "string" ? userRecord.displayName : null,
    providerIds,
    poolIdsMemberRemovedFrom: poolIdsTouched,
    picksDeleted,
    poolsUpdated,
    source: "profile-self-serve",
    termsPath: "docs/TERMS_OF_SERVICE.md",
  });

  await userRef.delete();

  try {
    await admin.auth().deleteUser(callerUid);
  } catch (e) {
    logger.error("deleteAccount: auth deleteUser failed after Firestore cleanup", {
      callerUid,
      reportId: reportRef.id,
      err: e,
    });
    throw new HttpsError(
      "internal",
      "Account data was removed but sign-in could not be finalized. Contact support."
    );
  }

  logger.info("deleteAccountWithAudit complete", {
    uid: callerUid,
    reportId: reportRef.id,
    picksDeleted,
    poolsUpdated,
  });

  return {
    ok: true,
    reportId: reportRef.id,
    picksDeleted,
    poolsUpdated,
  };
}

module.exports = {
  DELETE_ACCOUNT_CONFIRMATION_PHRASE,
  validateDeletionRequest,
  runAccountDeletionForCaller,
};
