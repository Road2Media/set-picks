/**
 * Completed-show reconciliation for `bustouts` and `songGaps` (#626).
 *
 * The live poller unions snapshots during a short feed. This planner
 * overwrites both fields from a fresh Phish.net row list (no union) so a
 * corrected title cannot linger after the show.
 *
 * Score impact:
 * - `songGaps` is display-only and never changes points.
 * - A bustout title that is not in the stored played list cannot change
 *   points. `calculateSlotScore` returns 0 before the bustout boost when
 *   the guess was not played.
 * - Adding or removing a bustout title that IS in the stored played list
 *   changes the +20 boost. `--apply` recomputes pick scores and graded
 *   `users.totalPoints` only in that case.
 *
 * The fetched gap replaces the stored gap, including 0. That is deliberate
 * for a settled show. Live polls still keep the first positive gap.
 */

const {
  deriveBustoutsFromRows,
  deriveSongGapsFromRows,
  playedNormsFromSetlistPayload,
  scoringBustoutFingerprint,
} = require("./phishnetLiveSetlistAutomation");
const {
  calculateTotalScore,
  persistableActualSetlistFromOfficialDoc,
} = require("./scoringCore");

const MAX_FIRESTORE_BATCH_WRITES = 500;
const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPDATED_BY = "backfill-reconcile-snapshots";

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function parseShowDateList(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Pass --showDates=YYYY-MM-DD[,YYYY-MM-DD...].");
  }
  const dates = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (dates.length === 0) {
    throw new Error("Pass --showDates=YYYY-MM-DD[,YYYY-MM-DD...].");
  }
  for (const showDate of dates) {
    if (!SHOW_DATE_RE.test(showDate)) {
      throw new Error(`Invalid showDate: ${showDate}`);
    }
  }
  return dates;
}

/**
 * @param {unknown} list
 * @returns {string[]}
 */
function cleanTitles(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((title) => (typeof title === "string" ? title.trim() : ""))
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
function cleanGaps(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  /** @type {Record<string, number>} */
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * @param {string[]} list
 * @returns {string[]}
 */
function bustoutNorms(list) {
  return [...new Set(cleanTitles(list).map((title) => title.toLowerCase()))].sort();
}

/**
 * @param {Record<string, number>} left
 * @param {Record<string, number>} right
 * @returns {boolean}
 */
function gapsEqual(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

/**
 * @param {Record<string, number>} before
 * @param {Record<string, number>} after
 * @returns {string[]}
 */
function songGapDiffLines(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .sort()
    .filter((key) => before[key] !== after[key])
    .map((key) => `${key} ${before[key] ?? "∅"}→${after[key] ?? "∅"}`);
}

/**
 * @param {Record<string, unknown> | null | undefined} prior
 * @param {Array<{ title: string, gap: number | null }>} rows
 * Normalized Phish.net rows (`normalizeSetlistRows` output).
 */
function planSnapshotOverwrite(prior, rows) {
  const beforeBustouts = cleanTitles(prior?.bustouts);
  const beforeGaps = cleanGaps(prior?.songGaps);
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      skip: "no-rows",
      changed: false,
      scoringBustoutsChanged: false,
      bustouts: beforeBustouts,
      songGaps: beforeGaps,
      beforeBustouts,
      beforeGaps,
      gapDiffs: [],
      scoreReconcileReason:
        "skipped — Phish.net returned no rows, so the stored snapshot was left alone",
    };
  }

  const songGaps = deriveSongGapsFromRows(rows);
  const bustouts = deriveBustoutsFromRows(rows);
  const played = playedNormsFromSetlistPayload({
    setlist: prior?.setlist,
    officialSetlist: prior?.officialSetlist,
    encoreSongs: prior?.encoreSongs,
  });
  const scoringBustoutsChanged =
    scoringBustoutFingerprint(beforeBustouts, played) !==
    scoringBustoutFingerprint(bustouts, played);
  const changed =
    JSON.stringify(bustoutNorms(beforeBustouts)) !== JSON.stringify(bustoutNorms(bustouts)) ||
    !gapsEqual(beforeGaps, songGaps);

  return {
    skip: null,
    changed,
    scoringBustoutsChanged,
    bustouts,
    songGaps,
    beforeBustouts,
    beforeGaps,
    gapDiffs: songGapDiffLines(beforeGaps, songGaps),
    scoreReconcileReason: scoringBustoutsChanged
      ? "yes — a played song gained or lost bustout membership; --apply recomputes pick scores and graded totalPoints"
      : "no — played-song bustout membership is unchanged. songGaps is display-only, and a bustout title that was not played does not score",
  };
}

/**
 * @param {object} args
 * @param {import("firebase-admin").firestore.Firestore} args.db
 * @param {typeof import("firebase-admin")} args.admin
 * @param {string} args.showDate
 * @param {ReturnType<typeof planSnapshotOverwrite>} args.plan
 * @returns {Promise<{ wrote: boolean, updatedPicks: number, reconciledGradedPicks: number }>}
 */
async function applySnapshotReconcile({ db, admin, showDate, plan }) {
  if (!plan || plan.skip || !plan.changed) {
    return { wrote: false, updatedPicks: 0, reconciledGradedPicks: 0 };
  }

  const setlistRef = db.collection("official_setlists").doc(showDate);
  // `update` replaces the `songGaps` map. `set` + merge would deep-merge it
  // and leave the stale keys this backfill is here to remove.
  await setlistRef.update({
    bustouts: plan.bustouts,
    songGaps: plan.songGaps,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: UPDATED_BY,
  });

  if (!plan.scoringBustoutsChanged) {
    return { wrote: true, updatedPicks: 0, reconciledGradedPicks: 0 };
  }

  const freshSnap = await setlistRef.get();
  const actualSetlist = persistableActualSetlistFromOfficialDoc(freshSnap.data() || {});
  const picksSnap = await db.collection("picks").where("showDate", "==", showDate).get();

  let batch = db.batch();
  let opCount = 0;
  let updatedPicks = 0;
  let reconciledGradedPicks = 0;

  for (const pickDoc of picksSnap.docs) {
    if (opCount + 2 > MAX_FIRESTORE_BATCH_WRITES) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
    const pickData = pickDoc.data() || {};
    const newScore = calculateTotalScore(pickData.picks || {}, actualSetlist);
    const oldScore = Number.isFinite(pickData.score) ? Number(pickData.score) : 0;
    const scoreDelta = newScore - oldScore;
    const pickUpdate = { score: newScore };
    if (pickData.isGraded !== true) {
      pickUpdate.gradedAt = admin.firestore.FieldValue.delete();
    }
    batch.update(pickDoc.ref, pickUpdate);
    opCount += 1;
    updatedPicks += 1;

    if (pickData.isGraded === true && scoreDelta !== 0 && pickData.userId) {
      batch.set(
        db.collection("users").doc(pickData.userId),
        { totalPoints: admin.firestore.FieldValue.increment(scoreDelta) },
        { merge: true }
      );
      opCount += 1;
      reconciledGradedPicks += 1;
    }
  }

  if (opCount > 0) await batch.commit();
  return { wrote: true, updatedPicks, reconciledGradedPicks };
}

module.exports = {
  UPDATED_BY,
  applySnapshotReconcile,
  parseShowDateList,
  planSnapshotOverwrite,
  songGapDiffLines,
};
