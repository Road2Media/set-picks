/**
 * Canonical deploy manifest for comms-related Cloud Functions exports.
 *
 * When you add a new comms event adapter, hook host, or infra export:
 *   1. Wire the export in `functions/index.js` (with correct secrets/env).
 *   2. Append ONE entry below in the appropriate group.
 *   3. Run `npm run comms:deploy:validate` — fails if manifest ↔ index.js drift.
 *
 * Read by: `scripts/deploy-comms-functions.mjs`, `scripts/comms-deploy-validate.mjs`,
 *          `functions/commsDeployManifest.test.js`.
 *
 * @typedef {'resend'|'webhook'|'inbound'|'none'} SecretExpectation
 * @typedef {{ export: string, triggerId?: string, commsPath?: string, note?: string, secretExpectation?: SecretExpectation, gated?: boolean }} ManifestEntry
 */

/** @type {Record<string, ManifestEntry[]>} */
const COMMS_DEPLOY_GROUPS = {
  /**
   * Thin exports gated by COMMS_EVENT_ADAPTERS_ENABLED — one row per scheduled/Firestore adapter.
   */
  eventAdapters: [
    { export: "commsOnUserProfileWrite", triggerId: "account_welcome", gated: true, secretExpectation: "resend" },
    { export: "commsOnPickWrite", triggerId: "picks_confirmed", gated: true, secretExpectation: "resend" },
    { export: "scheduledTourCountdownComms", triggerId: "tour_countdown", gated: true, secretExpectation: "resend" },
    { export: "scheduledTourRankingsDailyComms", triggerId: "tour_rankings_daily", note: "also deliverPendingTourRecaps (tour_recap)", gated: true, secretExpectation: "resend" },
    { export: "scheduledPicksLockReminder", triggerId: "picks_lock_reminder", gated: false, secretExpectation: "resend" },
  ],

  /**
   * Functions that invoke comms adapters from shared code paths (live score / rollup / poll).
   */
  hookHosts: [
    { export: "gradePicksOnSetlistWrite", commsPath: "deliverLiveScoreComms", secretExpectation: "resend" },
    { export: "rollupScoresForShow", commsPath: "deliverPostRollupComms", secretExpectation: "resend" },
    { export: "refreshLiveScoresForShow", commsPath: "deliverLiveScoreComms", secretExpectation: "resend" },
    {
      export: "scheduledPhishnetLiveSetlistPoll",
      commsPath: "deliverPostRollupComms (auto-finalize); liveSetlistOpsAlert",
      secretExpectation: "resend",
    },
    { export: "pollLiveSetlistNow", commsPath: "deliverLiveScoreComms; liveSetlistOpsAlert", secretExpectation: "resend" },
  ],

  /**
   * Orchestrator, deliverability, and email-prefs callables — deploy with adapter changes when touched.
   */
  infra: [
    { export: "runCommsTrigger", note: "admin canary/replay", secretExpectation: "resend" },
    {
      export: "deliverMarketingSummerTour2026Launch",
      triggerId: "marketing_summer_tour_2026_launch",
      note: "admin batch marketing email #468",
      secretExpectation: "resend",
    },
    {
      export: "deliverMarketingSummer2026AlmostEnd",
      triggerId: "marketing_summer_2026_almost_end",
      note: "admin batch almost-end email + forced inbox",
      secretExpectation: "resend",
    },
    {
      export: "scheduledMarketingSummer2026AlmostEnd",
      triggerId: "marketing_summer_2026_almost_end",
      note: "one-shot 2026-08-03 08:00 America/Denver",
      secretExpectation: "resend",
    },
    { export: "commsResendWebhook", note: "Resend bounce/complaint + open/click webhook (#512)", secretExpectation: "webhook" },
    {
      export: "commsResendInboundWebhook",
      note: "Resend email.received allowlist + Workspace forward",
      secretExpectation: "inbound",
    },
    { export: "commsEmailUnsubscribe", note: "RFC 8058 one-click unsubscribe", secretExpectation: "none" },
    { export: "getCommsEmailStatus", note: "email prefs status", secretExpectation: "none" },
    { export: "unsubscribeCommsEmail", note: "email prefs unsubscribe", secretExpectation: "none" },
    { export: "resubscribeCommsEmail", note: "email prefs resubscribe", secretExpectation: "none" },
  ],
};

const GROUP_ORDER = ["eventAdapters", "hookHosts", "infra"];

/**
 * @param {typeof COMMS_DEPLOY_GROUPS} [groups]
 * @returns {ManifestEntry[]}
 */
function flattenManifest(groups = COMMS_DEPLOY_GROUPS) {
  return GROUP_ORDER.flatMap((key) => groups[key] || []);
}

/**
 * @param {string|string[]} [groupKeys] — subset of GROUP_ORDER, or 'all'
 * @returns {string[]}
 */
function listExportNames(groupKeys = "all") {
  const keys =
    groupKeys === "all" || groupKeys == null
      ? GROUP_ORDER
      : Array.isArray(groupKeys)
        ? groupKeys
        : [groupKeys];
  return keys.flatMap((key) => (COMMS_DEPLOY_GROUPS[key] || []).map((e) => e.export));
}

/**
 * @param {string[]} exportNames
 * @returns {string} firebase `--only` fragment (comma-separated, no leading `--only`)
 */
function buildFirebaseOnlyTargets(exportNames) {
  return exportNames.map((name) => `functions:${name}`).join(",");
}

/**
 * @param {string|string[]} [groupKeys]
 * @returns {string}
 */
function buildFirebaseDeployOnlyArg(groupKeys = "all") {
  return buildFirebaseOnlyTargets(listExportNames(groupKeys));
}

module.exports = {
  COMMS_DEPLOY_GROUPS,
  GROUP_ORDER,
  flattenManifest,
  listExportNames,
  buildFirebaseOnlyTargets,
  buildFirebaseDeployOnlyArg,
};
