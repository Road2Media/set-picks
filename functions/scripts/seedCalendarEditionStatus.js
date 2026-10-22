#!/usr/bin/env node
/**
 * Stamp `editionStatus` on `show_calendar/snapshot` tour groups.
 *
 * The 8am scanner and show_recap re-rollup read this field. A tour name is
 * not a gate. The next Phish.net calendar sync copies these fields forward
 * by show date (see `stampPreservedEdition`).
 *
 * Dry-run is the default. Does not deploy functions.
 *
 *   node functions/scripts/seedCalendarEditionStatus.js --dry-run
 *   node functions/scripts/seedCalendarEditionStatus.js --confirm
 */
"use strict";

const fs = require("node:fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const FIREBASERC_PATH = path.join(REPO_ROOT, ".firebaserc");

/** @type {Array<{ tourKey: string, editionStatus: "live" | "archive" | "closed", campaignId: string, commsProcessId: string }>} */
const EDITION_SEEDS = [
  {
    tourKey: "2026 Sphere",
    editionStatus: "archive",
    campaignId: "2026-sphere",
    commsProcessId: "sphere-2026-inaugural",
  },
];

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

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          doc: "show_calendar/snapshot",
          seeds: EDITION_SEEDS,
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
  const ref = db.collection("show_calendar").doc("snapshot");
  const snap = await ref.get();
  if (!snap.exists) {
    console.error("show_calendar/snapshot is missing");
    process.exit(1);
  }
  const data = snap.data() || {};
  const groups = Array.isArray(data.showDatesByTour) ? data.showDatesByTour : [];
  let patched = 0;
  const showDatesByTour = groups.map((group) => {
    if (!group || typeof group !== "object") return group;
    const tour = typeof group.tour === "string" ? group.tour.trim() : "";
    const seed = EDITION_SEEDS.find((row) => row.tourKey === tour);
    if (!seed) return group;
    patched += 1;
    return {
      ...group,
      editionStatus: seed.editionStatus,
      campaignId: seed.campaignId,
      commsProcessId: seed.commsProcessId,
    };
  });
  const missing = EDITION_SEEDS.filter(
    (seed) => !showDatesByTour.some((group) => group && group.tour === seed.tourKey)
  );
  if (missing.length > 0) {
    console.error(
      `tour group not found: ${missing.map((row) => row.tourKey).join(", ")}`
    );
    process.exit(1);
  }
  await ref.set({ ...data, showDatesByTour }, { merge: false });
  console.log(`patched ${patched} tour group(s) on ${projectId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
