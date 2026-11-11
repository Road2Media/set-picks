/**
 * Server write for the 100th public board (#1147).
 * Ranking uses the live show policy. The stored document is the public projection.
 */
"use strict";

const { countCorrectSlots, countExactHits } = require("./scoringCore");
const { LIVE_RANK_POLICY, rankScoredRows } = require("./pointsTieRanking.cjs");
const {
  HUNDREDTH_SHOW_DATE,
  PUBLIC_NIGHT_BOARDS,
  buildPublicNightBoardDoc,
  projectPublicNightBoard,
  publicHandle,
  shouldPublishHundredthBoard,
} = require("./hundredthShowBoard.cjs");

/**
 * @param {unknown} picks
 * @returns {boolean}
 */
function hasLockedPicks(picks) {
  if (!picks || typeof picks !== "object") return false;
  return Object.values(picks).some((value) => String(value ?? "").trim() !== "");
}

/**
 * Drop a handle that is an email before ranking, so it cannot take a place.
 *
 * @param {unknown} rows
 */
function rankHundredthBoardRows(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) =>
    publicHandle(row?.handle),
  );
  const ranked = rankScoredRows(list, {
    policy: LIVE_RANK_POLICY,
    surface: "show",
  });
  return projectPublicNightBoard(
    ranked.rows.map((row) => ({
      rank: row.rank,
      handle: row.handle,
      points: row.points,
      exactSlots: row.exactHits,
      email: row.email,
      uid: row.uid,
      userId: row.userId,
    })),
  );
}

/**
 * @param {Iterable<{ id?: string, data?: () => object }>} pickDocs
 * @param {Map<string, number> | null | undefined} scoresByPickId
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @param {Map<string, string> | null | undefined} handlesByUid
 */
function scoredRowsFromPicks(pickDocs, scoresByPickId, actualSetlist, handlesByUid) {
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  const scores = scoresByPickId instanceof Map ? scoresByPickId : new Map();
  const handles = handlesByUid instanceof Map ? handlesByUid : new Map();
  for (const pickDoc of pickDocs || []) {
    const data = pickDoc.data?.() || {};
    const uid = typeof data.userId === "string" ? data.userId.trim() : "";
    if (!uid || !hasLockedPicks(data.picks)) continue;
    const fromPick = publicHandle(data.handle);
    const fromUser = publicHandle(handles.get(uid));
    const score = scores.has(pickDoc.id)
      ? scores.get(pickDoc.id)
      : typeof data.score === "number"
        ? data.score
        : 0;
    rows.push({
      uid,
      email: data.email,
      handle: fromPick || fromUser,
      points: score,
      exactHits: countExactHits(data.picks, actualSetlist),
      correctPicks: countCorrectSlots(data.picks, actualSetlist),
    });
  }
  return rows;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} uids
 */
async function loadPublicHandles(db, uids) {
  /** @type {Map<string, string>} */
  const handlesByUid = new Map();
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length || !db?.getAll) return handlesByUid;
  const refs = unique.map((uid) => db.collection("users").doc(uid));
  const snaps = await db.getAll(...refs);
  snaps.forEach((snap, index) => {
    const handle = snap?.exists ? publicHandle(snap.data()?.handle) : "";
    if (handle) handlesByUid.set(unique[index], handle);
  });
  return handlesByUid;
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   showDate: string,
 *   pickDocs: Iterable<{ id?: string, data?: () => object }>,
 *   scoresByPickId?: Map<string, number> | null,
 *   actualSetlist?: Record<string, unknown> | null,
 *   allowDryRun?: boolean,
 *   write?: boolean,
 * }} params
 */
async function publishHundredthNightBoard({
  db,
  showDate,
  pickDocs,
  scoresByPickId = null,
  actualSetlist = null,
  allowDryRun = false,
  write = true,
}) {
  const date = String(showDate || "").trim();
  if (!shouldPublishHundredthBoard(date, { allowDryRun })) {
    return { wrote: false, reason: "not_hundredth" };
  }
  const docs = Array.from(pickDocs || []);
  const uids = [];
  for (const pickDoc of docs) {
    const data = pickDoc.data?.() || {};
    const uid = typeof data.userId === "string" ? data.userId.trim() : "";
    if (uid) uids.push(uid);
  }
  const handlesByUid = await loadPublicHandles(db, uids);
  const ranked = rankHundredthBoardRows(
    scoredRowsFromPicks(docs, scoresByPickId, actualSetlist, handlesByUid),
  );
  const board = buildPublicNightBoardDoc(date, ranked, {
    dryRun: date !== HUNDREDTH_SHOW_DATE,
  });
  if (!write) {
    return { wrote: false, reason: "dry_run", showDate: date, rowCount: board.rows.length, board };
  }
  await db.collection(PUBLIC_NIGHT_BOARDS).doc(date).set(board);
  return { wrote: true, showDate: date, rowCount: board.rows.length, board };
}

module.exports = {
  rankHundredthBoardRows,
  scoredRowsFromPicks,
  publishHundredthNightBoard,
};
