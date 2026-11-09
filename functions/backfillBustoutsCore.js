/**
 * Core backfill logic for per-show `bustouts` snapshots (#214).
 *
 * This is the single source of truth used by both:
 *   - the deployed callable `backfillBustoutsForShows` (functions/index.js),
 *     which wraps this with an admin-claim auth gate + HttpsError reporting.
 *   - the admin ops script (functions/scripts/backfillBustouts.js), which
 *     calls it directly under Application Default Credentials so it can run
 *     locally without minting a Firebase Auth ID token.
 *
 * Keeping the module Firebase-SDK-only (no firebase-functions imports) means
 * the script doesn't pay the cost of loading the callable runtime just to
 * reach this code path.
 */

const {
  deriveBustoutsFromRows,
  fetchPhishnetSetlistForDate,
  normalizeSetlistRows,
  BUSTOUT_MIN_GAP: AUTOMATION_BUSTOUT_MIN_GAP,
} = require("./phishnetLiveSetlistAutomation");
const {
  attachScoringShowDate,
  calculateTotalScore,
  persistableActualSetlistFromOfficialDoc,
} = require("./scoringCore");

/** Firestore batch write limit (same invariant as `adminRollupApi.js` / `profileApi.js`). */
const MAX_FIRESTORE_BATCH_WRITES = 500;

const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} showDate */
function normalizeShowDate(showDate) {
  if (typeof showDate !== "string" || !SHOW_DATE_RE.test(showDate.trim())) {
    throw new Error(`showDate must be a YYYY-MM-DD string (got: ${showDate})`);
  }
  return showDate.trim();
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @returns {Promise<string[]>}
 */
async function scanShowsMissingBustouts(db) {
  const snap = await db.collection("official_setlists").get();
  /** @type {string[]} */
  const out = [];
  for (const d of snap.docs) {
    const data = d.data() || {};
    if (!Array.isArray(data.bustouts)) out.push(d.id);
  }
  out.sort();
  return out;
}

/**
 * Resolve target show dates from caller input.
 *
 * @param {object} args
 * @param {import("firebase-admin").firestore.Firestore} args.db
 * @param {string[]} [args.showDates]
 * @param {"missing"} [args.mode]
 * @returns {Promise<string[]>}
 */
async function resolveTargetShowDates({ db, showDates, mode }) {
  if (Array.isArray(showDates) && showDates.length > 0) {
    return showDates.map((d) => normalizeShowDate(d));
  }
  if (mode === "missing") {
    return scanShowsMissingBustouts(db);
  }
  throw new Error(
    'Pass { showDates: ["YYYY-MM-DD", ...] } or { mode: "missing" }.'
  );
}

/**
 * Re-fetch Phish.net rows for `showDate`, write a fresh `bustouts` snapshot
 * onto `official_setlists/{showDate}`, recompute every pick's score, and
 * reconcile `users.totalPoints` by score delta for picks already marked
 * `isGraded: true`.
 *
 * Idempotent: re-running with unchanged Phish.net data produces the same
 * snapshot and zero score deltas.
 *
 * @param {object} args
 * @param {import("firebase-admin").firestore.Firestore} args.db
 * @param {typeof import("firebase-admin")} args.admin
 * @param {{warn?: Function, info?: Function}} [args.logger]
 * @param {string} args.phishnetApiKey
 * @param {string[]} [args.showDates]
 * @param {"missing"} [args.mode]
 * @param {string} [args.updatedBy] - audit tag written to `updatedBy`.
 * @returns {Promise<{ results: Array<Record<string, unknown>>, minGap: number }>}
 */
async function runBackfill({
  db,
  admin,
  logger = console,
  phishnetApiKey,
  showDates,
  mode,
  updatedBy = "backfill-bustouts",
}) {
  if (!db) throw new Error("runBackfill: `db` is required.");
  if (!admin) throw new Error("runBackfill: `admin` is required.");
  if (!phishnetApiKey || !String(phishnetApiKey).trim()) {
    throw new Error(
      "runBackfill: `phishnetApiKey` is required (Phish.net API key not configured)."
    );
  }

  const targets = await resolveTargetShowDates({ db, showDates, mode });
  const apiKey = String(phishnetApiKey).trim();
  const results = [];

  for (const showDate of targets) {
    const setlistRef = db.collection("official_setlists").doc(showDate);
    const setlistSnap = await setlistRef.get();
    if (!setlistSnap.exists) {
      results.push({ showDate, skipped: "no-setlist-doc" });
      continue;
    }

    // 1) Re-fetch Phish.net rows and derive bustouts.
    let bustouts;
    try {
      const payload = await fetchPhishnetSetlistForDate(showDate, apiKey);
      const rows = normalizeSetlistRows(payload);
      bustouts = deriveBustoutsFromRows(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn?.("backfillBustoutsForShows fetch failed", { showDate, msg });
      results.push({ showDate, skipped: "phishnet-fetch-failed", error: msg });
      continue;
    }

    // 2) Write merge + capture prior bustouts for idempotency / logging.
    const prior = setlistSnap.data() || {};
    const priorBustouts = Array.isArray(prior.bustouts) ? prior.bustouts : null;
    await setlistRef.set(
      {
        bustouts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy,
      },
      { merge: true }
    );

    // 3) Recompute live scores from the *post-write* doc so the snapshot
    // we just wrote is what scoring sees. Also reconcile graded picks'
    // contribution to `users.totalPoints` by score diff — mirrors the
    // rollup pathway so we don't leave stale totals behind.
    const freshSnap = await setlistRef.get();
    const freshDoc = freshSnap.data() || {};
    const actualSetlist = attachScoringShowDate(
      persistableActualSetlistFromOfficialDoc(freshDoc),
      showDate
    );

    const picksSnap = await db
      .collection("picks")
      .where("showDate", "==", showDate)
      .get();

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
      const oldScore = Number.isFinite(pickData.score)
        ? Number(pickData.score)
        : 0;
      const scoreDelta = newScore - oldScore;

      const pickUpdate = { score: newScore };
      if (pickData.isGraded !== true) {
        pickUpdate.gradedAt = admin.firestore.FieldValue.delete();
      }
      batch.update(pickDoc.ref, pickUpdate);
      opCount += 1;
      updatedPicks += 1;

      // Only reconcile user totals when this pick was already graded —
      // otherwise the rollup flow owns first-grade accounting.
      if (pickData.isGraded === true && scoreDelta !== 0 && pickData.userId) {
        batch.set(
          db.collection("users").doc(pickData.userId),
          {
            totalPoints: admin.firestore.FieldValue.increment(scoreDelta),
          },
          { merge: true }
        );
        opCount += 1;
        reconciledGradedPicks += 1;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    results.push({
      showDate,
      bustoutCount: bustouts.length,
      priorBustoutCount: priorBustouts ? priorBustouts.length : null,
      updatedPicks,
      reconciledGradedPicks,
    });
  }

  logger.info?.("backfillBustoutsForShows complete", {
    minGap: AUTOMATION_BUSTOUT_MIN_GAP,
    results,
  });

  return { results, minGap: AUTOMATION_BUSTOUT_MIN_GAP };
}

module.exports = {
  runBackfill,
  resolveTargetShowDates,
  scanShowsMissingBustouts,
  normalizeShowDate,
  MAX_FIRESTORE_BATCH_WRITES,
};
