#!/usr/bin/env node
/**
 * Replay one morning `tour_rankings_daily` send for a show that the 8:00 AM
 * job missed.
 *
 * Builds the same payloads as the cron (current functions code), then calls
 * production `runCommsTrigger` so prefs, dedup, inbox, push, and Resend stay
 * on the live function. Does not run the end-of-tour wrap step.
 *
 * Default is a dry run. `--confirm` sends.
 *
 *   node scripts/replay-tour-rankings-daily.mjs --show-date 2026-10-09
 *   node scripts/replay-tour-rankings-daily.mjs --show-date 2026-10-09 --confirm
 *   node scripts/replay-tour-rankings-daily.mjs --show-date 2026-10-09 --exclude-email pat@road2media.com --confirm
 *
 * Requires GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY (env or .env).
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const REGION = "us-central1";
const ADMIN_EMAIL = "pat@road2media.com";
const CHUNK = 8;

function loadEnvFile() {
  /** @type {Record<string, string>} */
  const envVars = {};
  try {
    for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
    }
  } catch {
    // Actions supplies GCP_* on the environment.
  }
  return envVars;
}

function readFirebaseWebConfig() {
  const src = readFileSync(resolve(root, "src/shared/lib/firebase.js"), "utf8");
  const apiKey = src.match(/apiKey:\s*"([^"]+)"/)?.[1];
  const projectId = src.match(/projectId:\s*"([^"]+)"/)?.[1];
  if (!apiKey || !projectId) {
    throw new Error("Could not read apiKey and projectId from src/shared/lib/firebase.js");
  }
  return { apiKey, projectId };
}

function parseArgs(argv) {
  let showDate = "";
  let confirm = false;
  /** @type {string[]} */
  const excludeEmails = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--show-date") showDate = argv[++i] || "";
    else if (a === "--confirm") confirm = true;
    else if (a === "--exclude-email") {
      const email = (argv[++i] || "").trim().toLowerCase();
      if (!email) throw new Error("--exclude-email requires an address");
      excludeEmails.push(email);
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: replay-tour-rankings-daily --show-date YYYY-MM-DD [--exclude-email addr] [--confirm]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) {
    throw new Error("--show-date YYYY-MM-DD is required");
  }
  return { showDate, confirm, excludeEmails };
}

/**
 * Noon Pacific on the calendar day after the show, so venue-local "yesterday"
 * is the show date in US time zones.
 *
 * @param {string} showDate
 */
function nowForMorningAfter(showDate) {
  const [y, m, d] = showDate.split("-").map((n) => Number(n));
  return new Date(Date.UTC(y, m - 1, d + 1, 19, 0, 0));
}

function chunk(list, size) {
  /** @type {typeof list[]} */
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function mintIdToken(admin, apiKey) {
  const user = await admin.auth().getUserByEmail(ADMIN_EMAIL);
  const customToken = await admin.auth().createCustomToken(user.uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://www.setlistpickem.com/",
        Origin: "https://www.setlistpickem.com",
      },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${json.error?.message || res.status}`);
  return json.idToken;
}

async function callRunCommsTrigger(projectId, idToken, payload) {
  const url = `https://${REGION}-${projectId}.cloudfunctions.net/runCommsTrigger`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data: payload }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`runCommsTrigger ${res.status}: ${JSON.stringify(json.error || json)}`);
  }
  return json.result ?? json;
}

async function main() {
  const { showDate, confirm, excludeEmails } = parseArgs(process.argv.slice(2));
  const envFile = loadEnvFile();
  const clientEmail = process.env.GCP_CLIENT_EMAIL || envFile.GCP_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GCP_PRIVATE_KEY || envFile.GCP_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Missing GCP_CLIENT_EMAIL / GCP_PRIVATE_KEY");
  }
  const { apiKey, projectId } = readFirebaseWebConfig();
  process.env.COMMS_EVENT_ADAPTERS_ENABLED = "true";

  const admin = require(resolve(root, "functions/node_modules/firebase-admin"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
  }
  const { runScheduledTourRankingsDaily } = require(
    resolve(root, "functions/commsEventAdapters.js"),
  );

  const now = nowForMorningAfter(showDate);
  console.log(
    `→ collect tour_rankings_daily for ${showDate} (now ${now.toISOString()}) dryRun=${!confirm}`,
  );
  const collected = await runScheduledTourRankingsDaily({
    db: admin.firestore(),
    admin,
    logger: console,
    now,
    collectOnly: true,
  });
  const recipients = (collected?.recipients || [])
    .filter((r) => r && typeof r.uid === "string" && r.uid.trim())
    .map((r) => ({
      uid: r.uid.trim(),
      payload: r.payload && typeof r.payload === "object" ? r.payload : {},
      vars: r.vars && typeof r.vars === "object" ? r.vars : { showDate },
    }));
  const showDates = [...new Set(recipients.map((r) => r.vars.showDate).filter(Boolean))];
  console.log(
    `→ ${recipients.length} graded picker(s) on ${showDates.join(", ") || "(none)"}`,
  );
  if (!showDates.includes(showDate)) {
    throw new Error(
      `No graded pickers for ${showDate}. Collected dates: ${showDates.join(", ") || "none"}`,
    );
  }
  let forShow = recipients.filter((r) => r.vars.showDate === showDate);
  if (forShow.length !== recipients.length) {
    console.log(`→ sending ${forShow.length} for ${showDate}; ignoring other dates`);
  }
  if (excludeEmails.length > 0) {
    const excludedUids = new Set();
    for (const email of excludeEmails) {
      // eslint-disable-next-line no-await-in-loop
      const user = await admin.auth().getUserByEmail(email);
      excludedUids.add(user.uid);
    }
    const before = forShow.length;
    forShow = forShow.filter((r) => !excludedUids.has(r.uid));
    const removed = before - forShow.length;
    if (removed < excludeEmails.length) {
      throw new Error(
        `--exclude-email matched ${removed} of ${excludeEmails.length} address(es) in this audience`,
      );
    }
    console.log(`→ excluded ${removed} already-sent account(s); ${forShow.length} remaining`);
  }
  if (forShow.length === 0) throw new Error(`No remaining recipients for ${showDate}`);

  const idToken = await mintIdToken(admin, apiKey);
  const totals = { processed: 0, delivered: 0, skipped: 0, email: 0, inApp: 0, push: 0 };
  const batches = chunk(forShow, CHUNK);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    console.log(`→ runCommsTrigger batch ${i + 1}/${batches.length} (${batch.length})`);
    // eslint-disable-next-line no-await-in-loop
    const result = await callRunCommsTrigger(projectId, idToken, {
      triggerId: "tour_rankings_daily",
      recipients: batch,
      dryRun: !confirm,
      forceResend: false,
    });
    totals.processed += Number(result.processed) || 0;
    totals.delivered += Number(result.delivered) || 0;
    totals.skipped += Number(result.skipped) || 0;
    totals.email += Number(result.byChannel?.email) || 0;
    totals.inApp += Number(result.byChannel?.inApp) || 0;
    totals.push += Number(result.byChannel?.push) || 0;
    const skipBits = result.skips ? JSON.stringify(result.skips) : "{}";
    console.log(
      `  processed=${result.processed} delivered=${result.delivered} skipped=${result.skipped} skips=${skipBits}`,
    );
  }
  console.log(
    `✓ ${confirm ? "sent" : "dry-run"} processed=${totals.processed} delivered=${totals.delivered} skipped=${totals.skipped} email=${totals.email} inApp=${totals.inApp} push=${totals.push}`,
  );
  if (confirm && totals.email < 1) {
    throw new Error("Confirm run delivered no email");
  }
}

main().catch((err) => {
  console.error("\n✗", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
