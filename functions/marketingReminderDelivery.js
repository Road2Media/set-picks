/**
 * Summer Tour 2026 marketing reminder — second wave to non-openers (#512 Slice B).
 *
 * Admin callable / CLI only. Dry-run by default. Does not schedule a send and
 * does not reuse the parent campaign dedup (`forceResend` here applies only
 * to `marketing:summer_tour_2026_reminder:{uid}`).
 */

"use strict";

const { deliverCommsTrigger, buildDefaultWorkers } = require("./commsDelivery");
const { createCommsEmailWorker, buildResendClient } = require("./commsEmailWorker");
const {
  DEFAULT_WAIT_HOURS,
  PARENT_CAMPAIGN_ID,
  resolveMarketingReminderAudience,
} = require("./marketingReminderAudience");

const TRIGGER_ID = "marketing_summer_tour_2026_reminder";
const CAMPAIGN_ID = "summer_tour_2026_reminder";
const TEMPLATE_ID = "summer-tour-2026-reminder";
const SITE_URL = "https://www.setlistpickem.com";

/**
 * @param {Record<string, unknown> | undefined} userData
 * @returns {string}
 */
function greetingFromUser(userData) {
  const handle = userData && typeof userData.handle === "string" ? userData.handle.trim() : "";
  return handle || "friend";
}

/**
 * @param {string} greetingName
 * @param {string} [openerLabel]
 * @returns {Record<string, string>}
 */
function buildReminderPayload(greetingName, openerLabel = "Tuesday, July 7") {
  const base = SITE_URL.replace(/\/+$/, "");
  return {
    greetingName,
    handle: greetingName,
    openerLabel,
    siteUrl: base,
    picksUrl: `${base}/dashboard/picks`,
    settingsUrl: `${base}/dashboard/profile/account`,
  };
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   dryRun?: boolean,
 *   forceResend?: boolean,
 *   onlyUids?: string[],
 *   waitHours?: number,
 *   now?: Date,
 *   parentCampaignId?: string,
 *   resolveParentCohort?: Function,
 *   resendApiKey?: string,
 *   resendWebhookSecret?: string,
 *   deliver?: typeof deliverCommsTrigger,
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 */
async function deliverMarketingSummerTour2026Reminder({
  db,
  admin,
  dryRun = true,
  forceResend = false,
  onlyUids,
  waitHours = DEFAULT_WAIT_HOURS,
  now,
  parentCampaignId = PARENT_CAMPAIGN_ID,
  resolveParentCohort,
  resendApiKey,
  resendWebhookSecret,
  deliver = deliverCommsTrigger,
  logger,
}) {
  const audience = await resolveMarketingReminderAudience(db, {
    parentCampaignId,
    waitHours,
    now,
    onlyUids,
    resolveParentCohort,
  });

  if (!audience.ok) {
    return {
      ok: false,
      dryRun,
      reason: audience.reason,
      triggerId: TRIGGER_ID,
      campaignId: CAMPAIGN_ID,
      parentCampaignId,
      cohortSize: 0,
      sendable: 0,
      excluded: audience.excluded,
    };
  }

  /** @type {Array<{ uid: string, segment: string, handle: string, email: string }>} */
  const preview = [];
  /** @type {Array<{ uid: string, userData: Record<string, unknown>, payload: Record<string, string>, vars: Record<string, string> }>} */
  const recipients = [];

  for (const member of audience.recipients) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("users").doc(member.uid).get();
    const userData = snap.exists ? snap.data() || {} : {};
    const greetingName = greetingFromUser(userData);
    preview.push({
      uid: member.uid,
      segment: member.segment,
      handle: greetingName,
      email: member.email,
    });
    recipients.push({
      uid: member.uid,
      userData,
      payload: buildReminderPayload(greetingName),
      vars: {
        uid: member.uid,
        campaignId: CAMPAIGN_ID,
      },
    });
  }

  const summary = {
    ok: true,
    dryRun,
    triggerId: TRIGGER_ID,
    templateId: TEMPLATE_ID,
    campaignId: CAMPAIGN_ID,
    parentCampaignId: audience.parentCampaignId,
    waitHours: audience.waitHours,
    cohortSize: audience.recipients.length,
    sendable: recipients.length,
    excluded: audience.excluded,
    onlyUids: Array.isArray(onlyUids) && onlyUids.length > 0 ? onlyUids : undefined,
    preview,
  };

  if (dryRun) return summary;

  const emailWorker = createCommsEmailWorker({
    resendClient: buildResendClient(resendApiKey, logger),
    db,
    admin,
    unsubscribeSigningSecret: resendWebhookSecret,
    logger,
  });

  const delivery = await deliver({
    db,
    admin,
    triggerId: TRIGGER_ID,
    recipients,
    workers: buildDefaultWorkers({ emailWorker }),
    dryRun: false,
    forceResend,
    bypassDailyCap: true,
    logger,
  });

  return {
    ...summary,
    dryRun: false,
    delivery,
    ok: delivery?.ok !== false,
  };
}

module.exports = {
  TRIGGER_ID,
  CAMPAIGN_ID,
  TEMPLATE_ID,
  PARENT_CAMPAIGN_ID,
  deliverMarketingSummerTour2026Reminder,
  buildReminderPayload,
};
