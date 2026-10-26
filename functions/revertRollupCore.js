/**
 * Admin revert for mistaken rollups (#320). Reverses user counters for graded
 * picks on a show date, resets those picks to live scores from the persisted
 * official setlist (persistable/sanitized shape), and merges `rollup_audit`.
 *
 * Not fully atomic across >500 writes — same limitation as one-off scripts;
 * prefer low-traffic windows for huge shows.
 */

const {
  calculateTotalScore,
  countBustoutBoosts,
  countCorrectSlots,
  persistableActualSetlistFromOfficialDoc,
} = require("./scoringCore");
const {
  computeGlobalMaxScore,
  computePerPickRollup,
  resolveTourKeyForDate,
} = require("./rollupSeasonAggregates");
const {
  rebuildGlobalStatsLeaderboardsSafe,
} = require("./globalStatsLeaderboards");

const MAX_FIRESTORE_BATCH_WRITES = 500;

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   showDate: string,
 *   callerUid: string | null,
 *   logger?: { info?: Function, warn?: Function, error?: Function },
 * }} params
 * @returns {Promise<{ ok: boolean, message?: string, revertedPicks?: number, noop?: boolean }>}
 */
async function applyRevertRollupForShow({
  db,
  admin,
  showDate,
  callerUid = null,
  logger = undefined,
}) {
  const auditRef = db.collection("rollup_audit").doc(showDate);
  const auditSnap = await auditRef.get();
  if (!auditSnap.exists) {
    return {
      ok: false,
      message:
        "No rollup_audit document for this date — refusing revert (correlate with a prior rollup first).",
    };
  }
  const audit = auditSnap.data() || {};
  if (
    typeof audit.processedPicks !== "number" ||
    audit.processedPicks < 1 ||
    audit.lastRolledUpAt == null
  ) {
    return {
      ok: false,
      message:
        "rollup_audit shows no completed rollup (need processedPicks >= 1 and lastRolledUpAt). Refusing revert.",
    };
  }

  const setlistSnap = await db
    .collection("official_setlists")
    .doc(showDate)
    .get();
  if (!setlistSnap.exists) {
    return { ok: false, message: `official_setlists/${showDate} is missing.` };
  }
  const setlistDoc = setlistSnap.data() || {};
  const actualSetlist = persistableActualSetlistFromOfficialDoc(setlistDoc);

  const picksSnap = await db
    .collection("picks")
    .where("showDate", "==", showDate)
    .get();

  /** @type {{ ref: import("firebase-admin").firestore.DocumentReference, id: string, [k: string]: unknown }[]} */
  const gradedRows = [];
  for (const doc of picksSnap.docs) {
    const d = doc.data() || {};
    if (d.isGraded === true) {
      gradedRows.push({ ref: doc.ref, id: doc.id, ...d });
    }
  }

  if (gradedRows.length === 0) {
    await auditRef.set(
      {
        lastRevertAt: admin.firestore.FieldValue.serverTimestamp(),
        revertCallerUid: callerUid || null,
        revertPickCount: 0,
        revertNoop: true,
      },
      { merge: true }
    );
    logger?.info?.("revertRollupForShow: noop (no graded picks)", { showDate });
    return { ok: true, revertedPicks: 0, noop: true };
  }

  const calendarSnap = await db.collection("show_calendar").doc("snapshot").get();
  const showDatesByTour = calendarSnap.exists
    ? (calendarSnap.data() || {}).showDatesByTour
    : null;
  const tourKey = resolveTourKeyForDate(showDate, showDatesByTour);

  const provisional = gradedRows.map((p) => ({
    id: p.id,
    ...p,
    isGraded: true,
  }));
  const newScoresById = new Map();
  for (const p of gradedRows) {
    const sc = typeof p.score === "number" ? p.score : 0;
    newScoresById.set(p.id, sc);
  }
  const newGlobalMax = computeGlobalMaxScore(provisional, newScoresById);

  /** @type {Map<string, { total: number, shows: number, wins: number, correctSlots: number, seasonTp: number, seasonShows: number, seasonWins: number, seasonCorrect: number, seasonBustouts: number }>} */
  const userDeltas = new Map();
  for (const p of gradedRows) {
    const uid = String(p.userId || "");
    if (!uid) continue;
    const score = typeof p.score === "number" ? p.score : 0;
    const userPicks = p.picks || {};
    const newCorrectSlots = countCorrectSlots(userPicks, actualSetlist);
    const newBustoutBoosts = countBustoutBoosts(userPicks, actualSetlist);
    const plan = computePerPickRollup({
      pickData: {
        ...p,
        isGraded: false,
        winCredited: false,
        correctSlotsCredited: 0,
        bustoutBoostsCredited: 0,
      },
      newScore: score,
      newGlobalMax,
      newCorrectSlots,
      newBustoutBoosts,
    });
    const row = userDeltas.get(uid) || {
      total: 0,
      shows: 0,
      wins: 0,
      correctSlots: 0,
      seasonTp: 0,
      seasonShows: 0,
      seasonWins: 0,
      seasonCorrect: 0,
      seasonBustouts: 0,
    };
    row.total += plan.scoreDiff;
    row.shows += plan.isFirstGrade ? 1 : 0;
    row.wins += plan.winsDelta;
    if (plan.countsTowardSeason) {
      row.correctSlots += plan.correctSlotsDiff;
    }
    if (tourKey) {
      row.seasonTp += plan.scoreDiff;
      row.seasonShows += plan.isFirstGrade ? 1 : 0;
      row.seasonWins += plan.winsDelta;
      if (plan.countsTowardSeason) {
        row.seasonCorrect += plan.correctSlotsDiff;
      }
      row.seasonBustouts += plan.bustoutBoostsDiff;
    }
    userDeltas.set(uid, row);
  }

  /** @type {{ type: string, [k: string]: unknown }[]} */
  const queue = [];
  for (const [uid, d] of userDeltas) {
    queue.push({ type: "user", uid, d });
  }
  for (const p of gradedRows) {
    queue.push({ type: "pick", p });
  }
  queue.push({ type: "audit" });

  while (queue.length > 0) {
    let batch = db.batch();
    let n = 0;
    while (queue.length > 0 && n < MAX_FIRESTORE_BATCH_WRITES - 50) {
      const op = queue[0];
      if (op.type === "user") {
        queue.shift();
        const { uid, d } = op;
        const ref = db.collection("users").doc(uid);
        const upd = {
          totalPoints: admin.firestore.FieldValue.increment(-d.total),
          showsPlayed: admin.firestore.FieldValue.increment(-d.shows),
          wins: admin.firestore.FieldValue.increment(-d.wins),
          careerCorrectSlots: admin.firestore.FieldValue.increment(
            -d.correctSlots
          ),
        };
        if (tourKey) {
          upd[`seasonStats.${tourKey}.totalPoints`] =
            admin.firestore.FieldValue.increment(-d.seasonTp);
          upd[`seasonStats.${tourKey}.shows`] =
            admin.firestore.FieldValue.increment(-d.seasonShows);
          upd[`seasonStats.${tourKey}.wins`] =
            admin.firestore.FieldValue.increment(-d.seasonWins);
          upd[`seasonStats.${tourKey}.correctSlots`] =
            admin.firestore.FieldValue.increment(-d.seasonCorrect);
          upd[`seasonStats.${tourKey}.bustoutBoosts`] =
            admin.firestore.FieldValue.increment(-d.seasonBustouts);
        }
        batch.set(ref, upd, { merge: true });
        n += 1;
        continue;
      }
      if (op.type === "pick") {
        queue.shift();
        const p = op.p;
        const userPicks = p.picks || {};
        const newScore = calculateTotalScore(userPicks, actualSetlist);
        batch.update(p.ref, {
          isGraded: false,
          winCredited: false,
          correctSlotsCredited: admin.firestore.FieldValue.delete(),
          bustoutBoostsCredited: admin.firestore.FieldValue.delete(),
          score: newScore,
          gradedAt: admin.firestore.FieldValue.delete(),
        });
        n += 1;
        continue;
      }
      if (op.type === "audit") {
        queue.shift();
        batch.set(
          auditRef,
          {
            lastRevertAt: admin.firestore.FieldValue.serverTimestamp(),
            revertCallerUid: callerUid || null,
            revertPickCount: gradedRows.length,
            revertNoop: false,
          },
          { merge: true }
        );
        n += 1;
        continue;
      }
      queue.shift();
    }
    await batch.commit();
  }

  logger?.info?.("revertRollupForShow", {
    showDate,
    revertedPicks: gradedRows.length,
    callerUid,
  });

  await rebuildGlobalStatsLeaderboardsSafe({
    db,
    admin,
    tourKey,
    trigger: "revert",
    logger,
  });

  return { ok: true, revertedPicks: gradedRows.length };
}

module.exports = { applyRevertRollupForShow };
