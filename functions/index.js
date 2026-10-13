const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const {
  syncPhishnetShowCalendarToFirestore,
} = require("./phishnetShowCalendar");
const {
  syncPhishnetSongCatalogToStorage,
} = require("./phishnetSongCatalog");
const {
  syncPickRecommendationsToStorage,
} = require("./pickRecommendations");
const {
  syncRecommendationHistoryFromPhishnet,
  DEFAULT_HISTORY_YEARS,
} = require("./pickRecommendationsHistory");
const {
  candidateShowDates,
  parseShowCalendarSnapshotToShows,
  pollSingleShowDate,
  scheduledCandidateShowDates,
} = require("./phishnetLiveSetlistAutomation");
const {
  parseSuperAdminUidsEnv,
  resolveAdminCallerRole,
  resolveSetAdminClaimCallerRole,
} = require("./adminAuth");
const {
  MAX_POOL_DELETE_BATCH_WRITES,
  findPoolPickActivity,
  parseShowCalendarDates,
} = require("./poolDelete");
const {
  calculateTotalScore,
  persistableActualSetlistFromOfficialDoc,
  shouldSkipLiveScoreRecompute,
} = require("./scoringCore");
const { runBackfill } = require("./backfillBustoutsCore");
const { runRollupForShow } = require("./rollupCore");
const { runPicksLockReminderFanout } = require("./picksLockReminder");
const {
  deleteFcmTokenDocForRawToken,
  isInvalidOrUnregisteredToken,
  normalizeFcmSendMessageId,
} = require("./fcmMessagingCore");
const { applyRevertRollupForShow } = require("./revertRollupCore");
const { deliverSphere2026TourRecapInbox } = require("./sphereTourRecapDelivery");
const { deliverMarketingSummerTour2026Launch } = require("./marketingBatchDelivery");
const { deliverMarketingSummer2026AlmostEnd } = require("./marketingAlmostEndDelivery");
const { claimMarketingRun, finishMarketingRun } = require("./marketingRunLock");
const {
  CAMPAIGN_ID: ALMOST_END_CAMPAIGN_ID,
} = require("./marketingAlmostEndCore");
const { evaluateManualFinalizeTimingGate } = require("./showFinalizationGate");
const { applyLockPicksForShowNow } = require("./picksLockOverride");
const { runAccountDeletionForCaller } = require("./accountDelete");
const { deliverCommsTrigger, buildDefaultWorkers, mergeCommsDeliverySummaries } = require("./commsDelivery");
const { createCommsEmailWorker, buildResendClient } = require("./commsEmailWorker");
const { getTriggerSpec } = require("./commsCatalog");
const { tourCountdownDeliveryPlan } = require("./commsTemplates");
const { refreshPublicTourStats } = require("./publicTourStats");
const {
  rebuildGlobalStatsLeaderboards,
} = require("./globalStatsLeaderboards");
const {
  verifyResendWebhookPayload,
  handleResendWebhookEvent,
} = require("./commsResendWebhook");
const { handleResendInboundEvent } = require("./commsResendInboundWebhook");
const {
  processOneClickUnsubscribe,
  verifyOneClickUnsubscribeToken,
  renderUnsubscribeConfirmPage,
  renderUnsubscribeSuccessPage,
} = require("./commsEmailUnsubscribe");
const {
  getCommsEmailStatusForUser,
  resubscribeCommsEmailForUser,
  unsubscribeCommsEmailForUser,
} = require("./commsEmailPrefs");
const {
  handleAccountWelcome,
  handlePicksConfirmed,
  deliverLiveScoreComms,
  runScheduledTourCountdown,
  runScheduledTourRankingsDaily,
} = require("./commsEventAdapters");

const phishnetApiKey = defineSecret("PHISHNET_API_KEY");
// Resend transactional/marketing email (epic #441 / #442). Stored in Cloud Secret
// Manager; surfaced to bound functions as process.env.RESEND_API_KEY.
const resendApiKey = defineSecret("RESEND_API_KEY");
// Resend webhook signing secret (Svix) for bounce/complaint suppression (#442).
const resendWebhookSecret = defineSecret("RESEND_WEBHOOK_SECRET");
// Separate Svix secret for the inbound receiving webhook (one secret per Resend endpoint).
const resendInboundWebhookSecret = defineSecret("RESEND_INBOUND_WEBHOOK_SECRET");
// GA4 Measurement Protocol (#461). Measurement id is public (same as VITE_GA_MEASUREMENT_ID);
// API secret is created in GA4 Admin → Data streams → Measurement Protocol API secrets.
// Both surface as process.env for `commsGa4Measurement.js`. Unset → no-op send.
const ga4MeasurementId = defineString("GA4_MEASUREMENT_ID", { default: "" });
const ga4MpApiSecret = defineSecret("GA4_MP_API_SECRET");
// Keep the defineString in the module graph for deploy-time param discovery;
// runtime reads `process.env.GA4_MEASUREMENT_ID` inside `commsGa4Measurement.js`.
void ga4MeasurementId;

/** Secrets bound on every export that can call `deliverCommsTrigger`. */
const commsDeliverySecrets = [resendApiKey, resendWebhookSecret, ga4MpApiSecret];
/** Fan-out crons walk people one at a time. Match the other batch jobs so a one-minute cutoff cannot end a send. */
const COMMS_SCHEDULE_TIMEOUT_SECONDS = 300;

admin.initializeApp();
const db = admin.firestore();

function buildCommsEmailWorkerInstance() {
  return createCommsEmailWorker({
    resendClient: buildResendClient(process.env.RESEND_API_KEY, logger),
    db,
    admin,
    unsubscribeSigningSecret: process.env.RESEND_WEBHOOK_SECRET,
    logger,
  });
}

/**
 * Gate an admin-only callable on the `admin: true` custom claim (issue #139).
 * PR B dropped the legacy email fallback — the claim is the only signal. Use
 * `setAdminClaim` to grant the claim (bootstrap via `SUPER_ADMIN_UIDS`).
 */
function assertAdminClaim(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  if (!resolveAdminCallerRole(request.auth)) {
    throw new HttpsError(
      "permission-denied",
      "Only an admin can perform this action."
    );
  }
}

function assertShowDateString(showDate) {
  if (
    typeof showDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(showDate.trim())
  ) {
    throw new HttpsError(
      "invalid-argument",
      "showDate must be a YYYY-MM-DD string."
    );
  }
  return showDate.trim();
}

/** Firestore batch write limit (same invariant as `adminRollupApi.js` / `profileApi.js`). */
const MAX_FIRESTORE_BATCH_WRITES = 500;
const PHISHNET_FUNCTIONS_REGION = "us-central1";

async function recomputeLiveScoresForShow(showDate, actualSetlistFromWrite = null) {
  const actualSetlist =
    actualSetlistFromWrite ||
    (() => {
      throw new Error("actualSetlistFromWrite required when no Firestore fallback");
    })();
  const picksSnap = await db
    .collection("picks")
    .where("showDate", "==", showDate)
    .get();

  if (picksSnap.empty) {
    return { updatedPicks: 0 };
  }

  /** @type {Map<string, number>} */
  const beforeScores = new Map();
  /** @type {Map<string, number>} */
  const afterScores = new Map();

  let batch = db.batch();
  let opCount = 0;
  let updatedPicks = 0;

  for (const pickDoc of picksSnap.docs) {
    if (opCount >= MAX_FIRESTORE_BATCH_WRITES) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
    const pickData = pickDoc.data() || {};
    const userPicks = pickData.picks || {};
    const prevScore = typeof pickData.score === "number" ? pickData.score : 0;
    beforeScores.set(pickDoc.id, prevScore);
    const score = calculateTotalScore(userPicks, actualSetlist);
    afterScores.set(pickDoc.id, score);

    // Live scoring only: do not set gradedAt here (pool season uses isGraded from rollup).
    const update = { score };
    if (pickData.isGraded !== true) {
      update.gradedAt = admin.firestore.FieldValue.delete();
    }
    batch.update(pickDoc.ref, update);
    opCount += 1;
    updatedPicks += 1;
  }

  if (opCount > 0) {
    await batch.commit();
  }

  try {
    await deliverLiveScoreComms({
      db,
      admin,
      showDate,
      beforeScores,
      afterScores,
      picksSnap,
      resendApiKey: process.env.RESEND_API_KEY,
      logger,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("recomputeLiveScoresForShow.comms failed", { showDate, msg });
  }

  return { updatedPicks };
}

exports.gradePicksOnSetlistWrite = onDocumentWritten(
  {
    document: "official_setlists/{showDate}",
    region: PHISHNET_FUNCTIONS_REGION,
    memory: "512MiB",
    secrets: commsDeliverySecrets,
  },
  async (event) => {
    if (!event.data.after.exists) {
      return null;
    }

    const showDate = event.params.showDate;
    const setlistDoc = event.data.after.data() || {};
    const beforeDoc = event.data.before.exists ? event.data.before.data() || {} : null;

    // #416: skip full picks scan when playable scoring payload is unchanged
    // (metadata-only admin/Phish.net writes).
    if (shouldSkipLiveScoreRecompute(beforeDoc, setlistDoc)) {
      logger.info("gradePicksOnSetlistWrite skip: playable setlist unchanged", {
        showDate,
      });
      return { skipped: true, reason: "setlist_unchanged" };
    }

    const actualSetlist = persistableActualSetlistFromOfficialDoc(setlistDoc);
    const result = await recomputeLiveScoresForShow(showDate, actualSetlist);
    logger.info("gradePicksOnSetlistWrite complete", {
      showDate,
      updatedPicks: result?.updatedPicks ?? 0,
    });
    return result;
  }
);

/**
 * Event adapter: account_welcome (#440) — fires when `users/{uid}` gains a handle.
 * Gated by `COMMS_EVENT_ADAPTERS_ENABLED=true`.
 */
exports.commsOnUserProfileWrite = onDocumentWritten(
  {
    document: "users/{uid}",
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: commsDeliverySecrets,
  },
  async (event) => {
    if (!event.data?.after?.exists) return null;
    try {
      await handleAccountWelcome({
        db,
        admin,
        uid: event.params.uid,
        beforeData: event.data.before?.exists ? event.data.before.data() : null,
        afterData: event.data.after.data() || {},
        resendApiKey: process.env.RESEND_API_KEY,
        logger,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("commsOnUserProfileWrite failed", { uid: event.params.uid, msg });
    }
    return null;
  }
);

/**
 * Event adapter: picks_confirmed (#440) — fires on first pick doc create.
 * Gated by `COMMS_EVENT_ADAPTERS_ENABLED=true`.
 */
exports.commsOnPickWrite = onDocumentWritten(
  {
    document: "picks/{pickId}",
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: commsDeliverySecrets,
  },
  async (event) => {
    if (!event.data?.after?.exists) return null;
    try {
      await handlePicksConfirmed({
        db,
        admin,
        pickId: event.params.pickId,
        beforeExists: event.data.before?.exists === true,
        beforeData: event.data.before?.exists ? event.data.before.data() : null,
        afterData: event.data.after.data() || {},
        resendApiKey: process.env.RESEND_API_KEY,
        logger,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("commsOnPickWrite failed", { pickId: event.params.pickId, msg });
    }
    return null;
  }
);

exports.refreshLiveScoresForShow = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
    secrets: commsDeliverySecrets,
  },
  async (request) => {
    assertAdminClaim(request);
    const showDate = assertShowDateString(request.data?.showDate);

    const setlistSnap = await db
      .collection("official_setlists")
      .doc(showDate)
      .get();
    if (!setlistSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        `official_setlists/${showDate} does not exist. Save the setlist first.`
      );
    }
    const setlistDoc = setlistSnap.data() || {};
    const actualSetlist = persistableActualSetlistFromOfficialDoc(setlistDoc);
    const result = await recomputeLiveScoresForShow(showDate, actualSetlist);
    return { ok: true, ...result };
  }
);

/**
 * Admin ""Finalize and rollup"" for a show — server-side replacement for the
 * client batched writes in `src/features/admin/api/adminRollupApi.js` (#139).
 *
 * Reads `official_setlists/{showDate}`, loads the Storage song catalog once,
 * and for every `picks` doc with that `showDate`:
 *   - computes final `score` using the same path as `gradePicksOnSetlistWrite`
 *   - sets `isGraded: true` (with `gradedAt` on the first grade)
 *   - increments `users.totalPoints` by the score diff and `users.showsPlayed`
 *     by 1 on first-grade (mirrors the client batch exactly).
 *
 * Uses Admin SDK; rules don't apply here. This lets PR B tighten Firestore
 * rules on `picks` + `users` without breaking Finalize.
 */
exports.rollupScoresForShow = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
    secrets: commsDeliverySecrets,
  },
  async (request) => {
    assertAdminClaim(request);
    const showDate = assertShowDateString(request.data?.showDate);
    const callerUid = request.auth?.uid || null;
    const force = request.data?.force === true;

    const calSnap = await db.collection("show_calendar").doc("snapshot").get();
    const calendarShows = parseShowCalendarSnapshotToShows(
      calSnap.exists ? calSnap.data() : null
    );
    const autoSnap = await db
      .collection("live_setlist_automation")
      .doc(showDate)
      .get();
    const autoData = autoSnap.exists ? autoSnap.data() || {} : {};
    const autoFinalizedAt = autoData.autoFinalizedAt ?? null;

    const timingGate = evaluateManualFinalizeTimingGate({
      showDate,
      calendarShows,
      autoFinalizedAt,
      force,
    });
    if (!timingGate.allowed) {
      throw new HttpsError(
        "failed-precondition",
        timingGate.message ||
          "Show is not eligible for manual finalize yet. Pass force: true to override."
      );
    }

    const result = await runRollupForShow({
      db,
      admin,
      showDate,
      callerUid,
      trigger: "manual",
      logger,
      manualTimingGate: {
        reason: timingGate.reason,
        showStatus: timingGate.showStatus,
        forceEarlyFinalizeOverride: force === true,
      },
    });
    if (!result.setlistExists) {
      throw new HttpsError(
        "failed-precondition",
        `official_setlists/${showDate} does not exist. Save the setlist first.`
      );
    }
    if (result.hollowSetlist) {
      throw new HttpsError(
        "failed-precondition",
        "Official setlist has no songs in slots or ordered list. Add the show before finalizing."
      );
    }
    return {
      ok: true,
      processedPicks: result.processedPicks,
      skippedPicks: result.skippedPicks,
      totalPicks: result.totalPicks,
    };
  }
);

/**
 * Admin undo for a mistaken rollup (#320): reverse user materialization for
 * graded picks on `showDate`, reset picks to live-scored state from the
 * current `official_setlists` doc, merge audit fields on `rollup_audit`.
 */
exports.revertRollupForShow = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    assertAdminClaim(request);
    const showDate = assertShowDateString(request.data?.showDate);
    const callerUid = request.auth?.uid || null;
    const result = await applyRevertRollupForShow({
      db,
      admin,
      showDate,
      callerUid,
      logger,
    });
    if (!result.ok) {
      throw new HttpsError(
        "failed-precondition",
        result.message || "Revert is not allowed for this show date."
      );
    }
    return {
      ok: true,
      revertedPicks: result.revertedPicks,
      noop: result.noop === true,
    };
  }
);

/**
 * Admin-only: write Sphere ’26 inaugural recap rows to each player’s
 * `users/{uid}/commsInbox/sphere-2026-inaugural` using tour standings math
 * (same as dashboard tour leaderboard). Use `dryRun: true` first (#120).
 */
exports.deliverSphere2026TourRecapInbox = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    assertAdminClaim(request);
    const dryRun = request.data?.dryRun !== false;
    const forceResend = request.data?.forceResend === true;
    return deliverSphere2026TourRecapInbox({
      db,
      admin,
      dryRun,
      forceResend,
      logger,
    });
  }
);

/**
 * Admin-only batch send — Summer Tour 2026 pre-opener marketing email (#468).
 * Defaults to dryRun. Pass dryRun: false to send via Resend (email channel only).
 */
exports.deliverMarketingSummerTour2026Launch = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
    secrets: commsDeliverySecrets,
  },
  async (request) => {
    assertAdminClaim(request);
    const dryRun = request.data?.dryRun !== false;
    const forceResend = request.data?.forceResend === true;
    const onlyUids = Array.isArray(request.data?.onlyUids)
      ? request.data.onlyUids.map((u) => String(u).trim()).filter(Boolean)
      : undefined;
    return deliverMarketingSummerTour2026Launch({
      db,
      admin,
      dryRun,
      forceResend,
      onlyUids,
      resendApiKey: process.env.RESEND_API_KEY,
      resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
      logger,
    });
  }
);

/**
 * Admin-only batch — Summer 2026 almost-end (email players + forced inbox all users).
 * Defaults to dryRun. Pass dryRun: false to send.
 */
exports.deliverMarketingSummer2026AlmostEnd = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
    secrets: commsDeliverySecrets,
  },
  async (request) => {
    assertAdminClaim(request);
    const dryRun = request.data?.dryRun !== false;
    const forceResend = request.data?.forceResend === true;
    const onlyUids = Array.isArray(request.data?.onlyUids)
      ? request.data.onlyUids.map((u) => String(u).trim()).filter(Boolean)
      : undefined;
    return deliverMarketingSummer2026AlmostEnd({
      db,
      admin,
      dryRun,
      forceResend,
      onlyUids,
      resendApiKey: process.env.RESEND_API_KEY,
      resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
      logger,
    });
  }
);

/**
 * One-shot scheduled send — Summer 2026 almost-end at 08:00 America/Denver on 2026-08-03.
 * Uses Firestore run-lock `comms_marketing_runs/summer_2026_almost_end`.
 */
exports.scheduledMarketingSummer2026AlmostEnd = onSchedule(
  {
    schedule: "0 8 3 8 *",
    timeZone: "America/Denver",
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: commsDeliverySecrets,
  },
  async () => {
    const runId = ALMOST_END_CAMPAIGN_ID;
    const targetDate = "2026-08-03";
    try {
      const claim = await claimMarketingRun(db, admin, runId, { targetDate });
      if (!claim.claimed) {
        logger.info("scheduledMarketingSummer2026AlmostEnd skipped", claim);
        return null;
      }
      const result = await deliverMarketingSummer2026AlmostEnd({
        db,
        admin,
        dryRun: false,
        forceResend: false,
        resendApiKey: process.env.RESEND_API_KEY,
        resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
        logger,
      });
      await finishMarketingRun(db, admin, runId, result.ok !== false ? "completed" : "failed", {
        resultSummary: {
          ok: result.ok,
          inboxDelivered: result.inboxDelivered,
          emailCohortSize: result.emailCohortSize,
        },
      });
      logger.info("scheduledMarketingSummer2026AlmostEnd complete", {
        ok: result.ok,
        inboxDelivered: result.inboxDelivered,
        emailCohortSize: result.emailCohortSize,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("scheduledMarketingSummer2026AlmostEnd failed", { msg, err: e });
      try {
        await finishMarketingRun(db, admin, runId, "failed", { error: msg });
      } catch (finishErr) {
        logger.error("failed to mark almost-end run failed", { finishErr });
      }
    }
    return null;
  }
);

/**
 * Admin-only canary / replay entry point for the generalized comms delivery
 * orchestrator (epic #441 / #439). This is **not** the production path for v1
 * triggers (those fan out from their own event adapters) — it exists so the squad
 * can dry-run, canary, and replay any trigger for an explicit set of users through
 * the same prefs → dedup → fatigue → render → dispatch → log pipeline.
 *
 * Request: `{ triggerId, recipients: [{ uid, payload?, vars? }], dryRun?, forceResend? }`.
 * Defaults to `dryRun: true`. User prefs + email are hydrated from Firestore.
 */
exports.runCommsTrigger = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
    secrets: commsDeliverySecrets,
  },
  async (request) => {
    assertAdminClaim(request);
    const triggerId = String(request.data?.triggerId || "");
    const spec = getTriggerSpec(triggerId);
    if (!spec) {
      throw new HttpsError("invalid-argument", `Unknown triggerId: ${triggerId}`);
    }

    const dryRun = request.data?.dryRun !== false;
    const forceResend = request.data?.forceResend === true;
    // QA/canary-only: skips the #453 per-user daily email cap so an admin can
    // preview every template's real rendered email in one sitting. Never set
    // by the production event adapters — those always go through the default
    // (capped) path.
    const bypassDailyCap = request.data?.bypassDailyCap === true;
    const requested = Array.isArray(request.data?.recipients) ? request.data.recipients : [];
    if (requested.length === 0) {
      throw new HttpsError("invalid-argument", "recipients[] is required.");
    }

    // Hydrate user docs (prefs + email) for each recipient.
    const recipients = [];
    for (const r of requested) {
      const uid = typeof r?.uid === "string" ? r.uid.trim() : "";
      if (!uid) continue;
      // eslint-disable-next-line no-await-in-loop
      const snap = await db.collection("users").doc(uid).get();
      recipients.push({
        uid,
        userData: snap.exists ? snap.data() || {} : {},
        payload: r.payload && typeof r.payload === "object" ? r.payload : {},
        vars: r.vars && typeof r.vars === "object" ? r.vars : {},
      });
    }

    const emailWorker = buildCommsEmailWorkerInstance();
    const workers = buildDefaultWorkers({ emailWorker });
    const batches =
      triggerId === "tour_countdown" ? tourCountdownDeliveryPlan(recipients) : [{ recipients, channels: undefined }];
    const parts = [];
    for (const batch of batches) {
      // eslint-disable-next-line no-await-in-loop
      parts.push(
        await deliverCommsTrigger({
          db,
          admin,
          triggerId,
          recipients: batch.recipients,
          workers,
          dryRun,
          forceResend,
          bypassDailyCap,
          channels: batch.channels,
          logger,
        })
      );
    }
    return parts.length === 1 ? parts[0] : mergeCommsDeliverySummaries(parts);
  }
);

/**
 * Resend deliverability + engagement webhook (#442 / #512 Slice A).
 * Configure in Resend dashboard → Webhooks → endpoint URL for this function.
 * Events: `email.bounced`, `email.complained`, `email.suppressed`,
 * `email.opened`, `email.clicked`. Do **not** subscribe `email.received` here.
 * See docs/comms-triggers/RESEND_WEBHOOK.md.
 */
exports.commsResendWebhook = onRequest(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [resendWebhookSecret],
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const rawBody =
      typeof req.rawBody === "string"
        ? req.rawBody
        : req.rawBody instanceof Buffer
          ? req.rawBody.toString("utf8")
          : JSON.stringify(req.body || {});
    try {
      const event = verifyResendWebhookPayload(
        rawBody,
        req.headers,
        process.env.RESEND_WEBHOOK_SECRET
      );
      const eventId = req.headers["svix-id"] ? String(req.headers["svix-id"]) : null;
      const result = await handleResendWebhookEvent({
        db,
        admin,
        event,
        eventId,
        logger,
      });
      logger.info("commsResendWebhook processed", { type: event?.type, ...result });
      res.status(200).json({ ok: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn("commsResendWebhook rejected", { msg });
      res.status(400).send("Invalid webhook");
    }
  }
);

/**
 * Resend inbound receiving webhook. Allowlist `updates@` / `unsubscribe@` /
 * `support@` then wrap + `emails.send` to `support@road2media.com` (original
 * From + Reply-To). Other local-parts
 * return 200 without forwarding so Resend does not retry catch-all spam.
 * Subscribe **only** `email.received` on this URL.
 * See docs/comms-triggers/INBOUND_FORWARDING.md.
 */
exports.commsResendInboundWebhook = onRequest(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [resendApiKey, resendInboundWebhookSecret],
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const rawBody =
      typeof req.rawBody === "string"
        ? req.rawBody
        : req.rawBody instanceof Buffer
          ? req.rawBody.toString("utf8")
          : JSON.stringify(req.body || {});
    try {
      const event = verifyResendWebhookPayload(
        rawBody,
        req.headers,
        process.env.RESEND_INBOUND_WEBHOOK_SECRET
      );
      const eventId = req.headers["svix-id"] ? String(req.headers["svix-id"]) : null;
      const resend = buildResendClient(process.env.RESEND_API_KEY, logger);
      const result = await handleResendInboundEvent({
        event,
        eventId,
        resend,
        db,
        admin,
        logger,
      });
      logger.info("commsResendInboundWebhook processed", {
        type: event?.type,
        ...result,
      });
      res.status(200).json({ ok: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const code = error && typeof error === "object" ? error.code : null;
      const retryable =
        code === "inbound_forward_failed" ||
        code === "missing_resend_client" ||
        code === "resend_receiving_get_unavailable" ||
        code === "resend_send_unavailable";
      if (retryable) {
        logger.error("commsResendInboundWebhook forward failed", { msg, code });
        res.status(500).send("Inbound forward failed");
        return;
      }
      logger.warn("commsResendInboundWebhook rejected", { msg });
      res.status(400).send("Invalid webhook");
    }
  }
);

/**
 * RFC 8058 one-click unsubscribe for comms marketing/lifecycle email (#442).
 *
 * Method-gated by design (#456): mail clients honor `List-Unsubscribe-Post`
 * by issuing a real POST with no human interaction — that's the true
 * "one-click" action and suppresses immediately. A GET (the visible footer
 * link, or a link-scanner/antivirus gateway prefetching it) must NOT
 * suppress by itself, since scanners only ever issue GET/HEAD — it renders
 * a confirmation page requiring one explicit form submit (a real POST)
 * before anything is written to `email_suppression`.
 */
exports.commsEmailUnsubscribe = onRequest(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [resendWebhookSecret],
    invoker: "public",
  },
  async (req, res) => {
    const uid = String(req.query?.uid || "").trim();
    const email = String(req.query?.email || "").trim();
    const sig = String(req.query?.sig || "").trim();
    const signingSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (req.method === "POST") {
      const result = await processOneClickUnsubscribe({
        db,
        admin,
        uid,
        email,
        sig,
        signingSecret,
        logger,
      });
      if (!result.ok) {
        res.status(400).send("Invalid unsubscribe link");
        return;
      }
      res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(renderUnsubscribeSuccessPage());
      return;
    }

    if (req.method === "GET") {
      if (!verifyOneClickUnsubscribeToken({ uid, email, sig, signingSecret })) {
        res.status(400).send("Invalid unsubscribe link");
        return;
      }
      res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(renderUnsubscribeConfirmPage({ uid, email, sig }));
      return;
    }

    res.status(405).send("Method Not Allowed");
  }
);

/**
 * Read lifecycle email subscription status for the signed-in user (#455).
 * Clients cannot query `email_suppression` directly.
 */
exports.getCommsEmailStatus = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    return getCommsEmailStatusForUser(db, request.auth.uid);
  }
);

/**
 * Self-serve lifecycle email unsubscribe from Notifications preferences (#455).
 */
exports.unsubscribeCommsEmail = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const result = await unsubscribeCommsEmailForUser(db, admin, request.auth.uid);
    if (!result.ok) {
      throw new HttpsError("failed-precondition", result.reason || "unsubscribe_failed");
    }
    logger.info("comms_email_unsubscribed", {
      comms_channel: "email",
      uid: request.auth.uid,
      source: "notifications_preferences",
    });
    return { ok: true };
  }
);

/**
 * Clear a self-serve email suppression and re-enable lifecycle prefs (#455).
 * Only allowed for user-initiated reasons — not hard bounces or spam complaints.
 */
exports.resubscribeCommsEmail = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const result = await resubscribeCommsEmailForUser(db, admin, request.auth.uid);
    if (!result.ok) {
      throw new HttpsError("failed-precondition", result.reason || "resubscribe_failed");
    }
    logger.info("comms_email_resubscribed", {
      comms_channel: "email",
      uid: request.auth.uid,
      source: "notifications_preferences",
    });
    return { ok: true };
  }
);

/**
 * Grant or revoke the `admin: true` Firebase custom claim on a target user.
 *
 * Authorization rules (PR B — claim-only):
 *   - Caller must be signed in.
 *   - Caller must either already hold `admin: true`, **or** have a UID listed
 *     in the `SUPER_ADMIN_UIDS` env var (comma-separated). `SUPER_ADMIN_UIDS`
 *     is the bootstrap / break-glass path — required on a fresh project or
 *     after an accidental revocation removes the last admin claim holder.
 *
 * Caller can set the claim on their own UID (self-bootstrap) or on another
 * UID (delegate). The target user must refresh their ID token before the new
 * claim is visible to the client (`getIdTokenResult(true)`).
 */
exports.setAdminClaim = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const callerUid = request.auth.uid;
    const superAdminUids = parseSuperAdminUidsEnv();
    const role = resolveSetAdminClaimCallerRole(request.auth, superAdminUids);
    if (!role) {
      throw new HttpsError(
        "permission-denied",
        "Only a super-admin or existing admin can set admin claims."
      );
    }

    const rawTargetUid = request.data?.targetUid;
    const targetUid =
      typeof rawTargetUid === "string" && rawTargetUid.trim()
        ? rawTargetUid.trim()
        : callerUid;
    const grant = request.data?.admin;
    if (typeof grant !== "boolean") {
      throw new HttpsError(
        "invalid-argument",
        "`admin` must be a boolean (true to grant, false to revoke)."
      );
    }

    let existingClaims = {};
    try {
      const existing = await admin.auth().getUser(targetUid);
      existingClaims = existing.customClaims || {};
    } catch (e) {
      // Surface the real error instead of squashing everything to "not-found".
      // Expected firebase-admin error codes include `auth/user-not-found`,
      // `auth/insufficient-permission`, and generic network errors. We still
      // proceed to `setCustomUserClaims` for self-bootstrap so a transient
      // `getUser` permission hiccup doesn't block the first admin — the
      // caller's UID was already validated by the callable auth layer above.
      const code =
        typeof e?.code === "string" ? e.code : e?.errorInfo?.code || "unknown";
      const msg = e?.message || String(e);
      logger.warn("setAdminClaim.getUser failed", {
        targetUid,
        code,
        msg,
      });
      if (targetUid !== callerUid) {
        // Only fail hard when delegating to someone else — we can't be sure
        // the target really exists in that case.
        throw new HttpsError(
          code === "auth/insufficient-permission"
            ? "permission-denied"
            : "not-found",
          `Lookup failed for uid=${targetUid} (${code}): ${msg}`
        );
      }
    }
    const nextClaims = { ...existingClaims, admin: grant };
    if (!grant) {
      delete nextClaims.admin;
    }
    try {
      await admin.auth().setCustomUserClaims(targetUid, nextClaims);
    } catch (e) {
      const code =
        typeof e?.code === "string" ? e.code : e?.errorInfo?.code || "unknown";
      const msg = e?.message || String(e);
      logger.error("setAdminClaim.setCustomUserClaims failed", {
        targetUid,
        code,
        msg,
      });
      throw new HttpsError(
        code === "auth/insufficient-permission"
          ? "permission-denied"
          : "internal",
        `setCustomUserClaims failed for uid=${targetUid} (${code}): ${msg}`
      );
    }

    logger.info("setAdminClaim", {
      callerUid,
      targetUid,
      grant,
      callerRole: role,
    });

    return { ok: true, targetUid, admin: grant };
  }
);

/**
 * Send a canary push notification to the caller's most-recent registered FCM
 * token (issue #273). Intended for manual QA of web push plumbing.
 */
exports.sendPushCanary = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const callerUid = request.auth.uid;
    const explicitTokenRaw = request.data?.token;
    const explicitToken =
      typeof explicitTokenRaw === "string" ? explicitTokenRaw.trim() : "";
    if (!explicitToken) {
      throw new HttpsError(
        "failed-precondition",
        "No explicit FCM token provided by client. Re-enable push and retry canary in the same session."
      );
    }
    const token = explicitToken;
    let tokenDoc = null;
    const matchSnap = await db
      .collection("users")
      .doc(callerUid)
      .collection("private_fcmTokens")
      .where("token", "==", explicitToken)
      .limit(1)
      .get();
    tokenDoc = matchSnap.empty ? null : matchSnap.docs[0];

    const timestamp = new Date().toISOString();
    const tokenTail = token.slice(-12);
    try {
      const rawMessageId = await admin.messaging().send({
        token,
        notification: {
          title: "Setlist Pick Em",
          body: `Test notification delivered at ${timestamp}`,
        },
        data: {
          kind: "canary",
          sentAt: timestamp,
        },
        webpush: {
          fcmOptions: {
            link: "https://www.setlistpickem.com/dashboard/profile/notifications",
          },
        },
      });
      const messageId = normalizeFcmSendMessageId(rawMessageId);
      if (tokenDoc) {
        await tokenDoc.ref.set(
          {
            lastCanaryAt: admin.firestore.FieldValue.serverTimestamp(),
            lastCanaryMessageId: messageId,
          },
          { merge: true }
        );
      }
      return { ok: true, messageId };
    } catch (error) {
      const code =
        typeof error?.code === "string"
          ? error.code
          : error?.errorInfo?.code || "unknown";
      logger.error("sendPushCanary failed", {
        callerUid,
        tokenId: tokenDoc ? tokenDoc.id : "none",
        code,
        tokenTail,
      });
      if (isInvalidOrUnregisteredToken(code)) {
        await deleteFcmTokenDocForRawToken(db, callerUid, token).catch(() => {});
      }
      if (code === "messaging/mismatched-credential") {
        throw new HttpsError(
          "failed-precondition",
          "Push token credentials do not match the current Firebase sender configuration. Re-enable push to refresh this device token."
        );
      }
      throw new HttpsError(
        "internal",
        `Failed to send push canary (${code}).`
      );
    }
  }
);

/**
 * Server-side delete of a pool with full member cleanup (issue #138).
 *
 * Required because Firestore rules only let a user update their own `users`
 * doc — a pool owner cannot clear the pool id from every other member's
 * `users.pools` array from the client. Admin SDK bypasses rules; authz is
 * enforced here.
 *
 * Guarantees:
 *   - Caller must be signed in (`unauthenticated` otherwise).
 *   - Caller must match `pools/{poolId}.ownerId` (`permission-denied` otherwise).
 *   - Pool must have **no qualifying pick activity**; otherwise the client is
 *     told to archive instead (`failed-precondition`). Activity is the same
 *     rule as the client walk (`pickDocHasPoolActivity`) using
 *     `show_calendar/snapshot` as the authoritative date source.
 *   - Every member of `pools/{poolId}.members` has `poolId` removed from
 *     `users/{uid}.pools` via `FieldValue.arrayRemove`, then the pool doc
 *     is deleted in the same logical operation (batched; split at
 *     `MAX_POOL_DELETE_BATCH_WRITES`).
 *
 * NB: We intentionally re-walk the calendar server-side instead of trusting
 * a client-provided list, so a stale client can't bypass the activity guard.
 */
exports.deletePoolWithCleanup = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const callerUid = request.auth.uid;
    const rawPoolId = request.data?.poolId;
    const poolId =
      typeof rawPoolId === "string" && rawPoolId.trim() ? rawPoolId.trim() : "";
    if (!poolId) {
      throw new HttpsError("invalid-argument", "poolId is required.");
    }

    const poolRef = db.collection("pools").doc(poolId);
    const poolSnap = await poolRef.get();
    if (!poolSnap.exists) {
      throw new HttpsError("not-found", `Pool ${poolId} does not exist.`);
    }
    const poolData = poolSnap.data() || {};
    const ownerId =
      typeof poolData.ownerId === "string" ? poolData.ownerId.trim() : "";
    if (!ownerId || ownerId !== callerUid) {
      throw new HttpsError(
        "permission-denied",
        "Only the pool owner can delete this pool."
      );
    }

    const rawMembers = Array.isArray(poolData.members) ? poolData.members : [];
    const memberIds = [
      ...new Set(
        rawMembers
          .filter((u) => typeof u === "string" && u.trim())
          .map((u) => u.trim())
      ),
    ];
    if (!memberIds.includes(ownerId)) memberIds.push(ownerId);

    const calendarSnap = await db
      .collection("show_calendar")
      .doc("snapshot")
      .get();
    const showDates = parseShowCalendarDates(
      calendarSnap.exists ? calendarSnap.data() : null
    );

    const hasActivity = await findPoolPickActivity({
      db,
      poolId,
      memberIds,
      showDates,
      standingsScope:
        typeof poolData.standingsScope === "string"
          ? poolData.standingsScope
          : null,
      memberJoinedAt:
        poolData.memberJoinedAt &&
        typeof poolData.memberJoinedAt === "object" &&
        !Array.isArray(poolData.memberJoinedAt)
          ? poolData.memberJoinedAt
          : null,
    });
    if (hasActivity) {
      throw new HttpsError(
        "failed-precondition",
        "This pool has pick history. Archive it instead of deleting."
      );
    }

    // Split at the Firestore 500-write batch limit. Pool delete is its own
    // write, so we reserve one slot for it before committing.
    let batch = db.batch();
    let opCount = 0;
    let memberUpdates = 0;
    for (const uid of memberIds) {
      if (opCount >= MAX_POOL_DELETE_BATCH_WRITES) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
      batch.set(
        db.collection("users").doc(uid),
        { pools: admin.firestore.FieldValue.arrayRemove(poolId) },
        { merge: true }
      );
      opCount += 1;
      memberUpdates += 1;
    }
    if (opCount >= MAX_POOL_DELETE_BATCH_WRITES) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
    batch.delete(poolRef);
    opCount += 1;
    if (opCount > 0) await batch.commit();

    logger.info("deletePoolWithCleanup", {
      poolId,
      callerUid,
      memberUpdates,
    });

    return { ok: true, poolId, memberUpdates };
  }
);

/**
 * Self-serve account deletion (Terms of Service): gated confirmation on the client;
 * server writes `account_deletion_reports/{id}`, removes pool membership / picks /
 * user subcollections / profile doc, then deletes the Firebase Auth user.
 */
exports.deleteAccountWithAudit = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    return runAccountDeletionForCaller({
      db,
      admin,
      callerUid: request.auth.uid,
      requestData: request.data,
    });
  }
);

/**
 * Pre-lock pick reminders (issue #276): venue-local show day, T-3h–lock window,
 * deduped per user+show in `fcm_notification_log`.
 */
exports.scheduledPicksLockReminder = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "America/Los_Angeles",
    region: PHISHNET_FUNCTIONS_REGION,
    timeoutSeconds: COMMS_SCHEDULE_TIMEOUT_SECONDS,
    secrets: commsDeliverySecrets,
  },
  async () => {
    try {
      await runPicksLockReminderFanout({
        db,
        admin,
        logger,
        now: new Date(),
        resendApiKey: process.env.RESEND_API_KEY,
        resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("scheduledPicksLockReminder failed", { msg, err: e });
    }
    return null;
  }
);

/**
 * Scheduled tour countdown comms (#440) — daily check for T-10/T-5/T-3/T-1.
 * Gated by `COMMS_EVENT_ADAPTERS_ENABLED=true`.
 */
exports.scheduledTourCountdownComms = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "America/Los_Angeles",
    region: PHISHNET_FUNCTIONS_REGION,
    timeoutSeconds: COMMS_SCHEDULE_TIMEOUT_SECONDS,
    secrets: commsDeliverySecrets,
  },
  async () => {
    try {
      await runScheduledTourCountdown({
        db,
        admin,
        resendApiKey: process.env.RESEND_API_KEY,
        logger,
        now: new Date(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("scheduledTourCountdownComms failed", { msg, err: e });
    }
    return null;
  }
);

/**
 * Morning-after tour rankings comms (#440) + pending `tour_recap` (#510).
 * Tour recap waits until this 8am PT tick after the finale date (not night-of
 * rollup). Gated by `COMMS_EVENT_ADAPTERS_ENABLED=true`.
 */
exports.scheduledTourRankingsDailyComms = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "America/Los_Angeles",
    region: PHISHNET_FUNCTIONS_REGION,
    timeoutSeconds: COMMS_SCHEDULE_TIMEOUT_SECONDS,
    secrets: commsDeliverySecrets,
  },
  async () => {
    try {
      await runScheduledTourRankingsDaily({
        db,
        admin,
        resendApiKey: process.env.RESEND_API_KEY,
        logger,
        now: new Date(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("scheduledTourRankingsDailyComms failed", { msg, err: e });
    }
    return null;
  }
);

exports.scheduledPhishnetLiveSetlistPoll = onSchedule(
  {
    // Wake every 2m; in-window spacing vs Phish.net is enforced by per-date
    // `nextPollAt` (~90–150s jitter — issue #311).
    schedule: "*/2 * * * *",
    timeZone: "America/New_York",
    region: PHISHNET_FUNCTIONS_REGION,
    memory: "512MiB",
    secrets: [phishnetApiKey, ...commsDeliverySecrets],
  },
  async () => {
    const key = phishnetApiKey.value();
    if (!key || !String(key).trim()) {
      logger.error(
        "scheduledPhishnetLiveSetlistPoll: PHISHNET_API_KEY missing; skip poll."
      );
      return null;
    }
    const now = new Date();
    const calSnap = await db.collection("show_calendar").doc("snapshot").get();
    const calendarShows = parseShowCalendarSnapshotToShows(
      calSnap.exists ? calSnap.data() : null
    );
    if (!calendarShows) {
      logger.info(
        "scheduledPhishnetLiveSetlistPoll: show_calendar snapshot missing/empty; strict skip (no Phish.net)."
      );
      return null;
    }
    const dates = scheduledCandidateShowDates(now, calendarShows);
    if (!dates.length) {
      logger.info(
        "scheduledPhishnetLiveSetlistPoll: no show currently in local 4pm–4am window; skip."
      );
      return null;
    }
    const started = Date.now();
    const results = [];
    for (const showDate of dates) {
      const result = await pollSingleShowDate({
        db,
        admin,
        showDate,
        apiKey: String(key).trim(),
        logger,
        force: false,
        // Inject rollup core so the poller can auto-finalize + rollup
        // without going through the HTTPS callable path (#266). Only the
        // scheduled path gets this: admin "Poll Now" keeps full manual
        // control over finalize timing.
        runRollup: ({ showDate: sd, trigger }) =>
          runRollupForShow({
            db,
            admin,
            showDate: sd,
            callerUid: null,
            trigger,
            logger,
          }),
      });
      results.push(result);
    }
    logger.info("live setlist poll cycle", {
      dates,
      results,
      durationMs: Date.now() - started,
    });
    return null;
  }
);

exports.setLiveSetlistAutomationState = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    assertAdminClaim(request);
    const showDate = assertShowDateString(request.data?.showDate);
    const enabled = request.data?.enabled;
    if (typeof enabled !== "boolean") {
      throw new HttpsError("invalid-argument", "enabled must be boolean.");
    }
    await db
      .collection("live_setlist_automation")
      .doc(showDate)
      .set(
        {
          showDate,
          enabled,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: request.auth.token?.email ?? null,
          pausedAt: enabled
            ? admin.firestore.FieldValue.delete()
            : admin.firestore.FieldValue.serverTimestamp(),
          pausedBy: enabled
            ? admin.firestore.FieldValue.delete()
            : request.auth.token?.email ?? null,
        },
        { merge: true }
      );
    return { ok: true, showDate, enabled };
  }
);

exports.pollLiveSetlistNow = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey, ...commsDeliverySecrets],
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    assertAdminClaim(request);
    const key = phishnetApiKey.value();
    if (!key || !String(key).trim()) {
      throw new HttpsError(
        "failed-precondition",
        "Phish.net API key is not configured (set secret PHISHNET_API_KEY)."
      );
    }
    const explicitShowDate = request.data?.showDate;
    const dates =
      explicitShowDate == null
        ? candidateShowDates(new Date())
        : [assertShowDateString(explicitShowDate)];
    const started = Date.now();
    const results = [];
    for (const showDate of dates) {
      const result = await pollSingleShowDate({
        db,
        admin,
        showDate,
        apiKey: String(key).trim(),
        logger,
        force: true,
        requestorEmail: request.auth.token?.email ?? null,
      });
      if (result.changed) {
        const setlistSnap = await db.collection("official_setlists").doc(showDate).get();
        const setlistDoc = setlistSnap.data() || {};
        const actualSetlist = persistableActualSetlistFromOfficialDoc(setlistDoc);
        result.updatedPicks = (
          await recomputeLiveScoresForShow(showDate, actualSetlist)
        ).updatedPicks;
      }
      results.push(result);
    }
    logger.info("manual live setlist poll", {
      dates,
      results,
      durationMs: Date.now() - started,
    });
    return { ok: true, dates, results };
  }
);

/**
 * Admin-only: stamp `show_lock_state/{showDate}` so clients treat picks as locked (#522).
 * Idempotent — no setlist or scoring side effects.
 */
exports.lockPicksForShowNow = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    assertAdminClaim(request);
    const showDate = assertShowDateString(request.data?.showDate);
    return applyLockPicksForShowNow({
      db,
      admin,
      showDate,
      lockedBy: request.auth?.token?.email ?? null,
      logger,
    });
  }
);

/**
 * Secure proxy for Phish.net v5 setlists/showdate (epic #42, issue #146).
 * Secret: `PHISHNET_API_KEY` via `firebase functions:secrets:set PHISHNET_API_KEY`
 */
exports.getPhishnetSetlist = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey],
    // Gen 2 callables run on Cloud Run; without public invoker, browsers get CORS preflight failures
    // (no Access-Control-Allow-Origin) and FirebaseError: internal. Auth is still enforced in handler.
    invoker: "public",
    // Avoid App Check blocking admin fetch from localhost before debug tokens are registered.
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      assertAdminClaim(request);

      const showDate = request.data?.showDate;
      if (
        typeof showDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(showDate.trim())
      ) {
        throw new HttpsError(
          "invalid-argument",
          "showDate must be a YYYY-MM-DD string."
        );
      }

      const key = phishnetApiKey.value();
      if (!key || !String(key).trim()) {
        throw new HttpsError(
          "failed-precondition",
          "Phish.net API key is not configured (set secret PHISHNET_API_KEY)."
        );
      }

      const url = `https://api.phish.net/v5/setlists/showdate/${encodeURIComponent(
        showDate.trim()
      )}.json?apikey=${encodeURIComponent(String(key).trim())}`;

      let res;
      try {
        res = await fetch(url, { headers: { Accept: "application/json" } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error to Phish.net";
        // Use `unavailable` (not `internal`) so the client SDK forwards the message; `internal` is redacted.
        throw new HttpsError("unavailable", msg);
      }

      let bodyText;
      try {
        bodyText = await res.text();
      } catch (e) {
        throw new HttpsError(
          "unavailable",
          "Failed to read Phish.net response."
        );
      }

      if (!res.ok) {
        throw new HttpsError(
          "failed-precondition",
          `Phish.net HTTP ${res.status}: ${bodyText.slice(0, 240)}`
        );
      }

      let data;
      try {
        data = JSON.parse(bodyText);
      } catch {
        throw new HttpsError(
          "failed-precondition",
          "Phish.net returned non-JSON."
        );
      }

      // Phish.net: success is `error: false`, `0`, or `"0"`; numeric ≥1 (e.g. 2) = invalid key, etc.
      const apiErr = data && typeof data === "object" ? data.error : undefined;
      const phishNetOk =
        apiErr === undefined ||
        apiErr === null ||
        apiErr === false ||
        apiErr === 0 ||
        apiErr === "0";
      if (!phishNetOk) {
        const apiMsg =
          typeof data.error_message === "string"
            ? data.error_message
            : "Phish.net API error.";
        throw new HttpsError("failed-precondition", apiMsg);
      }

      return data;
    } catch (e) {
      if (e instanceof HttpsError) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("getPhishnetSetlist unexpected error", msg, e);
      // Map unexpected throws (e.g. secret/param) to a code whose message is not stripped client-side.
      throw new HttpsError(
        "failed-precondition",
        `getPhishnetSetlist failed: ${msg}`
      );
    }
  }
);

/**
 * Backfill `official_setlists/{showDate}.bustouts` for a batch of shows (#214).
 *
 * For each show date, this callable:
 *   1. Re-fetches the Phish.net setlist by showdate (rows include per-row
 *      pre-show `gap` — the definitional bustout metric).
 *   2. Derives `bustouts` from rows with `gap >= BUSTOUT_MIN_GAP`.
 *   3. Writes `bustouts` onto `official_setlists/{showDate}` via merge, which
 *      triggers `gradePicksOnSetlistWrite` → live-score recompute.
 *   4. When a show is graded (`isGraded: true` on any pick), also runs
 *      `rollupScoresForShow` semantics inline so `users.totalPoints` reconciles
 *      by the score delta.
 *
 * Safe to run multiple times — write is idempotent when the snapshot matches.
 *
 * Input: `{ showDates: string[] }` (each `YYYY-MM-DD`) OR `{ mode: "missing" }`
 * to scan `official_setlists` for docs missing `bustouts`.
 */
exports.backfillBustoutsForShows = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey],
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    assertAdminClaim(request);

    const key = phishnetApiKey.value();
    if (!key || !String(key).trim()) {
      throw new HttpsError(
        "failed-precondition",
        "Phish.net API key is not configured (set secret PHISHNET_API_KEY)."
      );
    }

    const explicitDates = request.data?.showDates;
    const mode = request.data?.mode === "missing" ? "missing" : undefined;
    if (
      !(Array.isArray(explicitDates) && explicitDates.length > 0) &&
      mode !== "missing"
    ) {
      throw new HttpsError(
        "invalid-argument",
        'Pass { showDates: ["YYYY-MM-DD", ...] } or { mode: "missing" }.'
      );
    }

    try {
      const { results } = await runBackfill({
        db,
        admin,
        logger,
        phishnetApiKey: key,
        showDates: Array.isArray(explicitDates) ? explicitDates : undefined,
        mode,
        updatedBy: request.auth?.token?.email || "backfill-bustouts",
      });
      logger.info("backfillBustoutsForShows callable complete", {
        callerUid: request.auth?.uid || null,
      });
      return { ok: true, results };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/^showDate must be a YYYY-MM-DD/.test(msg)) {
        throw new HttpsError("invalid-argument", msg);
      }
      throw e;
    }
  }
);

/**
 * Monthly sync: Phish.net v5 `shows/showyear/{year}` → Firestore `show_calendar/snapshot` (issue #160).
 * First of each month 6:00 America/New_York. Same secret as setlist proxy; key never sent to browsers.
 */
exports.scheduledPhishnetShowCalendar = onSchedule(
  {
    // Daily: new tour dates can publish at any point in the month. Phish.net
    // supplies canonical dates/tours; Phish.com enriches doors/show time.
    schedule: "0 6 * * *",
    timeZone: "America/New_York",
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey],
  },
  async () => {
    const key = phishnetApiKey.value();
    if (!key || !String(key).trim()) {
      logger.error(
        "scheduledPhishnetShowCalendar: PHISHNET_API_KEY missing; skip sync."
      );
      return null;
    }
    await syncPhishnetShowCalendarToFirestore(db, String(key).trim(), {
      logger,
    });
    try {
      await refreshPublicTourStats(db, {
        logger,
        phishnetApiKey: String(key).trim(),
      });
    } catch (err) {
      logger.error("scheduledPhishnetShowCalendar: public tour stats refresh failed", err);
    }
    return null;
  }
);

/**
 * Admin-only on-demand refresh of `show_calendar/snapshot` (issue #160).
 */
exports.refreshPhishnetShowCalendar = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey],
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      assertAdminClaim(request);

      const key = phishnetApiKey.value();
      if (!key || !String(key).trim()) {
        throw new HttpsError(
          "failed-precondition",
          "Phish.net API key is not configured (set secret PHISHNET_API_KEY)."
        );
      }

      const result = await syncPhishnetShowCalendarToFirestore(
        db,
        String(key).trim(),
        { logger }
      );
      let publicTourStats = null;
      try {
        publicTourStats = await refreshPublicTourStats(db, {
          logger,
          phishnetApiKey: String(key).trim(),
        });
      } catch (err) {
        logger.error("refreshPhishnetShowCalendar: public tour stats refresh failed", err);
      }
      return {
        ok: true,
        showCount: result.showCount,
        groupCount: result.groupCount,
        publicTourStats,
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("refreshPhishnetShowCalendar unexpected error", msg, e);
      throw new HttpsError(
        "failed-precondition",
        `refreshPhishnetShowCalendar failed: ${msg}`
      );
    }
  }
);

/**
 * Nightly rebuild of Global Stats leaderboard aggregates (#1004).
 * Catch-up for rollup-hook misses; Admin SDK scan of `users` only.
 */
exports.scheduledGlobalStatsLeaderboardsRefresh = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "America/New_York",
    region: PHISHNET_FUNCTIONS_REGION, // pragma: allowlist secret
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    await rebuildGlobalStatsLeaderboards({
      db,
      admin,
      allTours: true,
      trigger: "scheduled",
      logger,
    });
    return null;
  }
);

/**
 * Admin-only on-demand rebuild of Global Stats leaderboards (#1004).
 */
exports.refreshGlobalStatsLeaderboards = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION, // pragma: allowlist secret
    invoker: "public",
    enforceAppCheck: false,
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      assertAdminClaim(request);
      const result = await rebuildGlobalStatsLeaderboards({
        db,
        admin,
        allTours: true,
        trigger: "admin",
        logger,
      });
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("refreshGlobalStatsLeaderboards unexpected error", msg, e);
      throw new HttpsError(
        "failed-precondition",
        `refreshGlobalStatsLeaderboards failed: ${msg}`
      );
    }
  }
);

/**
 * Nightly rebuild of aggregate-only `public_tour_stats` docs (#665).
 * Also runs after calendar sync; this catch-up covers setlist-only updates.
 */
exports.scheduledPublicTourStatsRefresh = onSchedule(
  {
    schedule: "30 7 * * *",
    timeZone: "America/New_York",
    region: PHISHNET_FUNCTIONS_REGION,
    // #666: lifetime enrichment; refresh still succeeds unenriched if the
    // key is missing or phish.net is down. #709: per-song lastPlayed history
    // lookups (≤80 sequential phish.net calls) need more than the 60s default.
    timeoutSeconds: 300,
    secrets: [phishnetApiKey],
  },
  async () => {
    await refreshPublicTourStats(db, {
      logger,
      phishnetApiKey: String(phishnetApiKey.value() || "").trim(),
    });
    return null;
  }
);

/**
 * Admin-only on-demand rebuild of `public_tour_stats` (#665).
 */
exports.refreshPublicTourStats = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
    // #666: lifetime enrichment (best-effort inside the refresh).
    // #709: lastPlayed history lookups need more than the 60s default.
    timeoutSeconds: 300,
    secrets: [phishnetApiKey],
  },
  async (request) => {
    try {
      assertAdminClaim(request);
      const result = await refreshPublicTourStats(db, {
        logger,
        phishnetApiKey: String(phishnetApiKey.value() || "").trim(),
      });
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("refreshPublicTourStats unexpected error", msg, e);
      throw new HttpsError(
        "failed-precondition",
        `refreshPublicTourStats failed: ${msg}`
      );
    }
  }
);

/**
 * Sync Phish.net v5 `songs.json` → Storage `song-catalog.json` every 6h
 * (issue #158; freshness tightened in #261). Running at 00/06/12/18 ET keeps
 * autocomplete `gap` + `last_played` aligned with tonight's show by the time
 * users pick breakfast the next morning. Client-side localStorage TTL
 * (`SONG_CATALOG_CACHE_MAX_AGE_MS`) is intentionally kept at 6h so the two
 * freshness windows match. Same secret as other Phish.net callables.
 */
exports.scheduledPhishnetSongCatalog = onSchedule(
  {
    schedule: "0 */6 * * *",
    timeZone: "America/New_York",
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey],
  },
  async () => {
    const key = phishnetApiKey.value();
    if (!key || !String(key).trim()) {
      logger.error(
        "scheduledPhishnetSongCatalog: PHISHNET_API_KEY missing; skip sync."
      );
      return null;
    }
    try {
      const result = await syncPhishnetSongCatalogToStorage(
        String(key).trim(),
        { logger }
      );
      logger.info("scheduledPhishnetSongCatalog public URL", result.publicUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("scheduledPhishnetSongCatalog failed", msg, e);
    }
    return null;
  }
);

/**
 * Admin-only on-demand refresh of Storage `song-catalog.json` (issue #158).
 */
exports.refreshPhishnetSongCatalog = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey],
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      assertAdminClaim(request);

      const key = phishnetApiKey.value();
      if (!key || !String(key).trim()) {
        throw new HttpsError(
          "failed-precondition",
          "Phish.net API key is not configured (set secret PHISHNET_API_KEY)."
        );
      }

      const result = await syncPhishnetSongCatalogToStorage(
        String(key).trim(),
        { logger }
      );
      return {
        ok: true,
        songCount: result.songCount,
        publicUrl: result.publicUrl,
        archivePath: result.archivePath ?? null,
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("refreshPhishnetSongCatalog unexpected error", msg, e);
      throw new HttpsError(
        "failed-precondition",
        `refreshPhishnetSongCatalog failed: ${msg}`
      );
    }
  }
);

/**
 * Publish versioned `pick-recommendations.json` for the upcoming show (#650/#721).
 * Uses private Phish.net history window when present (merged with Firestore).
 */
exports.scheduledPickRecommendations = onSchedule(
  {
    schedule: "15 */6 * * *",
    timeZone: "America/New_York",
    region: PHISHNET_FUNCTIONS_REGION,
  },
  async () => {
    try {
      const result = await syncPickRecommendationsToStorage(admin.firestore(), {
        logger,
      });
      if (result.skipped) {
        logger.info("scheduledPickRecommendations skipped", result.reason);
      } else {
        logger.info(
          "scheduledPickRecommendations public URL",
          result.publicUrl,
          result.targetDate,
          result.historyShowCount,
          result.historySource
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("scheduledPickRecommendations failed", msg, e);
    }
    return null;
  }
);

/**
 * Daily refresh of private Phish.net recommendation history window (#721).
 * Does not write `official_setlists`. Full year backfill on first run; then incremental.
 */
exports.scheduledPickRecommendationHistory = onSchedule(
  {
    schedule: "40 4 * * *",
    timeZone: "America/New_York",
    region: PHISHNET_FUNCTIONS_REGION,
    secrets: [phishnetApiKey],
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    try {
      const key = phishnetApiKey.value();
      if (!key) {
        logger.warn(
          "scheduledPickRecommendationHistory: PHISHNET_API_KEY missing; skip"
        );
        return null;
      }
      const result = await syncRecommendationHistoryFromPhishnet({
        apiKey: key,
        years: DEFAULT_HISTORY_YEARS,
        logger,
      });
      logger.info("scheduledPickRecommendationHistory ok", result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("scheduledPickRecommendationHistory failed", msg, e);
    }
    return null;
  }
);

/**
 * Admin-only on-demand refresh of Storage `pick-recommendations.json` (#650).
 */
exports.refreshPickRecommendations = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      assertAdminClaim(request);
      const result = await syncPickRecommendationsToStorage(admin.firestore(), {
        logger,
      });
      return {
        ok: true,
        skipped: Boolean(result.skipped),
        reason: result.reason ?? null,
        targetDate: result.targetDate ?? null,
        modelVersion: result.modelVersion ?? null,
        historyShowCount: result.historyShowCount ?? null,
        historySource: result.historySource ?? null,
        publicUrl: result.publicUrl ?? null,
        archivePath: result.archivePath ?? null,
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("refreshPickRecommendations unexpected error", msg, e);
      throw new HttpsError(
        "failed-precondition",
        `refreshPickRecommendations failed: ${msg}`
      );
    }
  }
);

/**
 * Admin-only sync of private Phish.net recommendation history window (#721).
 * Optional `{ force: true }` re-fetches all dates in the window.
 */
exports.refreshPickRecommendationHistory = onCall(
  {
    region: PHISHNET_FUNCTIONS_REGION,
    invoker: "public",
    enforceAppCheck: false,
    secrets: [phishnetApiKey],
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
    try {
      assertAdminClaim(request);
      const key = phishnetApiKey.value();
      if (!key) {
        throw new HttpsError(
          "failed-precondition",
          "Phish.net API key is not configured (set secret PHISHNET_API_KEY)."
        );
      }
      const force = Boolean(request.data?.force);
      const years = Number(request.data?.years) || DEFAULT_HISTORY_YEARS;
      const result = await syncRecommendationHistoryFromPhishnet({
        apiKey: key,
        years,
        force,
        logger,
      });
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("refreshPickRecommendationHistory unexpected error", msg, e);
      throw new HttpsError(
        "failed-precondition",
        `refreshPickRecommendationHistory failed: ${msg}`
      );
    }
  }
);
