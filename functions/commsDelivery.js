/**
 * Comms delivery orchestrator (DELIVER layer, epic #441 / #439).
 *
 * One shared fan-out for every trigger. Each trigger contributes only a resolver
 * (audience + payload + dedup vars); the orchestrator owns the uniform path:
 *
 *   prefs gate → dedup → fatigue cap → render → dispatch (inApp/push/email) → log
 *
 * Channel workers are injected and idempotent, so this module is pure and unit
 * testable with fakes (no emulator). Dedup uses one `fcm_notification_log` doc per
 * (trigger, scope) so all channels share a single idempotency record — and so it
 * needs no `firestore.rules` change (that collection is already server-only).
 */

"use strict";

const { getTriggerSpec, resolveDedupKey } = require("./commsCatalog");
const { renderCommsTemplate } = require("./commsTemplates");
const { deliverCommsInbox } = require("./commsInboxWorker");
const { deliverCommsPush } = require("./commsPushWorker");
const { sendCommsDeliveredEvent } = require("./commsGa4Measurement");
const { sanitizeFactLabel } = require("./commsFactLabel");

const DEDUP_COLLECTION = "fcm_notification_log";
const DEFAULT_FATIGUE_CAP = 2; // max comms per user per delivery run (FRAMEWORK §OPTIMIZE)

/**
 * Resolve a single notification preference, mirroring the client resolver in
 * `src/features/notifications/api/notificationPrefsApi.js`:
 *  - `commercial` is default-deny (explicit `true` to opt in)
 *  - everything else is default-allow (explicit `false` to opt out)
 *
 * @param {Record<string, any> | null | undefined} userData
 * @param {string} key
 * @returns {boolean}
 */
function prefAllows(userData, key) {
  const prefs = userData?.notificationPrefs;
  const raw = prefs && typeof prefs === "object" ? prefs[key] : undefined;
  if (key === "commercial") return raw === true;
  return raw !== false;
}

/**
 * A recipient is eligible only if every `prefKey` the trigger declares allows it.
 *
 * @param {Record<string, any> | null | undefined} userData
 * @param {string[]} prefKeys
 */
function recipientAllowsTrigger(userData, prefKeys) {
  if (!Array.isArray(prefKeys) || prefKeys.length === 0) return true;
  return prefKeys.every((key) => prefAllows(userData, key));
}

/**
 * Channel-aware prefs gate. Transactional email bypasses prefKeys (still subject to
 * `email_suppression` in the email worker). Push/in-app always honor prefKeys.
 *
 * @param {Record<string, any> | null | undefined} userData
 * @param {import("./commsCatalog").TriggerSpec} spec
 * @param {string} channel
 */
function recipientAllowsChannel(userData, spec, channel) {
  const emailClass = spec.emailClass || "lifecycle";
  if (channel === "email" && emailClass === "transactional") {
    return true;
  }
  return recipientAllowsTrigger(userData, spec.prefKeys);
}

/**
 * One person inside a fan-out. Throws are caught by the caller so the next person still runs.
 *
 * @param {object} params
 */
async function deliverOneCommsRecipient({
  db,
  admin,
  spec,
  triggerId,
  recipient,
  uid,
  activeChannels,
  workers,
  dryRun,
  forceResend,
  bypassDailyCap,
  fatigueCap,
  variant,
  perUserCount,
  summary,
  bumpSkip,
  logger,
  sendGa4Delivered,
}) {
  const userData = recipient.userData || {};

  if ((perUserCount.get(uid) || 0) >= fatigueCap) {
    bumpSkip("fatigue_cap");
    summary.results.push({ uid, status: "skipped", reason: "fatigue_cap" });
    return;
  }

  const vars = { uid, ...(recipient.vars || {}) };
  const dedupId = resolveDedupKey(triggerId, vars);
  const dedupRef = dedupId ? db.collection(DEDUP_COLLECTION).doc(dedupId) : null;

  if (dedupRef && !forceResend) {
    const existing = await dedupRef.get();
    if (existing.exists) {
      bumpSkip("deduped");
      summary.results.push({ uid, status: "skipped", reason: "deduped", dedupId });
      return;
    }
  }

  const factLabel = sanitizeFactLabel(recipient.payload?.fact_label);
  const payload = { ...(recipient.payload || {}) };
  if (factLabel) payload.fact_label = factLabel;
  else delete payload.fact_label;
  const rendered = await renderCommsTemplate(spec.templateId, payload);

  const campaignId =
    typeof vars.campaignId === "string" && vars.campaignId.trim()
      ? vars.campaignId.trim()
      : null;

  const ctxBase = {
    db,
    admin,
    uid,
    userData,
    triggerId,
    rendered,
    dedupId,
    dryRun,
    forceResend,
    bypassDailyCap,
    campaignId,
    logger,
  };

  const deliveredChannels = [];
  const channelResults = {};
  for (const channel of activeChannels) {
    const worker = workers[channel];
    if (typeof worker !== "function") {
      channelResults[channel] = { ok: false, skipReason: "no_worker" };
      continue;
    }
    if (!recipientAllowsChannel(userData, spec, channel)) {
      channelResults[channel] = { ok: false, skipReason: "prefs_off" };
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const res = await worker(ctxBase);
    channelResults[channel] = res;
    if (res?.ok && res.skipReason !== "dry_run") {
      deliveredChannels.push(channel);
      summary.byChannel[channel] = (summary.byChannel[channel] || 0) + 1;
      logger?.info?.("comms_delivered", {
        comms_trigger_id: triggerId,
        comms_template_id: spec.templateId,
        comms_channel: channel,
        comms_variant: variant,
        uid,
      });
      // Await MP so the request stays alive until the POST finishes.
      // Fire-and-forget is unsafe on Cloud Functions (instance freezes after return).
      // sendCommsDeliveredEvent never throws; failures only log + no-op.
      // eslint-disable-next-line no-await-in-loop
      await sendGa4Delivered(
        {
          uid,
          triggerId,
          templateId: spec.templateId,
          channel,
          variant,
        },
        { logger }
      );
    }
  }

  const anyDelivered = deliveredChannels.length > 0;
  const anyDryRunOk =
    dryRun && Object.values(channelResults).some((r) => r?.ok && r.skipReason === "dry_run");

  if (anyDelivered && !dryRun && dedupRef) {
    const resendEmailId =
      typeof channelResults.email?.id === "string" && channelResults.email.id.trim()
        ? channelResults.email.id.trim()
        : null;
    await dedupRef.set(
      {
        kind: "comms",
        triggerId,
        templateId: spec.templateId,
        userId: uid,
        channels: deliveredChannels,
        delivered: true,
        decidedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(campaignId ? { campaignId } : {}),
        ...(resendEmailId ? { resendEmailId } : {}),
        ...(factLabel ? { fact_label: factLabel } : {}),
      },
      { merge: true }
    );
  }

  if (anyDelivered || anyDryRunOk) {
    summary.delivered += 1;
    perUserCount.set(uid, (perUserCount.get(uid) || 0) + 1);
    summary.results.push({
      uid,
      status: dryRun ? "would_deliver" : "delivered",
      channels: dryRun
        ? activeChannels.filter((c) => channelResults[c]?.ok)
        : deliveredChannels,
      dedupId,
    });
  } else {
    bumpSkip("no_channel_delivered");
    summary.results.push({ uid, status: "skipped", reason: "no_channel_delivered", channelResults });
  }
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   triggerId: string,
 *   recipients: Array<{ uid: string, userData?: object, payload?: object, vars?: object }>,
 *   workers?: { inApp?: Function, push?: Function, email?: Function },
 *   dryRun?: boolean,
 *   forceResend?: boolean,
 *   bypassDailyCap?: boolean,
 *   fatigueCap?: number,
 *   variant?: string,
 *   channels?: string[],
 *   logger?: { info?: Function, warn?: Function, error?: Function },
 *   sendGa4Delivered?: typeof sendCommsDeliveredEvent,
 * }} params
 */
async function deliverCommsTrigger({
  db,
  admin,
  triggerId,
  recipients,
  workers = {},
  dryRun = true,
  forceResend = false,
  bypassDailyCap = false,
  fatigueCap = DEFAULT_FATIGUE_CAP,
  variant = "control",
  channels: channelFilter,
  logger,
  sendGa4Delivered = sendCommsDeliveredEvent,
}) {
  const spec = getTriggerSpec(triggerId);
  if (!spec) {
    return { ok: false, reason: "unknown_trigger", triggerId };
  }

  const activeChannels =
    Array.isArray(channelFilter) && channelFilter.length > 0
      ? spec.channels.filter((c) => channelFilter.includes(c))
      : spec.channels;

  const summary = {
    ok: true,
    triggerId,
    templateId: spec.templateId,
    dryRun,
    processed: 0,
    delivered: 0,
    skipped: 0,
    byChannel: { inApp: 0, push: 0, email: 0 },
    skips: {},
    results: [],
  };

  const perUserCount = new Map();
  const bumpSkip = (reason) => {
    summary.skipped += 1;
    summary.skips[reason] = (summary.skips[reason] || 0) + 1;
  };

  for (const recipient of Array.isArray(recipients) ? recipients : []) {
    const uid = recipient?.uid;
    if (!uid) {
      bumpSkip("invalid_recipient");
      continue;
    }
    summary.processed += 1;
    try {
      await deliverOneCommsRecipient({
        db,
        admin,
        spec,
        triggerId,
        recipient,
        uid,
        activeChannels,
        workers,
        dryRun,
        forceResend,
        bypassDailyCap,
        fatigueCap,
        variant,
        perUserCount,
        summary,
        bumpSkip,
        logger,
        sendGa4Delivered,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger?.error?.("deliverCommsTrigger recipient failed", { triggerId, uid, msg });
      bumpSkip("recipient_error");
      summary.results.push({ uid, status: "skipped", reason: "recipient_error" });
    }
  }

  logger?.info?.("deliverCommsTrigger complete", {
    triggerId,
    templateId: spec.templateId,
    dryRun,
    processed: summary.processed,
    delivered: summary.delivered,
    skipped: summary.skipped,
    byChannel: summary.byChannel,
  });

  return summary;
}

/**
 * Combine two countdown fan-outs (with email, and without) into one summary.
 * @param {Array<Record<string, any>>} parts
 */
function mergeCommsDeliverySummaries(parts) {
  const first = (parts || []).find(Boolean) || {};
  const summary = {
    ok: true,
    triggerId: first.triggerId,
    templateId: first.templateId,
    dryRun: first.dryRun,
    processed: 0,
    delivered: 0,
    skipped: 0,
    byChannel: { inApp: 0, push: 0, email: 0 },
    skips: {},
    results: [],
  };
  for (const part of parts) {
    if (!part) continue;
    if (part.ok === false) summary.ok = false;
    summary.processed += part.processed || 0;
    summary.delivered += part.delivered || 0;
    summary.skipped += part.skipped || 0;
    for (const [channel, count] of Object.entries(part.byChannel || {})) {
      summary.byChannel[channel] = (summary.byChannel[channel] || 0) + count;
    }
    for (const [reason, count] of Object.entries(part.skips || {})) {
      summary.skips[reason] = (summary.skips[reason] || 0) + count;
    }
    if (Array.isArray(part.results)) summary.results.push(...part.results);
  }
  return summary;
}

/**
 * Build the default production channel workers. The email worker is created from
 * a Resend client (which may be `null` if the secret is unset → email skips
 * gracefully).
 *
 * @param {{ emailWorker?: Function }} [opts]
 */
function buildDefaultWorkers({ emailWorker } = {}) {
  return {
    inApp: deliverCommsInbox,
    push: deliverCommsPush,
    ...(emailWorker ? { email: emailWorker } : {}),
  };
}

module.exports = {
  deliverCommsTrigger,
  mergeCommsDeliverySummaries,
  buildDefaultWorkers,
  prefAllows,
  recipientAllowsTrigger,
  recipientAllowsChannel,
  DEDUP_COLLECTION,
  DEFAULT_FATIGUE_CAP,
};
