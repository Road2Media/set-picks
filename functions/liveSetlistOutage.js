/**
 * Live-setlist upstream outage policy (#644).
 *
 * Pure decisions plus Admin SDK side effects for:
 * - live-window backoff caps
 * - one-time super-admin inbox + email alerts
 * - a sanitized player status projection
 *
 * Operational alerts bypass the player lifecycle pipeline (prefs, fatigue,
 * `fcm_notification_log`). They are not catalog triggers.
 */

const PUBLIC_SERVICE_STATUS_COLLECTION = "public_service_status";
const OUTAGE_ALERT_FAILURE_THRESHOLD = 3;
const OUTAGE_ESCALATION_MS = 30 * 60 * 1000;
const LIVE_WINDOW_BACKOFF_CAP_MIN_MINUTES = 3;
const LIVE_WINDOW_BACKOFF_CAP_MAX_MINUTES = 5;
const OFF_WINDOW_BACKOFF_CAP_MINUTES = 30;
const PLAYER_STATUS_MESSAGE_KEY = "phishnet_stalled";
const OPS_INBOX_TEMPLATE_ID = "live-setlist-ops";
const OPS_FROM = "Setlist Pick'em <updates@setlistpickem.com>";

/** Approved player copy. Keep in sync with `src/features/scoring/model/liveSetlistServiceStatus.js`. */
const PLAYER_STATUS_MESSAGES = {
  phishnet_stalled:
    "Live setlist updates are delayed. Our Phish.net connection is temporarily stalled, so songs and scores may update more slowly than normal.",
};

/**
 * @param {unknown} message
 * @returns {string}
 */
function sanitizeUpstreamError(message) {
  let text = String(message ?? "unknown error");
  text = text.replace(/apikey=[^&\s]+/gi, "apikey=[redacted]");
  text = text.replace(/api_key=[^&\s]+/gi, "api_key=[redacted]");
  text = text.replace(/bearer\s+[a-z0-9._~+/-]+/gi, "bearer [redacted]");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) text = "upstream error";
  return text.slice(0, 240);
}

/**
 * Exponential backoff, capped at a jittered 3–5 minutes during the live
 * window and 30 minutes outside it.
 *
 * @param {{ failureCount: number, inLiveWindow: boolean, rng?: () => number }} args
 * @returns {number} delay in milliseconds
 */
function nextBackoffDelayMs({ failureCount, inLiveWindow, rng = Math.random }) {
  const n = Number.isFinite(failureCount) ? Math.max(1, failureCount) : 1;
  const exponentialMinutes = Math.min(2 ** (n - 1), OFF_WINDOW_BACKOFF_CAP_MINUTES);
  if (!inLiveWindow) return exponentialMinutes * 60_000;
  const span =
    LIVE_WINDOW_BACKOFF_CAP_MAX_MINUTES - LIVE_WINDOW_BACKOFF_CAP_MIN_MINUTES + 1;
  const rawRoll = typeof rng === "function" ? rng() : Math.random();
  const roll = Number.isFinite(rawRoll) ? rawRoll : Math.random();
  const cappedRoll = Math.min(0.999999, Math.max(0, roll));
  const capMinutes =
    LIVE_WINDOW_BACKOFF_CAP_MIN_MINUTES + Math.floor(cappedRoll * span);
  return Math.min(exponentialMinutes, capMinutes) * 60_000;
}

/**
 * @param {unknown} ts
 * @returns {number | null}
 */
function timestampMillis(ts) {
  if (!ts) return null;
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  if (typeof ts.toMillis === "function") {
    try {
      const ms = ts.toMillis();
      return Number.isFinite(ms) ? ms : null;
    } catch {
      return null;
    }
  }
  if (typeof ts._millis === "number") return ts._millis;
  if (typeof ts.seconds === "number") {
    return ts.seconds * 1000;
  }
  return null;
}

/**
 * @param {string} showDate
 * @returns {string}
 */
function publicServiceStatusDocId(showDate) {
  return `live-setlist-${showDate}`;
}

/**
 * @param {string} showDate
 * @param {string | number} bucket
 * @param {"outage" | "escalation" | "recovery"} kind
 * @returns {string}
 */
function opsMessageId(showDate, bucket, kind) {
  return `live_setlist_polling_${showDate}_${bucket}_${kind}`.slice(0, 700);
}

/**
 * @param {Record<string, unknown> | null | undefined} automation
 * @returns {boolean}
 */
function isOpenOutage(automation) {
  return Boolean(automation?.outageStartedAt) && !automation?.recoveredAt;
}

/**
 * @param {{
 *   automation?: Record<string, unknown>,
 *   failureCount: number,
 *   inLiveWindow: boolean,
 *   nowMs: number,
 *   showDate: string,
 * }} args
 */
function planUpstreamFailure({
  automation = {},
  failureCount,
  inLiveWindow,
  nowMs,
  showDate,
}) {
  const open = isOpenOutage(automation);
  const existingStart = open ? timestampMillis(automation.outageStartedAt) : null;
  const outageStartedAtMs = existingStart != null ? existingStart : nowMs;
  const alreadyAlerted = open && Boolean(automation.outageAlertedAt);
  const alreadyEscalated = open && Boolean(automation.outageEscalatedAt);
  const elapsed = nowMs - outageStartedAtMs;
  const sendInitial =
    Boolean(inLiveWindow) &&
    failureCount >= OUTAGE_ALERT_FAILURE_THRESHOLD &&
    !alreadyAlerted;
  const sendEscalation =
    Boolean(inLiveWindow) &&
    alreadyAlerted &&
    !alreadyEscalated &&
    elapsed >= OUTAGE_ESCALATION_MS;
  const bucket = String(outageStartedAtMs);
  return {
    outageStartedAtMs,
    resetIncident: !open,
    sendInitial,
    sendEscalation,
    publishDegraded:
      Boolean(inLiveWindow) && failureCount >= OUTAGE_ALERT_FAILURE_THRESHOLD,
    bucket,
    outageMessageId: opsMessageId(showDate, bucket, "outage"),
    escalationMessageId: opsMessageId(showDate, bucket, "escalation"),
  };
}

/**
 * @param {{ automation?: Record<string, unknown>, showDate: string }} args
 */
function planUpstreamSuccess({ automation = {}, showDate }) {
  const alerted = Boolean(automation.outageAlertedAt);
  const alreadyRecoveredAlert = Boolean(automation.recoveryAlertedAt);
  const sendRecovery = alerted && !alreadyRecoveredAlert;
  const bucket = String(timestampMillis(automation.outageStartedAt) ?? "unknown");
  const archiveError =
    typeof automation.lastError === "string" && automation.lastError.trim()
      ? automation.lastError
      : "";
  return {
    sendRecovery,
    clearUnalertedOutage: Boolean(automation.outageStartedAt) && !alerted,
    archiveError,
    bucket,
    recoveryMessageId: opsMessageId(showDate, bucket, "recovery"),
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} existing
 * @returns {{ action: "keep" } | { action: "degrade" } | { action: "resolve", activatedBy: string }}
 */
function planPublicStatusOnFailure(existing) {
  if (existing && existing.status === "degraded") return { action: "keep" };
  return { action: "degrade" };
}

/**
 * @param {Record<string, unknown> | null | undefined} existing
 * @returns {{ action: "keep" } | { action: "resolve", activatedBy: string }}
 */
function planPublicStatusOnSuccess(existing) {
  if (!existing || existing.status !== "degraded") return { action: "keep" };
  const activatedBy =
    existing.activatedBy === "admin" || existing.activatedBy === "automation"
      ? existing.activatedBy
      : "automation";
  if (activatedBy === "automation" || existing.clearOnRecovery === true) {
    return { action: "resolve", activatedBy };
  }
  return { action: "keep" };
}

/**
 * @param {unknown} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return "less than a minute";
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * @param {Record<string, unknown>} event
 * @returns {{ subject: string, text: string }}
 */
function buildOpsAlertContent(event) {
  const showDate = String(event.showDate || "");
  if (event.kind === "recovery") {
    const picks =
      typeof event.updatedPicks === "number" ? String(event.updatedPicks) : "n/a";
    const text = [
      "Live setlist polling recovered.",
      `Show date: ${showDate}`,
      `Downtime: ${formatDuration(event.downtimeMs)}`,
      `Last error count: ${event.failureCount ?? "unknown"}`,
      `Setlist changed: ${event.changed ? "yes" : "no"}`,
      `Picks refreshed: ${picks}`,
      "Normal cadence resumed.",
    ].join("\n");
    return {
      subject: `Live setlist polling recovered (${showDate})`,
      text,
    };
  }
  const escalated = event.kind === "escalation";
  const text = [
    escalated
      ? "Live setlist polling has been unhealthy for at least 30 minutes."
      : "Live setlist polling is unhealthy after 3 consecutive upstream failures.",
    `Show date: ${showDate}`,
    "Upstream: Phish.net",
    `Error: ${sanitizeUpstreamError(event.sanitizedError || "")}`,
    `Consecutive failures: ${event.failureCount ?? "unknown"}`,
    `First failure: ${event.firstFailureAt || "unknown"}`,
    `Last failure: ${event.lastFailureAt || "unknown"}`,
    `Next poll: ${event.nextPollAt || "unknown"}`,
    "Use War Room manual save / Force poll.",
  ].join("\n");
  return {
    subject: escalated
      ? `Live setlist polling still down (${showDate})`
      : `Live setlist polling stalled (${showDate})`,
    text,
  };
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
function parseOpsAlertEmails(env = process.env) {
  const raw = env.LIVE_SETLIST_OPS_ALERT_EMAILS;
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.includes("@") && !part.includes(" "));
}

/**
 * @param {Record<string, unknown> | null | undefined} existing
 * @param {"success" | "failure"} phase
 */
function planPublicStatus(existing, phase) {
  return phase === "failure"
    ? planPublicStatusOnFailure(existing)
    : planPublicStatusOnSuccess(existing);
}

/**
 * @param {{
 *   db: { collection: Function },
 *   admin: { firestore: { FieldValue: { serverTimestamp: Function, delete: Function } } },
 *   logger?: { info?: Function, error?: Function },
 *   showDate: string,
 *   phase: "success" | "failure",
 * }} args
 */
async function syncLiveSetlistPublicStatus({ db, admin, logger, showDate, phase }) {
  const ref = db.collection(PUBLIC_SERVICE_STATUS_COLLECTION).doc(
    publicServiceStatusDocId(showDate)
  );
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() || {} : null;
  const plan = planPublicStatus(existing, phase);
  if (plan.action === "keep") return plan;

  if (plan.action === "degrade") {
    const message = PLAYER_STATUS_MESSAGES[PLAYER_STATUS_MESSAGE_KEY];
    await ref.set(
      {
        service: "live_setlist",
        showDate,
        status: "degraded",
        messageKey: PLAYER_STATUS_MESSAGE_KEY,
        message,
        activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        activatedBy: "automation",
        clearOnRecovery: true,
        resolvedAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return plan;
  }

  await ref.set(
    {
      service: "live_setlist",
      showDate,
      status: "operational",
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  logger?.info?.("live_setlist_degraded_banner_cleared", {
    show_date: showDate,
    activated_by: plan.activatedBy,
  });
  return plan;
}

/**
 * @param {{
 *   db: { collection: Function },
 *   admin: { firestore: { FieldValue: { serverTimestamp: Function, delete: Function } } },
 *   showDate: string,
 *   action: "publish" | "clear",
 *   messageKey?: string,
 *   clearOnRecovery?: boolean,
 * }} args
 */
async function applyLiveSetlistServiceStatusCommand({
  db,
  admin,
  showDate,
  action,
  messageKey,
  clearOnRecovery,
}) {
  const ref = db.collection(PUBLIC_SERVICE_STATUS_COLLECTION).doc(
    publicServiceStatusDocId(showDate)
  );
  if (action === "clear") {
    await ref.set(
      {
        service: "live_setlist",
        showDate,
        status: "operational",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true, showDate, status: "operational" };
  }
  if (action !== "publish") {
    throw new Error("action must be publish or clear.");
  }
  const key = typeof messageKey === "string" ? messageKey : "";
  const message = PLAYER_STATUS_MESSAGES[key];
  if (!message) {
    throw new Error("unknown messageKey.");
  }
  await ref.set(
    {
      service: "live_setlist",
      showDate,
      status: "degraded",
      messageKey: key,
      message,
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      activatedBy: "admin",
      clearOnRecovery: clearOnRecovery === true,
      resolvedAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return {
    ok: true,
    showDate,
    status: "degraded",
    messageKey: key,
    clearOnRecovery: clearOnRecovery === true,
  };
}

/**
 * One inbox doc + one email per recipient. A second call with the same
 * message id does not send again.
 *
 * @param {{
 *   db: { collection: Function },
 *   admin: { firestore: { FieldValue: { serverTimestamp: Function } } },
 *   logger?: { info?: Function, warn?: Function, error?: Function },
 *   resendClient?: { emails: { send: Function } } | null,
 *   superAdminUids?: string[],
 *   extraEmails?: string[],
 *   event: Record<string, unknown>,
 * }} args
 */
async function deliverLiveSetlistOpsAlert({
  db,
  admin,
  logger,
  resendClient = null,
  superAdminUids = [],
  extraEmails = [],
  event,
}) {
  const messageId = typeof event.messageId === "string" ? event.messageId : "";
  if (!messageId) return { ok: false, skipReason: "missing_message_id" };

  const claimRef = db.collection("live_setlist_ops_alerts").doc(messageId);
  const claimPayload = {
    messageId,
    kind: event.kind || "",
    showDate: event.showDate || "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  let claimed = false;
  if (typeof db.runTransaction === "function") {
    claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(claimRef);
      if (snap.exists) return false;
      tx.set(claimRef, claimPayload);
      return true;
    });
  } else {
    const existingClaim = await claimRef.get();
    if (!existingClaim.exists) {
      await claimRef.set(claimPayload);
      claimed = true;
    }
  }
  if (!claimed) {
    return { ok: true, skipped: true, inboxWrites: 0, emailsSent: 0 };
  }

  const content = buildOpsAlertContent(event);
  const html = `<p>${escapeHtml(content.text).replace(/\n/g, "<br/>")}</p>`;
  /** @type {Set<string>} */
  const emails = new Set(
    (extraEmails || [])
      .map((value) => String(value || "").trim())
      .filter((value) => value.includes("@"))
  );
  let inboxWrites = 0;
  for (const uid of superAdminUids || []) {
    if (!uid) continue;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const email =
      userSnap.exists && typeof userSnap.data()?.email === "string"
        ? userSnap.data().email.trim()
        : "";
    if (email.includes("@")) emails.add(email);
    const inboxRef = userRef.collection("commsInbox").doc(messageId);
    const existing = await inboxRef.get();
    if (existing.exists) continue;
    await inboxRef.set({
      templateId: OPS_INBOX_TEMPLATE_ID,
      triggerId: "live_setlist_ops",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      payload: {
        title: content.subject,
        body: content.text,
        showDate: event.showDate || "",
        kind: event.kind || "",
      },
    });
    inboxWrites += 1;
  }

  let emailsSent = 0;
  if (resendClient?.emails?.send) {
    for (const to of emails) {
      try {
        const result = await resendClient.emails.send(
          {
            from: OPS_FROM,
            to: [to],
            subject: content.subject,
            text: content.text,
            html,
          },
          { idempotencyKey: `${messageId}:${to}` }
        );
        if (result?.error) {
          logger?.warn?.("live setlist ops email failed", {
            showDate: event.showDate,
            kind: event.kind,
            error: result.error?.message || String(result.error),
          });
          continue;
        }
        emailsSent += 1;
      } catch (error) {
        logger?.warn?.("live setlist ops email threw", {
          showDate: event.showDate,
          kind: event.kind,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  logger?.info?.("live setlist ops alert", {
    showDate: event.showDate,
    kind: event.kind,
    inboxWrites,
    emailsSent,
  });
  return { ok: true, inboxWrites, emailsSent };
}

module.exports = {
  LIVE_WINDOW_BACKOFF_CAP_MAX_MINUTES,
  LIVE_WINDOW_BACKOFF_CAP_MIN_MINUTES,
  OFF_WINDOW_BACKOFF_CAP_MINUTES,
  OPS_INBOX_TEMPLATE_ID,
  OUTAGE_ALERT_FAILURE_THRESHOLD,
  OUTAGE_ESCALATION_MS,
  PLAYER_STATUS_MESSAGE_KEY,
  PLAYER_STATUS_MESSAGES,
  PUBLIC_SERVICE_STATUS_COLLECTION,
  applyLiveSetlistServiceStatusCommand,
  buildOpsAlertContent,
  deliverLiveSetlistOpsAlert,
  nextBackoffDelayMs,
  opsMessageId,
  parseOpsAlertEmails,
  planPublicStatusOnFailure,
  planPublicStatusOnSuccess,
  planUpstreamFailure,
  planUpstreamSuccess,
  publicServiceStatusDocId,
  sanitizeUpstreamError,
  syncLiveSetlistPublicStatus,
};
