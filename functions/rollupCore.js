/**
 * Rollup core (extracted from `rollupScoresForShow` callable in #266).
 *
 * Single source of truth for finalizing a show:
 *   - Read `official_setlists/{showDate}` (authoritative snapshot).
 *   - Recompute every matching pick's `score` via the same path as live
 *     scoring (`calculateTotalScore`).
 *   - Set `isGraded: true` (and `gradedAt` on first grade); increment
 *     `users.totalPoints`, `showsPlayed`, `wins`, and `seasonStats.{tourKey}`
 *     by the per-pick delta (`computePerPickRollup`).
 *   - Write a `rollup_audit/{showDate}` record with the caller identity and
 *     a `trigger` tag (`"manual"`, `"auto"`, or `"auto-reconcile"`).
 *
 * Callable wrapper (`functions/index.js::rollupScoresForShow`) passes
 * `trigger: "manual"` and the admin UID. Scheduled poller passes
 * `trigger: "auto"` (first finalize) or `"auto-reconcile"` (post-finalize
 * re-run after a Phish.net edit) and `callerUid: null`.
 *
 * The per-pick math is delta-based so repeated invocations reconcile
 * `users.totalPoints` rather than double-increment; this is why the same
 * core is safe to invoke from both manual and automatic paths.
 */

const {
  calculateTotalScore,
  countBustoutBoosts,
  countCorrectSlots,
  persistableActualSetlistFromOfficialDoc,
  setlistHasAnyPlayedSong,
} = require("./scoringCore");
const {
  computeGlobalMaxScore,
  computePerPickRollup,
  resolveTourKeyForDate,
} = require("./rollupSeasonAggregates");
const {
  sendPostShowRollupPush,
  CLOSE_CALL_MAX_GAP,
} = require("./postShowRollupPush");
const { deliverPostRollupComms } = require("./commsEventAdapters");
const { awardBadgesForUsers } = require("./badgeAwards");
const { freezeRankSnapshotsAfterShow } = require("./badgeSnapshotJobs");
const {
  rebuildGlobalStatsLeaderboardsSafe,
} = require("./globalStatsLeaderboards");

/** Same invariant as `adminRollupApi.js` / `profileApi.js`. */
const MAX_FIRESTORE_BATCH_WRITES = 500;

/**
 * @param {object} params
 * @param {import("firebase-admin").firestore.Firestore} params.db
 * @param {typeof import("firebase-admin")} params.admin
 * @param {string} params.showDate YYYY-MM-DD.
 * @param {string | null} [params.callerUid] Firebase UID of the caller (null for scheduler).
 * @param {"manual" | "auto" | "auto-reconcile"} [params.trigger] Audit tag.
 * @param {{ info?: Function, warn?: Function, error?: Function } | undefined} [params.logger]
 * @param {object | null} [params.manualTimingGate] Manual-callable only (#326): merged into `rollup_audit`.
 * @returns {Promise<{ processedPicks: number, skippedPicks: number, totalPicks: number, setlistExists: boolean, hollowSetlist?: boolean }>}
 */
async function runRollupForShow({
  db,
  admin,
  showDate,
  callerUid = null,
  trigger = "manual",
  logger = undefined,
  manualTimingGate = null,
}) {
  const setlistSnap = await db
    .collection("official_setlists")
    .doc(showDate)
    .get();
  if (!setlistSnap.exists) {
    // Surfaced to the manual callable as `failed-precondition`; the auto
    // path checks existence before invoking, so this branch is defensive.
    return {
      processedPicks: 0,
      skippedPicks: 0,
      totalPicks: 0,
      setlistExists: false,
    };
  }
  const setlistDoc = setlistSnap.data() || {};
  const actualSetlist = persistableActualSetlistFromOfficialDoc(setlistDoc);

  if (!setlistHasAnyPlayedSong(actualSetlist)) {
    logger?.warn?.("runRollupForShow: hollow setlist (no played songs); skipping rollup", {
      showDate,
      trigger,
    });
    return {
      processedPicks: 0,
      skippedPicks: 0,
      totalPicks: 0,
      setlistExists: true,
      hollowSetlist: true,
    };
  }

  const picksSnap = await db
    .collection("picks")
    .where("showDate", "==", showDate)
    .get();

  // Load show calendar once for `showDate` → `tourKey` (#244). If the
  // calendar snapshot does not list the date, tour-scoped `seasonStats`
  // writes are skipped; global totals and wins still materialize. The skip
  // is an error plus `rollup_audit.tourKeyMissing` (#298) so it is visible
  // without log diving. A later rollup that finds the key clears the flag.
  // It does not replay first-grade tour increments that were skipped.
  const calendarSnap = await db.collection("show_calendar").doc("snapshot").get();
  const showDatesByTour = calendarSnap.exists
    ? (calendarSnap.data() || {}).showDatesByTour
    : null;
  const tourKey = resolveTourKeyForDate(showDate, showDatesByTour);
  const tourAudit = rollupAuditTourFields(showDate, tourKey);
  if (!tourKey) {
    logger?.error?.("runRollupForShow: tourKey missing for showDate", {
      showDate,
      trigger,
      tourKeyMissing: true,
    });
  }

  if (picksSnap.empty) {
    await writeRollupAuditDoc({
      db,
      admin,
      showDate,
      processedPicks: 0,
      skippedPicks: 0,
      totalPicks: 0,
      callerUid,
      trigger,
      logger,
      manualTimingGate,
      tourAudit,
    });
    logger?.info?.("runRollupForShow", {
      showDate,
      trigger,
      processedPicks: 0,
      skippedPicks: 0,
      totalPicks: 0,
      callerUid,
      tourKey: tourAudit.tourKey,
      tourKeyMissing: tourAudit.tourKeyMissing,
    });
    await freezeSnapshotsSafe({
      db,
      admin,
      showDate,
      showDatesByTour,
      tourKey,
      logger,
    });
    return {
      processedPicks: 0,
      skippedPicks: 0,
      totalPicks: 0,
      setlistExists: true,
    };
  }

  // Pre-compute every pick's new score to derive `newGlobalMax` before any
  // write lands. Mirrors `src/shared/utils/showAggregation.js::reduceShowWinners`:
  // only graded, non-empty picks owned by an authenticated user are eligible;
  // `max === 0` credits nobody.
  /** @type {Map<string, number>} */
  const newScoresById = new Map();
  const provisionalPicks = [];
  for (const pickDoc of picksSnap.docs) {
    const pickData = pickDoc.data() || {};
    if (!pickData.userId) continue;
    const userPicks = pickData.picks || {};
    newScoresById.set(
      pickDoc.id,
      calculateTotalScore(userPicks, actualSetlist)
    );
    provisionalPicks.push({ id: pickDoc.id, ...pickData, isGraded: true });
  }
  const newGlobalMax = computeGlobalMaxScore(provisionalPicks, newScoresById);

  // Two writes per pick (pick doc + user doc, merged) — 500-op batch limit.
  const OPS_PER_PICK = 2;
  let batch = db.batch();
  let opCount = 0;
  let processedPicks = 0;
  let skippedPicks = 0;

  /** @type {{ kind: "win" | "nearMiss", userId: string, pickId: string, newScore?: number }[]} */
  const rollupPushHints = [];
  /** @type {Set<string>} */
  const processedUserIds = new Set();

  for (const pickDoc of picksSnap.docs) {
    const pickData = pickDoc.data() || {};
    if (!pickData.userId) {
      skippedPicks += 1;
      continue;
    }
    if (opCount + OPS_PER_PICK > MAX_FIRESTORE_BATCH_WRITES) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
    const newScore = newScoresById.get(pickDoc.id) || 0;
    const userPicks = pickData.picks || {};
    const newCorrectSlots = countCorrectSlots(userPicks, actualSetlist);
    const newBustoutBoosts = countBustoutBoosts(userPicks, actualSetlist);
    const plan = computePerPickRollup({
      pickData,
      newScore,
      newGlobalMax,
      newCorrectSlots,
      newBustoutBoosts,
    });

    if (pickData.userId && plan.isFirstGrade) {
      if (plan.newIsWin) {
        rollupPushHints.push({
          kind: "win",
          userId: pickData.userId,
          pickId: pickDoc.id,
        });
      } else if (
        plan.countsTowardSeason &&
        typeof newGlobalMax === "number" &&
        newGlobalMax > 0 &&
        !plan.newIsWin &&
        newScore >= 0 &&
        newGlobalMax - newScore <= CLOSE_CALL_MAX_GAP
      ) {
        rollupPushHints.push({
          kind: "nearMiss",
          userId: pickData.userId,
          pickId: pickDoc.id,
          newScore,
        });
      }
    }

    const pickUpdate = {
      score: newScore,
      isGraded: true,
      winCredited: plan.newIsWin,
      correctSlotsCredited: plan.newCorrectSlots,
      bustoutBoostsCredited: plan.newBustoutBoosts,
    };
    if (plan.isFirstGrade) {
      pickUpdate.gradedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    batch.update(pickDoc.ref, pickUpdate);

    const userUpdate = {
      totalPoints: admin.firestore.FieldValue.increment(plan.scoreDiff),
      showsPlayed: admin.firestore.FieldValue.increment(
        plan.isFirstGrade ? 1 : 0
      ),
      wins: admin.firestore.FieldValue.increment(plan.winsDelta),
      careerCorrectSlots: admin.firestore.FieldValue.increment(
        plan.countsTowardSeason ? plan.correctSlotsDiff : 0
      ),
      seasonStatsSnapshotAt: admin.firestore.FieldValue.serverTimestamp(),
      seasonStatsThroughShow: showDate,
      // #298: pre-launch user docs carry an unread nested `stats` blob.
      // Merge writes never named it, so it survived every rollup.
      stats: admin.firestore.FieldValue.delete(),
    };
    if (tourKey) {
      userUpdate.seasonStats = {
        [tourKey]: {
          totalPoints: admin.firestore.FieldValue.increment(plan.scoreDiff),
          shows: admin.firestore.FieldValue.increment(
            plan.isFirstGrade ? 1 : 0
          ),
          wins: admin.firestore.FieldValue.increment(plan.winsDelta),
          correctSlots: admin.firestore.FieldValue.increment(
            plan.countsTowardSeason ? plan.correctSlotsDiff : 0
          ),
          bustoutBoosts: admin.firestore.FieldValue.increment(plan.bustoutBoostsDiff),
        },
      };
    }
    batch.set(
      db.collection("users").doc(pickData.userId),
      userUpdate,
      { merge: true }
    );
    opCount += OPS_PER_PICK;
    processedPicks += 1;
    processedUserIds.add(String(pickData.userId));
  }

  if (opCount > 0) {
    await batch.commit();
  }

  const totalPicks = picksSnap.size;
  await writeRollupAuditDoc({
    db,
    admin,
    showDate,
    processedPicks,
    skippedPicks,
    totalPicks,
    callerUid,
    trigger,
    logger,
    manualTimingGate,
    tourAudit,
  });
  logger?.info?.("runRollupForShow", {
    showDate,
    trigger,
    processedPicks,
    skippedPicks,
    totalPicks,
    callerUid,
    tourKey: tourAudit.tourKey,
    tourKeyMissing: tourAudit.tourKeyMissing,
  });

  if (rollupPushHints.length > 0) {
    try {
      await sendPostShowRollupPush({
        db,
        admin,
        showDate,
        newGlobalMax,
        hints: rollupPushHints,
        logger,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.("runRollupForShow.postShowPush failed", {
        showDate,
        trigger,
        msg,
      });
    }
  }

  try {
    await deliverPostRollupComms({
      db,
      admin,
      showDate,
      picksSnap,
      newScoresById,
      tourKey,
      showDatesByTour,
      resendApiKey: process.env.RESEND_API_KEY,
      logger,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.warn?.("runRollupForShow.comms failed", { showDate, trigger, msg });
  }

  if (processedUserIds.size > 0) {
    try {
      await awardBadgesForUsers({
        db,
        admin,
        userIds: processedUserIds,
        showDate,
        logger,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.("runRollupForShow.badgeAwards failed", {
        showDate,
        trigger,
        msg,
      });
    }

    await rebuildGlobalStatsLeaderboardsSafe({
      db,
      admin,
      tourKey,
      trigger: "rollup",
      logger,
    });
  }

  await freezeSnapshotsSafe({
    db,
    admin,
    showDate,
    showDatesByTour,
    tourKey,
    logger,
  });

  return {
    processedPicks,
    skippedPicks,
    totalPicks,
    setlistExists: true,
  };
}

/**
 * Append-style audit write for every rollup invocation.
 *
 * Standalone top-level collection (not under `official_setlists`) so it never
 * re-triggers `gradePicksOnSetlistWrite`. Soft-fails so a transient audit
 * write failure never loses a successful grading pass.
 */
/**
 * Latest-run tour attribution for `rollup_audit/{showDate}` (#298).
 * `showDate` is repeated on the doc so operators do not have to infer it
 * from the document id. `tourKeyMissing: false` overwrites a prior `true`
 * when a later rollup resolves the key.
 *
 * @param {string} showDate
 * @param {string | null} tourKey
 * @returns {{ showDate: string, tourKey: string | null, tourKeyMissing: boolean }}
 */
function rollupAuditTourFields(showDate, tourKey) {
  const resolved = typeof tourKey === "string" && tourKey.trim() ? tourKey.trim() : null;
  return {
    showDate,
    tourKey: resolved,
    tourKeyMissing: resolved == null,
  };
}

async function writeRollupAuditDoc({
  db,
  admin,
  showDate,
  processedPicks,
  skippedPicks,
  totalPicks,
  callerUid,
  trigger,
  logger,
  manualTimingGate = null,
  tourAudit = null,
}) {
  try {
    const timingExtras =
      trigger === "manual" && manualTimingGate && typeof manualTimingGate === "object"
        ? {
            manualTimingReason: manualTimingGate.reason ?? null,
            showStatusAtManualFinalize: manualTimingGate.showStatus ?? null,
            forceEarlyFinalizeOverride:
              manualTimingGate.forceEarlyFinalizeOverride === true,
          }
        : {};
    const tourExtras =
      tourAudit && typeof tourAudit === "object" ? tourAudit : {};
    await db
      .collection("rollup_audit")
      .doc(showDate)
      .set(
        {
          lastRolledUpAt: admin.firestore.FieldValue.serverTimestamp(),
          processedPicks,
          skippedPicks,
          totalPicks,
          callerUid: callerUid || null,
          trigger: trigger || "manual",
          ...timingExtras,
          ...tourExtras,
        },
        { merge: true }
      );
  } catch (e) {
    const msg = e?.message || String(e);
    logger?.warn?.("runRollupForShow.auditWrite failed", {
      showDate,
      trigger,
      msg,
    });
  }
}

/**
 * Tour and year badge snapshots. A failure here must not undo the rollup.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   showDate: string,
 *   showDatesByTour: unknown,
 *   tourKey: string | null,
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 */
async function freezeSnapshotsSafe(params) {
  try {
    await freezeRankSnapshotsAfterShow(params);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    params.logger?.warn?.("runRollupForShow.rankSnapshots failed", {
      showDate: params.showDate,
      tourKey: params.tourKey,
      msg,
    });
  }
}

module.exports = {
  MAX_FIRESTORE_BATCH_WRITES,
  rollupAuditTourFields,
  runRollupForShow,
  writeRollupAuditDoc,
};
