/**
 * Post-show FCM fan-out after grading (issue #275) — win + near-miss, gated on
 * `users.notificationPrefs`, idempotent via `fcm_notification_log`.
 */

const { sendWebPushToToken } = require("./fcmMessagingCore");
const { prefAllows } = require("./notificationPrefs");

const CLOSE_CALL_MAX_GAP = 2;

const MAX_POST_SHOW_SENDS_PER_INVOCATION = 400;
const MAX_TOKENS_PER_USER_PER_KIND = 5;

const LOG_COLLECTION = "fcm_notification_log";

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} showDate
 * @param {"win" | "nearMiss"} kind
 * @param {string} pickId
 */
function notificationLogDocId(showDate, kind, pickId) {
  return `${kind}_${showDate}_${pickId}`;
}

/**
 * @param {import("firebase-admin").firestore.DocumentData | null | undefined} userData
 */
function userWantsResults(userData) {
  return prefAllows(userData, "results", "push");
}

/**
 * @param {import("firebase-admin").firestore.DocumentData | null | undefined} userData
 */
function userWantsNearMiss(userData) {
  return prefAllows(userData, "nearMiss", "push");
}

/**
 * If a user has both win and near-miss hints (multiple pick docs), only win
 * messages should be sent (issue #275).
 *
 * @param {{ kind: "win" | "nearMiss", userId: string, pickId: string }[]} hints
 */
function dedupeWinOverNearMiss(hints) {
  const winUsers = new Set(
    hints.filter((h) => h.kind === "win").map((h) => h.userId)
  );
  return hints.filter(
    (h) => h.kind !== "nearMiss" || !winUsers.has(h.userId)
  );
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   showDate: string,
 *   newGlobalMax: number | null,
 *   hints: { kind: "win" | "nearMiss", userId: string, pickId: string, newScore?: number }[],
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 */
async function sendPostShowRollupPush({
  db,
  admin,
  showDate,
  newGlobalMax,
  hints,
  logger = undefined,
}) {
  if (!Array.isArray(hints) || hints.length === 0) return { sent: 0, skipped: 0 };

  const merged = dedupeWinOverNearMiss(hints);

  let sent = 0;
  let skipped = 0;

  const userCache = new Map();

  async function loadUser(uid) {
    if (userCache.has(uid)) return userCache.get(uid);
    const snap = await db.collection("users").doc(uid).get();
    const data = snap.exists ? snap.data() || {} : {};
    userCache.set(uid, data);
    return data;
  }

  async function latestTokensForUser(uid) {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("private_fcmTokens")
      .limit(MAX_TOKENS_PER_USER_PER_KIND)
      .get();
    return snap.docs
      .map((d) => {
        const t = d.data()?.token;
        return typeof t === "string" && t.trim() ? t.trim() : "";
      })
      .filter(Boolean);
  }

  for (const hint of merged) {
    if (sent >= MAX_POST_SHOW_SENDS_PER_INVOCATION) {
      logger?.warn?.("sendPostShowRollupPush: cap reached", {
        showDate,
        sent,
        cap: MAX_POST_SHOW_SENDS_PER_INVOCATION,
      });
      break;
    }

    const logId = notificationLogDocId(showDate, hint.kind, hint.pickId);
    const logRef = db.collection(LOG_COLLECTION).doc(logId);
    const existing = await logRef.get();
    if (existing.exists) {
      skipped += 1;
      continue;
    }

    const userData = await loadUser(hint.userId);
    if (hint.kind === "win" && !userWantsResults(userData)) {
      skipped += 1;
      continue;
    }
    if (hint.kind === "nearMiss" && !userWantsNearMiss(userData)) {
      skipped += 1;
      continue;
    }

    const tokens = await latestTokensForUser(hint.userId);
    if (tokens.length === 0) {
      skipped += 1;
      continue;
    }

    let anyDelivered = false;
    const title =
      hint.kind === "win"
        ? "You won the night"
        : "So close on tonight's show";
    const body =
      hint.kind === "win"
        ? `Top score for ${showDate}. Nice picks.`
        : typeof newGlobalMax === "number"
          ? `You were within ${CLOSE_CALL_MAX_GAP} of tonight's top score (${newGlobalMax}).`
          : `You were within ${CLOSE_CALL_MAX_GAP} of tonight's top score.`;

    for (const token of tokens) {
      const res = await sendWebPushToToken({
        admin,
        db,
        token,
        userId: hint.userId,
        title,
        body,
        data: {
          kind: hint.kind,
          showDate,
          pickId: hint.pickId,
        },
        logger,
      });
      if (res.ok) anyDelivered = true;
    }

    if (anyDelivered) {
      await logRef.set(
        {
          kind: hint.kind,
          showDate,
          pickId: hint.pickId,
          userId: hint.userId,
          delivered: true,
          decidedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  logger?.info?.("sendPostShowRollupPush complete", {
    showDate,
    sent,
    skipped,
    candidates: merged.length,
  });

  return { sent, skipped };
}

module.exports = {
  CLOSE_CALL_MAX_GAP,
  LOG_COLLECTION,
  dedupeWinOverNearMiss,
  notificationLogDocId,
  sendPostShowRollupPush,
};
