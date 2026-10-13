/**
 * Tour-level once-ever gate for production `tour_recap` (#1033 follow-up).
 *
 * Per-uid `fcm_notification_log` dedup is necessary but not sufficient: the 8am
 * pending scanner must not re-attempt a tour after the end-of-tour fan-out has
 * already run (or after an archive tour is explicitly closed).
 *
 * Collection: `comms_tour_recap_state/{tourId}`
 *   tourId — calendar tour key, with `/` stored as `-` so the id stays one
 *   path segment (`2026/2027 NYE Run` → `2026-2027 NYE Run`). Keys that are
 *   already a legal id are unchanged.
 *   status — `sent` | `skipped_archive` | `closed`
 *   finalDate — YYYY-MM-DD when known
 *   completedAt — server timestamp
 *   source — `cron` | `manual` | `seed` | `incident`
 */

"use strict";

const { toFirestoreDocumentId } = require("./firestoreDocId");

const TOUR_RECAP_STATE_COLLECTION = "comms_tour_recap_state";

/** Statuses that permanently block the pending cron for this tour. */
const TERMINAL_TOUR_RECAP_STATUSES = new Set([
  "sent",
  "skipped_archive",
  "closed",
]);

/**
 * @param {string} tourKey
 * @returns {string}
 */
function tourRecapStateDocId(tourKey) {
  return toFirestoreDocumentId(tourKey);
}

/**
 * @param {unknown} data
 * @returns {boolean}
 */
function isTerminalTourRecapStatus(data) {
  const status =
    data && typeof data === "object" && typeof data.status === "string"
      ? data.status.trim()
      : "";
  return TERMINAL_TOUR_RECAP_STATUSES.has(status);
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   tourKey: string,
 * }} params
 * @returns {Promise<{ exists: boolean, data: object | null, terminal: boolean }>}
 */
async function readTourRecapState({ db, tourKey }) {
  const id = tourRecapStateDocId(tourKey);
  if (!id) return { exists: false, data: null, terminal: false };
  const snap = await db.collection(TOUR_RECAP_STATE_COLLECTION).doc(id).get();
  if (!snap.exists) return { exists: false, data: null, terminal: false };
  const data = snap.data() || {};
  return { exists: true, data, terminal: isTerminalTourRecapStatus(data) };
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   tourKey: string,
 *   status: "sent" | "skipped_archive" | "closed",
 *   finalDate?: string,
 *   source?: string,
 *   extra?: Record<string, unknown>,
 * }} params
 */
async function writeTourRecapState({
  db,
  admin,
  tourKey,
  status,
  finalDate = null,
  source = "cron",
  extra = {},
}) {
  const id = tourRecapStateDocId(tourKey);
  if (!id) return null;
  const ref = db.collection(TOUR_RECAP_STATE_COLLECTION).doc(id);
  const payload = {
    tourId: id,
    status,
    finalDate: typeof finalDate === "string" && finalDate.trim() ? finalDate.trim() : null,
    source: typeof source === "string" && source.trim() ? source.trim() : "cron",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  };
  await ref.set(payload, { merge: true });
  return payload;
}

/**
 * True when a deliverCommsTrigger summary represents a completed end-of-tour
 * fan-out (at least one channel delivered to someone). Late empty cohorts do
 * not close the tour.
 *
 * @param {unknown} summary
 * @returns {boolean}
 */
function tourRecapFanoutCompleted(summary) {
  if (!summary || typeof summary !== "object") return false;
  if (summary.skipped) return false;
  const delivered = Number(summary.delivered);
  if (Number.isFinite(delivered) && delivered > 0) return true;
  const byChannel = summary.byChannel;
  if (byChannel && typeof byChannel === "object") {
    const total = ["inApp", "push", "email"].reduce(
      (n, k) => n + (Number(byChannel[k]) || 0),
      0
    );
    if (total > 0) return true;
  }
  return false;
}

module.exports = {
  TOUR_RECAP_STATE_COLLECTION,
  TERMINAL_TOUR_RECAP_STATUSES,
  tourRecapStateDocId,
  isTerminalTourRecapStatus,
  readTourRecapState,
  writeTourRecapState,
  tourRecapFanoutCompleted,
};
