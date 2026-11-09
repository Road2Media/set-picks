/**
 * Non-opener cohort for a marketing reminder batch (#512 Slice B).
 *
 * Parent cohort minus people who opened the first send, minus suppressed
 * and unsubscribed addresses. Join is a point read:
 * `fcm_notification_log` (`resendEmailId`) → `comms_email_engagement/{id}`.
 * No collection scan. A human still triggers the send.
 */

"use strict";

const { resolveDedupKey } = require("./commsCatalog");
const { ENGAGEMENT_COLLECTION } = require("./commsEmailEngagement");
const { isEmailSuppressed } = require("./commsEmailSuppression");
const { resolveSummerTour2026LaunchAudience } = require("./marketingAudience");

const DEDUP_COLLECTION = "fcm_notification_log";
const PARENT_CAMPAIGN_ID = "summer_tour_2026";
const PARENT_TRIGGER_ID = "marketing_summer_tour_2026_launch";
const DEFAULT_WAIT_HOURS = 48;

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toMillis(value) {
  if (value == null) return null;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {boolean}
 */
function lifecycleOptedOut(userData) {
  const prefs = userData?.notificationPrefs;
  if (!prefs || typeof prefs !== "object") return false;
  return prefs.lifecycle === false;
}

/**
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {string | null}
 */
function emailFromUser(userData) {
  const email = userData && typeof userData.email === "string" ? userData.email.trim() : "";
  return email.includes("@") ? email : null;
}

/**
 * @param {Record<string, unknown> | null | undefined} log
 * @param {{ waitHours: number, nowMs: number }} clock
 * @returns {{ ok: true } | { ok: false, reason: "parent_not_delivered" | "wait_window" }}
 */
function parentSendAllowsReminder(log, clock) {
  if (!log || log.delivered !== true) {
    return { ok: false, reason: "parent_not_delivered" };
  }
  const channels = Array.isArray(log.channels) ? log.channels : null;
  if (channels && !channels.includes("email")) {
    return { ok: false, reason: "parent_not_delivered" };
  }
  if (!(clock.waitHours > 0)) return { ok: true };
  const sentMs = toMillis(log.decidedAt);
  if (sentMs == null) return { ok: false, reason: "wait_window" };
  const waitMs = clock.waitHours * 60 * 60 * 1000;
  if (clock.nowMs - sentMs < waitMs) return { ok: false, reason: "wait_window" };
  return { ok: true };
}

/**
 * @param {string} parentCampaignId
 * @param {((db: import("firebase-admin").firestore.Firestore) => Promise<Array<{ uid: string, segment?: string }>>)|undefined} resolveParentCohort
 */
function cohortLoaderFor(parentCampaignId, resolveParentCohort) {
  if (typeof resolveParentCohort === "function") return resolveParentCohort;
  if (parentCampaignId === PARENT_CAMPAIGN_ID) return resolveSummerTour2026LaunchAudience;
  return null;
}

function emptyExcluded() {
  return {
    opened: 0,
    suppressed: 0,
    unsubscribed: 0,
    noEmail: 0,
    waitWindow: 0,
    parentNotDelivered: 0,
  };
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {{
 *   parentCampaignId: string,
 *   waitHours?: number,
 *   now?: Date,
 *   onlyUids?: string[],
 *   resolveParentCohort?: (db: import("firebase-admin").firestore.Firestore) => Promise<Array<{ uid: string, segment?: string }>>,
 * }} options
 */
async function resolveMarketingReminderAudience(db, options = {}) {
  const parentCampaignId =
    typeof options.parentCampaignId === "string" ? options.parentCampaignId.trim() : "";
  const waitHours = Number.isFinite(options.waitHours) ? Number(options.waitHours) : DEFAULT_WAIT_HOURS;
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const excluded = emptyExcluded();
  const loadCohort = cohortLoaderFor(parentCampaignId, options.resolveParentCohort);

  if (!parentCampaignId || !loadCohort) {
    return {
      ok: false,
      reason: "unknown_parent_campaign",
      parentCampaignId,
      waitHours,
      recipients: [],
      excluded,
    };
  }

  const onlyUidSet =
    Array.isArray(options.onlyUids) && options.onlyUids.length > 0
      ? new Set(options.onlyUids.map((uid) => String(uid).trim()).filter(Boolean))
      : null;

  let cohort = await loadCohort(db);
  if (onlyUidSet) {
    cohort = cohort.filter((member) => onlyUidSet.has(member.uid));
  }

  /** @type {Array<{ uid: string, segment: string, email: string }>} */
  const recipients = [];

  for (const member of cohort) {
    const uid = String(member?.uid || "").trim();
    if (!uid) continue;
    const segment = typeof member.segment === "string" && member.segment ? member.segment : "sphere_alum";

    // eslint-disable-next-line no-await-in-loop
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const email = emailFromUser(userData);
    if (!email) {
      excluded.noEmail += 1;
      continue;
    }
    if (lifecycleOptedOut(userData)) {
      excluded.unsubscribed += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const suppressed = await isEmailSuppressed(db, email);
    if (suppressed) {
      excluded.suppressed += 1;
      continue;
    }

    const dedupId = resolveDedupKey(PARENT_TRIGGER_ID, { uid, campaignId: parentCampaignId });
    // eslint-disable-next-line no-await-in-loop
    const logSnap = dedupId ? await db.collection(DEDUP_COLLECTION).doc(dedupId).get() : { exists: false };
    const log = logSnap.exists ? logSnap.data() || {} : null;
    const gate = parentSendAllowsReminder(log, { waitHours, nowMs });
    if (!gate.ok) {
      if (gate.reason === "wait_window") excluded.waitWindow += 1;
      else excluded.parentNotDelivered += 1;
      continue;
    }

    const resendEmailId =
      log && typeof log.resendEmailId === "string" ? log.resendEmailId.trim() : "";
    if (resendEmailId) {
      // eslint-disable-next-line no-await-in-loop
      const engagement = await db.collection(ENGAGEMENT_COLLECTION).doc(resendEmailId).get();
      if (engagement.exists && engagement.data()?.openedAt) {
        excluded.opened += 1;
        continue;
      }
    }

    recipients.push({ uid, segment, email });
  }

  return {
    ok: true,
    parentCampaignId,
    parentTriggerId: PARENT_TRIGGER_ID,
    waitHours,
    recipients,
    excluded,
  };
}

module.exports = {
  DEDUP_COLLECTION,
  PARENT_CAMPAIGN_ID,
  PARENT_TRIGGER_ID,
  DEFAULT_WAIT_HOURS,
  resolveMarketingReminderAudience,
  parentSendAllowsReminder,
  lifecycleOptedOut,
};
