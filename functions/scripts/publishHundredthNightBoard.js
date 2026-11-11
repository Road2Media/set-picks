#!/usr/bin/env node
/**
 * Print or write the handles-only public board for one show (#1147).
 *
 * Does not send comms. Does not change scores or pick documents.
 *
 *   node functions/scripts/publishHundredthNightBoard.js --date=2026-07-29 --dry-run
 *   node functions/scripts/publishHundredthNightBoard.js --date=2026-07-29 --confirm --project=set-picks
 *
 * Default is refused until you pass `--dry-run` or `--confirm`.
 * `--dry-run` reads picks and prints the public JSON. It does not write.
 * `--confirm` writes `public_night_boards/{date}`.
 *
 * The production page requests 2027-01-02 only. A past date is for the
 * staging preview `?dryRunDate=YYYY-MM-DD` (Vite mode `staging`).
 * Production builds ignore that query.
 *
 * Needs Application Default Credentials (the same Cloud Functions
 * service account the repo uses for admin scripts).
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { persistableActualSetlistFromOfficialDoc } = require("../scoringCore");
const { publishHundredthNightBoard } = require("../hundredthShowPublish.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const FIREBASERC_PATH = path.join(REPO_ROOT, ".firebaserc");

function loadEnv() {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function firebasercDefault() {
  try {
    const raw = JSON.parse(fs.readFileSync(FIREBASERC_PATH, "utf8"));
    return typeof raw?.projects?.default === "string" ? raw.projects.default : "";
  } catch {
    return "";
  }
}

function resolveProjectId(args) {
  const flag = args.find((arg) => arg.startsWith("--project="));
  if (flag) return flag.slice("--project=".length).trim();
  const fileEnv = loadEnv();
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    fileEnv.VITE_FIREBASE_PROJECT_ID ||
    firebasercDefault() ||
    ""
  );
}

function resolveDate(args) {
  const flag = args.find((arg) => arg.startsWith("--date="));
  return flag ? flag.slice("--date=".length).trim() : "";
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const dryRun = args.includes("--dry-run") || !confirm;
  if (!args.includes("--dry-run") && !args.includes("--confirm")) {
    console.error("Pass --dry-run or --confirm, and --date=YYYY-MM-DD.");
    process.exit(2);
  }
  const showDate = resolveDate(args);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) {
    console.error("Pass --date=YYYY-MM-DD.");
    process.exit(2);
  }

  const projectId = resolveProjectId(args);
  if (!projectId) {
    console.error("Project id missing. Pass --project=set-picks.");
    process.exit(2);
  }

  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }
  const db = admin.firestore();
  const setlistSnap = await db.collection("official_setlists").doc(showDate).get();
  const actualSetlist = setlistSnap.exists
    ? persistableActualSetlistFromOfficialDoc(setlistSnap.data() || {})
    : null;
  const picksSnap = await db.collection("picks").where("showDate", "==", showDate).get();
  const scoresByPickId = new Map();
  for (const pickDoc of picksSnap.docs) {
    const data = pickDoc.data() || {};
    if (typeof data.score === "number") scoresByPickId.set(pickDoc.id, data.score);
  }

  const result = await publishHundredthNightBoard({
    db,
    showDate,
    pickDocs: picksSnap.docs,
    scoresByPickId,
    actualSetlist,
    allowDryRun: true,
    write: confirm && !dryRun,
  });

  console.log(
    JSON.stringify(
      {
        projectId,
        dryRun: !result.wrote,
        wrote: result.wrote,
        showDate: result.showDate || showDate,
        rowCount: result.rowCount || 0,
        board: result.board || null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
