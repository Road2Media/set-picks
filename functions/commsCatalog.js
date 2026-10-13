/**
 * Comms catalog resolver (DELIVER layer, epic #441 / #439).
 *
 * Delivery-relevant fields for each catalog trigger are inlined here as
 * `TRIGGER_SPECS` so the running Cloud Function does not depend on the repo
 * `docs/` tree being bundled into the deploy artifact. `commsCatalog.test.js`
 * asserts this stays in sync with `docs/comms-triggers/catalog.json` (the source
 * of truth) so the two never drift.
 *
 * The orchestrator (`commsDelivery.js`) reads channels / prefKeys / dedupKey /
 * templateId from here; the catalog's editorial + taxonomy fields stay in JSON.
 */

"use strict";

const { toFirestoreDocumentId } = require("./firestoreDocId");

/**
 * @typedef {object} TriggerSpec
 * @property {string} triggerId
 * @property {string} templateId
 * @property {string[]} channels
 * @property {string[]} prefKeys
 * @property {string} dedupKey  `{placeholder}` template interpolated from vars.
 * @property {string} family
 * @property {string} priority
 * @property {"transactional" | "lifecycle" | "commercial"} [emailClass]
 */

/** @type {Record<string, TriggerSpec>} */
const TRIGGER_SPECS = {
  account_welcome: {
    triggerId: "account_welcome",
    templateId: "account-welcome",
    channels: ["inApp", "push", "email"],
    prefKeys: ["lifecycle"],
    dedupKey: "welcome:{uid}",
    family: "lifecycle",
    priority: "P0",
  },
  tour_countdown: {
    triggerId: "tour_countdown",
    templateId: "tour-countdown",
    channels: ["inApp", "push", "email"],
    prefKeys: ["lifecycle"],
    dedupKey: "tour_countdown:{tourId}:{uid}:{days_remaining}",
    family: "show_calendar",
    priority: "P0",
  },
  picks_confirmed: {
    triggerId: "picks_confirmed",
    templateId: "picks-confirmed",
    channels: ["inApp", "push"],
    prefKeys: ["lifecycle"],
    dedupKey: "picks_confirmed:{uid}:{showDate}",
    family: "show_calendar",
    priority: "P0",
  },
  score_first_points: {
    triggerId: "score_first_points",
    templateId: "score-first-points",
    channels: ["inApp", "push"],
    prefKeys: ["results"],
    dedupKey: "first_points:{uid}:{showDate}",
    family: "live_game",
    priority: "P1",
  },
  score_leader: {
    triggerId: "score_leader",
    templateId: "score-leader",
    channels: ["inApp", "push"],
    prefKeys: ["results"],
    dedupKey: "leader:{uid}:{showDate}:{leaderboard}",
    family: "live_game",
    priority: "P1",
  },
  // Email intentionally dropped (#451): the next-morning `tour_rankings_daily`
  // send absorbs the "your night" recap content into one email per showDate,
  // eliminating the dominant same-day fatigue collision (both triggers used
  // to fire for the same user on the same show). inApp/push keep the
  // immediate night-of delivery unchanged.
  show_recap: {
    triggerId: "show_recap",
    templateId: "show-recap",
    channels: ["inApp", "push"],
    prefKeys: ["results"],
    dedupKey: "show_recap:{uid}:{showDate}",
    family: "results_recap",
    priority: "P1",
  },
  tour_rankings_daily: {
    triggerId: "tour_rankings_daily",
    templateId: "tour-rankings-daily",
    channels: ["inApp", "push", "email"],
    prefKeys: ["results"],
    dedupKey: "tour_rank:{uid}:{showDate}",
    family: "results_recap",
    priority: "P1",
  },
  picks_lock_reminder: {
    triggerId: "picks_lock_reminder",
    templateId: "picks-lock-reminder",
    channels: ["inApp", "push", "email"],
    prefKeys: ["reminders"],
    emailClass: "transactional",
    dedupKey: "reminder_{showYmd}_{uid}",
    family: "show_calendar",
    priority: "P0",
  },
  tour_engagement_reminder: {
    triggerId: "tour_engagement_reminder",
    templateId: "tour-engagement-reminder",
    channels: ["inApp", "push", "email"],
    prefKeys: ["lifecycle"],
    dedupKey: "tour_engage:{uid}:{tourId}",
    family: "lifecycle",
    priority: "P1",
  },
  // Email channel is the abbreviated teaser (emailFull is optional / in-app long form).
  tour_recap: {
    triggerId: "tour_recap",
    templateId: "tour-recap",
    channels: ["inApp", "push", "email"],
    prefKeys: ["results"],
    dedupKey: "tour_recap:{tourId}:{uid}",
    family: "results_recap",
    priority: "P1",
  },
  marketing_summer_tour_2026_launch: {
    triggerId: "marketing_summer_tour_2026_launch",
    templateId: "summer-tour-2026-launch",
    channels: ["email"],
    prefKeys: ["lifecycle"],
    dedupKey: "marketing:{campaignId}:{uid}",
    family: "lifecycle",
    priority: "P1",
  },
  // inApp is forced for all users via Sphere-style fanout (no prefs gate).
  // Email uses deliverCommsTrigger with channelFilter=["email"] + lifecycle prefs.
  marketing_summer_2026_almost_end: {
    triggerId: "marketing_summer_2026_almost_end",
    templateId: "summer-2026-almost-end",
    channels: ["email", "inApp"],
    prefKeys: ["lifecycle"],
    dedupKey: "marketing:{campaignId}:{uid}",
    family: "lifecycle",
    priority: "P1",
  },
};

/**
 * @param {string} triggerId
 * @returns {TriggerSpec | undefined}
 */
function getTriggerSpec(triggerId) {
  return TRIGGER_SPECS[triggerId];
}

/**
 * Interpolate a `{placeholder}` dedup template with vars. Missing vars become
 * the empty string (callers must supply the keys the template needs).
 *
 * @param {string} template
 * @param {Record<string, unknown>} vars
 * @returns {string}
 */
function interpolate(template, vars = {}) {
  if (typeof template !== "string") return "";
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

/**
 * Resolve the dedup doc id for a trigger + vars. Used as the
 * `fcm_notification_log` doc id so all channels for one (trigger, scope) share
 * one idempotency record.
 *
 * @param {string} triggerId
 * @param {Record<string, unknown>} vars
 * @returns {string}
 */
function resolveDedupKey(triggerId, vars) {
  const spec = getTriggerSpec(triggerId);
  if (!spec) return "";
  return toFirestoreDocumentId(interpolate(spec.dedupKey, vars));
}

module.exports = {
  TRIGGER_SPECS,
  getTriggerSpec,
  resolveDedupKey,
  interpolate,
};
