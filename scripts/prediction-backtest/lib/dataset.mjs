/**
 * Dataset load/save and Phish.net → ShowRecord conversion (#648).
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import {
  SETLISTS_DIR,
  normalizeTitle,
  loadSetlistAutomation,
} from "./shared.mjs";
import { rowsFromPhishinTracks } from "./phishin.mjs";

/**
 * @typedef {import('./features.mjs').ShowRecord} ShowRecord
 */

/**
 * Convert a completed-show Phish.net payload into a leakage-safe ShowRecord.
 * Slot labels are stored for evaluation only — never fed back as features for
 * the same showDate.
 *
 * @param {string} showDate
 * @param {object} payload Phish.net setlists/showdate response
 * @returns {ShowRecord | null}
 */
export function showRecordFromPhishnetPayload(showDate, payload) {
  const { normalizeSetlistRows, buildSetlistDocFromRows } = loadSetlistAutomation();
  let rows;
  try {
    rows = normalizeSetlistRows(payload);
  } catch {
    return null;
  }
  if (!rows.length) return null;

  // Historical complete shows: force set-complete timing so closers populate.
  // We pass set2Count via rows already present; evaluateSet1CloserStage with
  // set2Count>0 marks set1 complete without needing wall-clock timing.
  const doc = buildSetlistDocFromRows(rows, {}, null);
  const songs = doc.officialSetlist || rows.map((r) => r.title);
  if (!songs.length) return null;

  return {
    showDate,
    songs,
    slots: {
      s1o: doc.setlist?.s1o || "",
      s1c: doc.setlist?.s1c || "",
      s2o: doc.setlist?.s2o || "",
      s2c: doc.setlist?.s2c || "",
      enc: doc.setlist?.enc || "",
      wild: "",
    },
    encoreSongs: Array.isArray(doc.encoreSongs) ? doc.encoreSongs : [],
  };
}

/**
 * Same ShowRecord as the Phish.net importer, from a Phish.in v2 show.
 * @param {object} show
 * @returns {ShowRecord | null}
 */
export function showRecordFromPhishinShow(show) {
  const showDate = typeof show?.date === "string" ? show.date : "";
  const rows = rowsFromPhishinTracks(show?.tracks);
  if (!showDate || !rows.length) return null;
  const { buildSetlistDocFromRows } = loadSetlistAutomation();
  const doc = buildSetlistDocFromRows(rows, {}, null);
  const songs = doc.officialSetlist || rows.map((row) => row.title);
  if (!songs.length) return null;
  return {
    showDate,
    songs,
    slots: {
      s1o: doc.setlist?.s1o || "",
      s1c: doc.setlist?.s1c || "",
      s2o: doc.setlist?.s2o || "",
      s2c: doc.setlist?.s2c || "",
      enc: doc.setlist?.enc || "",
      wild: "",
    },
    encoreSongs: Array.isArray(doc.encoreSongs) ? doc.encoreSongs : [],
  };
}

/**
 * @param {ShowRecord} record
 */
export function writeShowRecord(record) {
  mkdirSync(SETLISTS_DIR, { recursive: true });
  const path = join(SETLISTS_DIR, `${record.showDate}.json`);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
}

/**
 * @param {string} showDate
 * @returns {ShowRecord | null}
 */
export function readShowRecord(showDate) {
  const path = join(SETLISTS_DIR, `${showDate}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * @returns {ShowRecord[]} ascending by showDate
 */
export function loadAllShowRecords() {
  if (!existsSync(SETLISTS_DIR)) return [];
  const files = readdirSync(SETLISTS_DIR).filter((f) => f.endsWith(".json"));
  /** @type {ShowRecord[]} */
  const out = [];
  for (const file of files) {
    const rec = JSON.parse(readFileSync(join(SETLISTS_DIR, file), "utf8"));
    if (rec?.showDate && Array.isArray(rec.songs)) out.push(rec);
  }
  out.sort((a, b) => a.showDate.localeCompare(b.showDate));
  return out;
}

/**
 * @param {ShowRecord} record
 * @returns {string[]} unique normalized titles that played
 */
export function playedKeys(record) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const t of record.songs) {
    const k = normalizeTitle(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
