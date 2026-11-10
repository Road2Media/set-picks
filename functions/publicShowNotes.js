/**
 * Write `public_show_notes` from `comms_show_context` (#684).
 * Admin SDK only. Clients never read the source collection.
 */

"use strict";

const {
  PUBLIC_SHOW_NOTES_COLLECTION,
  PUBLIC_SHOW_NOTES_INDEX_ID,
  buildPublicShowNotesIndex,
  projectPublicShowNote,
} = require("./publicShowNotesCore");

const WRITE_CHUNK = 400;

/**
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Map<string, { venue: string, city: string }>>}
 */
async function readVenueByDate(db) {
  const map = new Map();
  const snap = await db.collection("show_calendar").doc("snapshot").get();
  if (!snap.exists) return map;
  const rows = snap.data()?.showDates;
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row.date !== "string") continue;
    map.set(row.date, {
      venue: typeof row.venue === "string" ? row.venue.trim() : "",
      city: typeof row.city === "string" ? row.city.trim() : "",
    });
  }
  return map;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ id: string, data?: Record<string, unknown>, delete?: boolean }[]} ops
 */
async function commitOps(db, ops) {
  let batch = db.batch();
  let count = 0;
  for (const op of ops) {
    const ref = db.collection(PUBLIC_SHOW_NOTES_COLLECTION).doc(op.id);
    if (op.delete) batch.delete(ref);
    else batch.set(ref, op.data);
    count += 1;
    if (count === WRITE_CHUNK) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count) await batch.commit();
}

/**
 * @param {FirebaseFirestore.DocumentSnapshot[] | { id: string, data: () => Record<string, unknown> | undefined }[]} docs
 * @returns {Record<string, unknown>[]}
 */
function notesFromPublicDocs(docs) {
  /** @type {Record<string, unknown>[]} */
  const notes = [];
  for (const doc of docs || []) {
    if (!doc || doc.id === PUBLIC_SHOW_NOTES_INDEX_ID) continue;
    const data = typeof doc.data === "function" ? doc.data() : null;
    if (!data || data.showDate !== doc.id) continue;
    if (!Array.isArray(data.paragraphs) || data.paragraphs.length < 2) continue;
    notes.push(data);
  }
  return notes;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} writtenAt
 */
async function rebuildPublicShowNotesIndex(db, writtenAt) {
  const snap = await db.collection(PUBLIC_SHOW_NOTES_COLLECTION).get();
  const notes = notesFromPublicDocs(snap.docs);
  await db
    .collection(PUBLIC_SHOW_NOTES_COLLECTION)
    .doc(PUBLIC_SHOW_NOTES_INDEX_ID)
    .set(buildPublicShowNotesIndex(notes, writtenAt));
  return notes.length;
}

/**
 * Full rebuild. Publishes nights that clear the richness gate and deletes
 * public docs that no longer do. Does not write `comms_show_context`.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ logger?: { info?: Function, warn?: Function }, now?: string }} [opts]
 */
async function refreshPublicShowNotes(db, opts = {}) {
  const logger = opts.logger;
  const writtenAt = opts.now || new Date().toISOString();
  let venues = new Map();
  try {
    venues = await readVenueByDate(db);
  } catch (e) {
    logger?.warn?.("public_show_notes: calendar read failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
  }

  const contextSnap = await db.collection("comms_show_context").get();
  /** @type {Record<string, unknown>[]} */
  const notes = [];
  for (const doc of contextSnap.docs || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.id)) continue;
    const raw = typeof doc.data === "function" ? doc.data() || {} : {};
    const place = venues.get(doc.id) || {};
    const note = projectPublicShowNote({ ...raw, showDate: doc.id }, place);
    if (note) notes.push(note);
  }

  const existingSnap = await db.collection(PUBLIC_SHOW_NOTES_COLLECTION).get();
  const existingIds = (existingSnap.docs || [])
    .map((doc) => doc.id)
    .filter((id) => id && id !== PUBLIC_SHOW_NOTES_INDEX_ID);
  const keep = new Set(notes.map((note) => note.showDate));
  /** @type {{ id: string, data?: Record<string, unknown>, delete?: boolean }[]} */
  const ops = notes.map((note) => ({
    id: String(note.showDate),
    data: { ...note, writtenAt },
  }));
  const deleted = [];
  for (const id of existingIds) {
    if (!keep.has(id)) {
      ops.push({ id, delete: true });
      deleted.push(id);
    }
  }
  ops.push({
    id: PUBLIC_SHOW_NOTES_INDEX_ID,
    data: buildPublicShowNotesIndex(notes, writtenAt),
  });
  await commitOps(db, ops);
  logger?.info?.("refreshPublicShowNotes", {
    written: notes.length,
    deleted: deleted.length,
  });
  return { written: notes.length, deleted: deleted.length };
}

/**
 * Project one already-loaded context doc. Soft-fail is the caller's job.
 * A night that fails the gate is removed so a thin page cannot linger.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Record<string, unknown> | null | undefined} context
 * @param {{ warn?: Function, info?: Function } | undefined} logger
 */
async function syncPublicShowNote(db, context, logger) {
  const showDate = typeof context?.showDate === "string" ? context.showDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) return { skipped: true };
  let place = {};
  try {
    const venues = await readVenueByDate(db);
    place = venues.get(showDate) || {};
  } catch (e) {
    logger?.warn?.("public_show_notes: calendar read failed", {
      showDate,
      msg: e instanceof Error ? e.message : String(e),
    });
  }
  const note = projectPublicShowNote(context, place);
  const writtenAt = new Date().toISOString();
  const ref = db.collection(PUBLIC_SHOW_NOTES_COLLECTION).doc(showDate);
  if (note) await ref.set({ ...note, writtenAt });
  else await ref.delete();
  await rebuildPublicShowNotesIndex(db, writtenAt);
  logger?.info?.("syncPublicShowNote", { showDate, published: Boolean(note) });
  return { showDate, published: Boolean(note) };
}

module.exports = {
  refreshPublicShowNotes,
  syncPublicShowNote,
};
