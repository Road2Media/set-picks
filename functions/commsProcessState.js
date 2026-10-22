/**
 * Process-level once-ever gate (#1035).
 *
 * Per-uid `fcm_notification_log` is channel idempotency. This collection is
 * the process gate: one doc per completed moment, read before a scanner
 * builds recipients, so email + push + in-app share one decision.
 *
 * Collection: `comms_process_state/{processId}`
 *   processId — `{triggerId}:{scope}` with `/` stored as `-`
 *     (`tour_recap:2026 Summer Tour`, `show_recap:2026-05-02`)
 *   status — `sent` | `skipped_archive` | `closed`
 *   triggerId — catalog id
 *   scope — tour key or show date
 *   supersedes — prior trigger ids / template ids that already counted
 *   completedAt / source — same contract as the tour_recap containment seed
 *
 * `tour_recap` also mirrors `comms_tour_recap_state/{tourId}` (the #1034
 * seed). Reads treat a terminal legacy doc as terminal so that seed keeps
 * blocking without a second gate. Writes update both stores together.
 */

"use strict";

const { toFirestoreDocumentId } = require("./firestoreDocId");
const {
  readTourRecapState,
  writeTourRecapState,
} = require("./tourRecapState");

const PROCESS_STATE_COLLECTION = "comms_process_state";

const TERMINAL_PROCESS_STATUSES = new Set([
  "sent",
  "skipped_archive",
  "closed",
]);

/**
 * Tours that already had a one-time wrap, or must stay archive-closed.
 * Shared by `functions/scripts/seedCommsProcessState.js`.
 *
 * @type {Array<{
 *   triggerId: string,
 *   scope: string,
 *   status: "sent" | "skipped_archive" | "closed",
 *   finalDate: string,
 *   source: string,
 *   supersedes: string[],
 *   note: string,
 * }>}
 */
const TOUR_RECAP_PROCESS_SEEDS = [
  {
    triggerId: "tour_recap",
    scope: "2026 Summer Tour",
    status: "sent",
    finalDate: "2026-09-06",
    source: "seed",
    supersedes: [],
    note: "Manual live fan-out 2026-09-08 (32 cohort)",
  },
  {
    triggerId: "tour_recap",
    scope: "2026 Sphere",
    status: "skipped_archive",
    finalDate: "2026-05-02",
    source: "incident",
    supersedes: ["sphere-2026-inaugural"],
    note: "Archive edition; erroneous cron blast 2026-09-09 closed via state",
  },
];

/**
 * @param {string} triggerId
 * @param {string} scope
 * @returns {string}
 */
function processDocId(triggerId, scope) {
  const trigger = String(triggerId || "").trim();
  const scopeId = toFirestoreDocumentId(scope);
  if (!trigger || !scopeId) return "";
  return toFirestoreDocumentId(`${trigger}:${scopeId}`);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeSupersedes(value) {
  if (!Array.isArray(value)) return [];
  /** @type {string[]} */
  const out = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * @param {unknown} data
 * @returns {boolean}
 */
function isTerminalProcessStatus(data) {
  const status =
    data && typeof data === "object" && typeof data.status === "string"
      ? data.status.trim()
      : "";
  return TERMINAL_PROCESS_STATUSES.has(status);
}

/**
 * Why an automated scanner must not build recipients.
 * `sent` on a related tour process does not block night `show_recap`
 * (per-uid dedup is the retry lock for a live edition).
 *
 * @param {{
 *   editionStatus?: string | null,
 *   processTerminal?: boolean,
 *   relatedStatus?: string | null,
 * }} params
 * @returns {"process_terminal" | "edition_status" | "tour_process" | null}
 */
function automatedFanoutBlock({
  editionStatus = null,
  processTerminal = false,
  relatedStatus = null,
} = {}) {
  if (processTerminal) return "process_terminal";
  if (editionStatus === "archive" || editionStatus === "closed") return "edition_status";
  if (relatedStatus === "skipped_archive" || relatedStatus === "closed") return "tour_process";
  return null;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} collectionName
 * @param {string} id
 */
async function readStateDoc(db, collectionName, id) {
  if (!id) return { exists: false, data: null, terminal: false };
  const snap = await db.collection(collectionName).doc(id).get();
  if (!snap.exists) return { exists: false, data: null, terminal: false };
  const data = snap.data() || {};
  return { exists: true, data, terminal: isTerminalProcessStatus(data) };
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   triggerId: string,
 *   scope: string,
 *   supersedes?: string[],
 * }} params
 */
async function readProcessState({ db, triggerId, scope, supersedes = [] }) {
  const processId = processDocId(triggerId, scope);
  const own = await readStateDoc(db, PROCESS_STATE_COLLECTION, processId);
  if (own.terminal) {
    return { ...own, processId };
  }

  if (triggerId === "tour_recap") {
    const legacy = await readTourRecapState({ db, tourKey: scope });
    if (legacy.terminal) {
      return {
        exists: true,
        data: { ...(legacy.data || {}), triggerId, scope, legacy: true },
        terminal: true,
        processId,
      };
    }
  }

  for (const prior of normalizeSupersedes(supersedes)) {
    const priorId = toFirestoreDocumentId(prior);
    if (!priorId || priorId === processId) continue;
    // eslint-disable-next-line no-await-in-loop
    const priorSnap = await readStateDoc(db, PROCESS_STATE_COLLECTION, priorId);
    if (priorSnap.terminal) {
      return { ...priorSnap, processId: priorId, superseded: true };
    }
  }

  return { ...own, processId };
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   triggerId: string,
 *   scope: string,
 *   status: "sent" | "skipped_archive" | "closed",
 *   finalDate?: string | null,
 *   source?: string,
 *   supersedes?: string[],
 *   extra?: Record<string, unknown>,
 * }} params
 */
async function writeProcessState({
  db,
  admin,
  triggerId,
  scope,
  status,
  finalDate = null,
  source = "cron",
  supersedes = [],
  extra = {},
}) {
  const processId = processDocId(triggerId, scope);
  if (!processId) return null;
  const priorIds = normalizeSupersedes(supersedes);
  const payload = {
    processId,
    triggerId: String(triggerId || "").trim(),
    scope: toFirestoreDocumentId(scope),
    status,
    supersedes: priorIds,
    finalDate: typeof finalDate === "string" && finalDate.trim() ? finalDate.trim() : null,
    source: typeof source === "string" && source.trim() ? source.trim() : "cron",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  };
  await db.collection(PROCESS_STATE_COLLECTION).doc(processId).set(payload, { merge: true });

  if (triggerId === "tour_recap") {
    await writeTourRecapState({
      db,
      admin,
      tourKey: scope,
      status,
      finalDate,
      source,
      extra: {
        processId,
        supersedes: priorIds,
        ...extra,
      },
    });
  }

  return payload;
}

module.exports = {
  PROCESS_STATE_COLLECTION,
  TERMINAL_PROCESS_STATUSES,
  TOUR_RECAP_PROCESS_SEEDS,
  processDocId,
  normalizeSupersedes,
  isTerminalProcessStatus,
  automatedFanoutBlock,
  readProcessState,
  writeProcessState,
};
