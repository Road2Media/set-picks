#!/usr/bin/env node
/**
 * Seed the process ledger for one-shot triggers that already wrapped
 * (or must stay archive-closed). `tour_recap` writes
 * `comms_process_state/{processId}` and mirrors `comms_tour_recap_state`
 * so the #1034 seed and the #1035 ledger are one gate.
 *
 * Dry-run is the default.
 *
 *   node functions/scripts/seedCommsProcessState.js --dry-run
 *   node functions/scripts/seedCommsProcessState.js --confirm
 *
 * `functions/scripts/seedTourRecapState.js` is the same command.
 *
 * Project id (required for --confirm):
 *   --project=set-picks
 *   or GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT
 *   or repo-root `.env` VITE_FIREBASE_PROJECT_ID
 *   or `.firebaserc` default
 *
 * Calendar `editionStatus` is a separate write:
 *   node functions/scripts/seedCalendarEditionStatus.js --dry-run
 */
"use strict";

const fs = require("node:fs");
const path = require("path");

const {
  PROCESS_STATE_COLLECTION,
  TOUR_RECAP_PROCESS_SEEDS,
  processDocId,
  writeProcessState,
} = require("../commsProcessState");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const FIREBASERC_PATH = path.join(REPO_ROOT, ".firebaserc");

function loadEnv() {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
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
  const flag = args.find((a) => a.startsWith("--project="));
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--confirm");
  if (!args.includes("--dry-run") && !args.includes("--confirm")) {
    console.error("Pass --dry-run or --confirm");
    process.exit(2);
  }

  const seeds = TOUR_RECAP_PROCESS_SEEDS.map((seed) => ({
    ...seed,
    processId: processDocId(seed.triggerId, seed.scope),
  }));

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          collection: PROCESS_STATE_COLLECTION,
          mirrors: "comms_tour_recap_state",
          seeds,
        },
        null,
        2
      )
    );
    return;
  }

  const projectId = resolveProjectId(args);
  if (!projectId) {
    console.error(
      "Project id missing. Pass --project=set-picks or set GOOGLE_CLOUD_PROJECT / VITE_FIREBASE_PROJECT_ID."
    );
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
  console.log(`seeding ${PROCESS_STATE_COLLECTION} on ${projectId}`);

  for (const seed of seeds) {
    // eslint-disable-next-line no-await-in-loop
    await writeProcessState({
      db,
      admin,
      triggerId: seed.triggerId,
      scope: seed.scope,
      status: seed.status,
      finalDate: seed.finalDate,
      source: seed.source,
      supersedes: seed.supersedes,
      extra: { note: seed.note },
    });
    console.log(`wrote ${seed.status}: ${seed.processId}`);
  }
  console.log("done", path.basename(__filename));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
