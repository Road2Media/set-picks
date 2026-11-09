"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveDedupKey } = require("./commsCatalog");
const { emailSuppressionDocId } = require("./commsEmailSuppression");
const { renderCommsTemplate } = require("./commsTemplates");
const {
  PARENT_CAMPAIGN_ID,
  PARENT_TRIGGER_ID,
  resolveMarketingReminderAudience,
} = require("./marketingReminderAudience");
const {
  CAMPAIGN_ID,
  TRIGGER_ID,
  deliverMarketingSummerTour2026Reminder,
} = require("./marketingReminderDelivery");

const NOW = new Date("2026-07-10T12:00:00.000Z");
const OLD_SEND = new Date("2026-07-07T12:00:00.000Z");
const RECENT_SEND = new Date("2026-07-10T00:00:00.000Z");

function parentLogId(uid) {
  return resolveDedupKey(PARENT_TRIGGER_ID, { uid, campaignId: PARENT_CAMPAIGN_ID });
}

function deliveredLog({ resendEmailId, decidedAt = OLD_SEND } = {}) {
  return {
    delivered: true,
    channels: ["email"],
    campaignId: PARENT_CAMPAIGN_ID,
    triggerId: PARENT_TRIGGER_ID,
    decidedAt,
    ...(resendEmailId ? { resendEmailId } : {}),
  };
}

function fakeDb({ users = {}, logs = {}, engagement = {}, suppressions = {} } = {}) {
  const userDocs = new Map(Object.entries(users));
  const logDocs = new Map(Object.entries(logs));
  const engagementDocs = new Map(Object.entries(engagement));
  const suppressionDocs = new Map(Object.entries(suppressions));
  const collections = {
    users: userDocs,
    fcm_notification_log: logDocs,
    comms_email_engagement: engagementDocs,
    email_suppression: suppressionDocs,
  };
  return {
    collection(name) {
      const docs = collections[name];
      if (!docs) throw new Error(`unexpected collection ${name}`);
      return {
        doc(id) {
          return {
            async get() {
              const data = docs.get(id);
              return { exists: docs.has(id), data: () => data };
            },
          };
        },
      };
    },
  };
}

const cohort = [
  { uid: "quiet", segment: "post_sphere_signup" },
  { uid: "opened", segment: "sphere_alum" },
  { uid: "clicked", segment: "sphere_alum" },
  { uid: "suppressed", segment: "sphere_alum" },
  { uid: "unsub", segment: "sphere_alum_and_new" },
  { uid: "tooSoon", segment: "sphere_alum" },
  { uid: "neverSent", segment: "post_sphere_signup" },
  { uid: "noEmail", segment: "sphere_alum" },
  { uid: "noOpenId", segment: "post_sphere_signup" },
];

function seededDb() {
  return fakeDb({
    users: {
      quiet: { email: "quiet@example.com", handle: "QuietFan" },
      opened: { email: "opened@example.com", handle: "OpenedFan" },
      clicked: { email: "clicked@example.com", handle: "ClickedFan" },
      suppressed: { email: "bounced@example.com", handle: "BouncedFan" },
      unsub: {
        email: "unsub@example.com",
        handle: "UnsubFan",
        notificationPrefs: { lifecycle: false },
      },
      tooSoon: { email: "soon@example.com", handle: "SoonFan" },
      neverSent: { email: "never@example.com", handle: "NeverFan" },
      noEmail: { handle: "NoMail" },
      noOpenId: { email: "noid@example.com", handle: "NoIdFan" },
    },
    logs: {
      [parentLogId("quiet")]: deliveredLog({ resendEmailId: "re_quiet" }),
      [parentLogId("opened")]: deliveredLog({ resendEmailId: "re_opened" }),
      [parentLogId("clicked")]: deliveredLog({ resendEmailId: "re_clicked" }),
      [parentLogId("suppressed")]: deliveredLog({ resendEmailId: "re_suppressed" }),
      [parentLogId("unsub")]: deliveredLog({ resendEmailId: "re_unsub" }),
      [parentLogId("tooSoon")]: deliveredLog({
        resendEmailId: "re_soon",
        decidedAt: RECENT_SEND,
      }),
      [parentLogId("noEmail")]: deliveredLog({ resendEmailId: "re_nomail" }),
      [parentLogId("noOpenId")]: deliveredLog(),
    },
    engagement: {
      re_opened: { uid: "opened", campaignId: PARENT_CAMPAIGN_ID, openedAt: OLD_SEND },
      re_clicked: {
        uid: "clicked",
        campaignId: PARENT_CAMPAIGN_ID,
        openedAt: OLD_SEND,
        clickedAt: OLD_SEND,
      },
      re_quiet: { uid: "quiet", campaignId: PARENT_CAMPAIGN_ID },
    },
    suppressions: {
      [emailSuppressionDocId("bounced@example.com")]: { suppressed: true, email: "bounced@example.com" },
    },
  });
}

test("reminder dedup key does not collide with the launch send", () => {
  const launch = resolveDedupKey(PARENT_TRIGGER_ID, {
    uid: "quiet",
    campaignId: PARENT_CAMPAIGN_ID,
  });
  const reminder = resolveDedupKey(TRIGGER_ID, {
    uid: "quiet",
    campaignId: CAMPAIGN_ID,
  });
  assert.equal(launch, "marketing:summer_tour_2026:quiet");
  assert.equal(reminder, "marketing:summer_tour_2026_reminder:quiet");
  assert.notEqual(launch, reminder);
});

test("audience resolver returns only non-openers who cleared the wait", async () => {
  const result = await resolveMarketingReminderAudience(seededDb(), {
    parentCampaignId: PARENT_CAMPAIGN_ID,
    waitHours: 48,
    now: NOW,
    resolveParentCohort: async () => cohort,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.recipients.map((row) => row.uid).sort(),
    ["noOpenId", "quiet"]
  );
  const quiet = result.recipients.find((row) => row.uid === "quiet");
  assert.equal(quiet.email, "quiet@example.com");
  assert.equal(quiet.segment, "post_sphere_signup");
  assert.equal(result.excluded.opened, 2);
  assert.equal(result.excluded.suppressed, 1);
  assert.equal(result.excluded.unsubscribed, 1);
  assert.equal(result.excluded.noEmail, 1);
  assert.equal(result.excluded.waitWindow, 1);
  assert.equal(result.excluded.parentNotDelivered, 1);
});

test("onlyUids canary skips the rest of the cohort", async () => {
  const result = await resolveMarketingReminderAudience(seededDb(), {
    parentCampaignId: PARENT_CAMPAIGN_ID,
    waitHours: 48,
    now: NOW,
    onlyUids: ["quiet"],
    resolveParentCohort: async () => cohort,
  });
  assert.deepEqual(result.recipients, [
    { uid: "quiet", segment: "post_sphere_signup", email: "quiet@example.com" },
  ]);
});

test("unknown parent campaign does not invent a cohort", async () => {
  const result = await resolveMarketingReminderAudience(fakeDb(), {
    parentCampaignId: "not_a_campaign",
    resolveParentCohort: undefined,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unknown_parent_campaign");
  assert.deepEqual(result.recipients, []);
});

test("summer_tour_2026 uses the launch cohort loader when none is injected", async () => {
  const seen = [];
  const db = {
    collection(name) {
      seen.push(name);
      if (name === "picks") {
        return {
          where() {
            return { async get() { return { docs: [] }; } };
          },
        };
      }
      if (name === "users") {
        return {
          async get() {
            return { docs: [] };
          },
          doc() {
            return { async get() { return { exists: false, data: () => ({}) }; } };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  };
  const result = await resolveMarketingReminderAudience(db, {
    parentCampaignId: PARENT_CAMPAIGN_ID,
    waitHours: 48,
    now: NOW,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.recipients, []);
  assert.ok(seen.includes("picks"));
  assert.ok(seen.includes("users"));
});

test("waitHours 0 still requires a delivered parent send", async () => {
  const result = await resolveMarketingReminderAudience(seededDb(), {
    parentCampaignId: PARENT_CAMPAIGN_ID,
    waitHours: 0,
    now: NOW,
    resolveParentCohort: async () => cohort,
  });
  const uids = result.recipients.map((row) => row.uid).sort();
  assert.ok(uids.includes("tooSoon"));
  assert.ok(!uids.includes("neverSent"));
  assert.ok(!uids.includes("opened"));
});

test("reminder template is a shorter slot note and not the launch subject", async () => {
  const out = await renderCommsTemplate("summer-tour-2026-reminder", {
    greetingName: "QuietFan",
    openerLabel: "Tuesday, July 7",
  });
  assert.equal(out.email.subject, "Your six slots for Summer Tour are still open");
  assert.match(out.email.text, /QuietFan, the first note about Summer Tour might still be sitting unopened/);
  assert.match(out.email.text, /Six slots a night/);
  assert.equal(out.email.ctaLabel, "Make Your Picks");
  assert.match(out.email.ctaUrl, /\/dashboard\/picks$/);
  assert.equal(out.email.signOff, "See you on tour!");
  assert.doesNotMatch(out.email.text, /chair/i);
  assert.doesNotMatch(out.email.subject, /chair/i);
  assert.notEqual(out.email.subject, "Summer Tour's almost here — bring your crew →");
});

test("dry run previews the non-opener and does not call delivery", async () => {
  let called = false;
  const result = await deliverMarketingSummerTour2026Reminder({
    db: seededDb(),
    admin: {},
    dryRun: true,
    waitHours: 48,
    now: NOW,
    resolveParentCohort: async () => cohort,
    deliver: async () => {
      called = true;
      return { ok: true };
    },
  });
  assert.equal(called, false);
  assert.equal(result.dryRun, true);
  assert.equal(result.triggerId, TRIGGER_ID);
  assert.equal(result.campaignId, CAMPAIGN_ID);
  assert.equal(result.parentCampaignId, PARENT_CAMPAIGN_ID);
  assert.deepEqual(
    result.preview.map((row) => row.uid).sort(),
    ["noOpenId", "quiet"]
  );
  assert.equal(result.preview.find((row) => row.uid === "quiet").handle, "QuietFan");
});

test("execute sends the reminder trigger with its own campaign id and bypasses the daily cap", async () => {
  /** @type {Array<Record<string, unknown>>} */
  const calls = [];
  const result = await deliverMarketingSummerTour2026Reminder({
    db: seededDb(),
    admin: {},
    dryRun: false,
    waitHours: 48,
    now: NOW,
    onlyUids: ["quiet", "opened"],
    resolveParentCohort: async () => cohort,
    deliver: async (args) => {
      calls.push(args);
      return { ok: true, delivered: args.recipients.length, processed: args.recipients.length };
    },
  });

  assert.equal(calls.length, 1);
  const args = calls[0];
  assert.equal(args.triggerId, "marketing_summer_tour_2026_reminder");
  assert.equal(args.forceResend, false);
  assert.equal(args.bypassDailyCap, true);
  assert.equal(args.dryRun, false);
  assert.equal(args.recipients.length, 1);
  assert.equal(args.recipients[0].uid, "quiet");
  assert.equal(args.recipients[0].vars.campaignId, "summer_tour_2026_reminder");
  assert.equal(result.delivery.delivered, 1);
  const reminderKey = resolveDedupKey(args.triggerId, args.recipients[0].vars);
  const launchKey = resolveDedupKey(PARENT_TRIGGER_ID, {
    uid: "quiet",
    campaignId: PARENT_CAMPAIGN_ID,
  });
  assert.notEqual(reminderKey, launchKey);
});

test("forceResend stays on the reminder trigger", async () => {
  /** @type {Array<Record<string, unknown>>} */
  const calls = [];
  await deliverMarketingSummerTour2026Reminder({
    db: seededDb(),
    admin: {},
    dryRun: false,
    forceResend: true,
    waitHours: 0,
    now: NOW,
    onlyUids: ["quiet"],
    resolveParentCohort: async () => cohort,
    deliver: async (args) => {
      calls.push(args);
      return { ok: true, delivered: 1 };
    },
  });
  assert.equal(calls[0].triggerId, TRIGGER_ID);
  assert.equal(calls[0].forceResend, true);
  assert.notEqual(calls[0].triggerId, PARENT_TRIGGER_ID);
});
