#!/usr/bin/env node
/**
 * CLI: Summer Tour 2026 reminder for people who did not open the launch email (#512).
 *
 * Usage:
 *   node scripts/deliverMarketingSummerTour2026Reminder.js                         # dry run (default)
 *   node scripts/deliverMarketingSummerTour2026Reminder.js --uid <uid>             # dry run one user
 *   node scripts/deliverMarketingSummerTour2026Reminder.js --execute --uid <uid>   # send canary
 *   node scripts/deliverMarketingSummerTour2026Reminder.js --execute               # send full non-opener cohort
 *   node scripts/deliverMarketingSummerTour2026Reminder.js --wait-hours 72         # parent send must be at least 72h old
 *
 * Dry-run is the default. `--execute` sends. `--force-resend` retries this reminder's
 * own dedup key only (`marketing:summer_tour_2026_reminder:{uid}`). It does not
 * resend the launch email.
 *
 * Requires Application Default Credentials with Firestore read access.
 * Execute mode also needs RESEND_API_KEY (and RESEND_WEBHOOK_SECRET for signed unsubscribe links).
 */

const admin = require("firebase-admin");
const {
  deliverMarketingSummerTour2026Reminder,
} = require("../marketingReminderDelivery");

admin.initializeApp();
const db = admin.firestore();

const execute = process.argv.includes("--execute");
const forceResend = process.argv.includes("--force-resend");

/** @type {string[]} */
const onlyUids = [];
let waitHours;
for (let i = 0; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === "--uid" && process.argv[i + 1]) {
    onlyUids.push(process.argv[i + 1]);
    i += 1;
  } else if (arg.startsWith("--uid=")) {
    onlyUids.push(arg.slice("--uid=".length));
  } else if (arg === "--wait-hours" && process.argv[i + 1]) {
    waitHours = Number(process.argv[i + 1]);
    i += 1;
  } else if (arg.startsWith("--wait-hours=")) {
    waitHours = Number(arg.slice("--wait-hours=".length));
  }
}

deliverMarketingSummerTour2026Reminder({
  db,
  admin,
  dryRun: !execute,
  forceResend,
  onlyUids: onlyUids.length > 0 ? onlyUids : undefined,
  ...(Number.isFinite(waitHours) ? { waitHours } : {}),
  resendApiKey: process.env.RESEND_API_KEY,
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
  logger: console,
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result && result.ok === false ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
