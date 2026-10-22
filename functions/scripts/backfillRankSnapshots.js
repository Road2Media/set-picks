#!/usr/bin/env node
/**
 * Preview or write tour and year rank snapshots plus the badges they award (#1115).
 *
 * Dry-run is the default. It reads production and writes nothing.
 * `--apply` writes `tour_rank_snapshots`, `year_rank_snapshots`, and
 * `users/{uid}.badges`. The first apply is the historical backfill.
 * Do not run `--apply` from CI.
 *
 * Usage (from `functions/`):
 *   node scripts/backfillRankSnapshots.js
 *   node scripts/backfillRankSnapshots.js --apply
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const { freezeClosedRankSnapshots } = require("../badgeSnapshotJobs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");

function parseArgs(argv) {
  /** @type {Record<string, string | true>} */
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [k, ...rest] = arg.slice(2).split("=");
    out[k] = rest.length ? rest.join("=") : true;
  }
  return out;
}

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

function summarize(rows, key) {
  const counts = {};
  for (const row of rows) {
    const status = String(row.status || "unknown");
    counts[status] = (counts[status] || 0) + 1;
    if (status === "ready" || status === "frozen" || status === "awarded") {
      console.log(
        `  ${row[key]} ${status} awards=${row.awardsWritten ?? 0}`
      );
    } else if (status === "error") {
      console.log(`  ${row[key]} error ${row.message || ""}`);
    }
  }
  console.log("  counts:", counts);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = args.apply === true;
  const fileEnv = loadEnv();
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || fileEnv.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Project id missing");
  }

  admin.initializeApp({ projectId });
  const db = admin.firestore();

  console.log(
    `\nbackfill-rank-snapshots (#1115)\n  project: ${projectId}\n  mode: ${apply ? "APPLY" : "DRY RUN"}\n`
  );

  const summary = await freezeClosedRankSnapshots({
    db,
    admin,
    now: new Date(),
    dryRun: !apply,
    logger: console,
  });

  console.log("\nTours");
  summarize(summary.tours, "tourKey");
  console.log("\nYears");
  summarize(summary.years, "year");

  if (!apply) {
    console.log("\nDry-run complete. Re-run with --apply to write.");
  } else {
    console.log("\nApply complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
