#!/usr/bin/env node
/**
 * Overwrite completed-show `bustouts` and `songGaps` from a fresh Phish.net
 * fetch (#626). Does not union with the stored snapshot.
 *
 * Dry-run is the default. This script does not run in CI and must not be
 * pointed at production without a human choosing the dates.
 *
 * Usage (from `functions/`):
 *   node scripts/backfillReconcileSetlistSnapshots.js --showDates=2026-10-07
 *   node scripts/backfillReconcileSetlistSnapshots.js --showDates=2026-10-07,2026-04-16 --apply
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS or ADC.
 * Phish.net: PHISHNET_API_KEY env, or repo-root `.env`.
 *
 * `--apply` writes `bustouts` and `songGaps` only (not `officialSetlist`).
 * Pick scores and graded `users.totalPoints` are updated only when a played
 * song's bustout membership changes. `songGaps` stays display-only.
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const {
  fetchPhishnetSetlistForDate,
  normalizeSetlistRows,
} = require("../phishnetLiveSetlistAutomation");
const {
  applySnapshotReconcile,
  parseShowDateList,
  planSnapshotOverwrite,
} = require("../reconcileSetlistSnapshots");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");

/**
 * @param {string[]} argv
 * @returns {Record<string, string | true>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string | true>} */
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : true;
  }
  return out;
}

function usageAndExit(msg) {
  if (msg) console.error(`\nError: ${msg}\n`);
  console.log(
    [
      "Usage:",
      "  node scripts/backfillReconcileSetlistSnapshots.js --showDates=YYYY-MM-DD[,...]",
      "  node scripts/backfillReconcileSetlistSnapshots.js --showDates=YYYY-MM-DD[,...] --apply",
      "",
      "  --showDates   Required. Targeted completed shows. There is no scan-all mode.",
      "  --apply       Write bustouts + songGaps. Default is dry-run.",
      "",
    ].join("\n")
  );
  process.exit(msg ? 1 : 0);
}

/** @returns {Record<string, string>} */
function loadEnv() {
  /** @type {Record<string, string>} */
  const env = {};
  if (!fs.existsSync(ENV_PATH)) return env;
  const text = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) usageAndExit();

  let showDates;
  try {
    showDates = parseShowDateList(args.showDates);
  } catch (e) {
    usageAndExit(e instanceof Error ? e.message : String(e));
  }

  const fileEnv = loadEnv();
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    fileEnv.VITE_FIREBASE_PROJECT_ID ||
    "set-picks";
  const apiKey = process.env.PHISHNET_API_KEY || fileEnv.PHISHNET_API_KEY || "";
  const apply = args.apply === true;

  if (!apiKey.trim()) {
    usageAndExit("PHISHNET_API_KEY required (env or repo-root .env).");
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();

  console.log("\nbackfill-reconcile-snapshots (#626)");
  console.log(`  project: ${projectId}`);
  console.log(`  mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`  targets: ${showDates.join(", ")}`);

  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  for (const showDate of showDates) {
    const ref = db.collection("official_setlists").doc(showDate);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ${showDate}: skip (no doc)`);
      continue;
    }
    try {
      const payload = await fetchPhishnetSetlistForDate(showDate, apiKey);
      const rows = normalizeSetlistRows(payload);
      const prior = snap.data() || {};
      const plan = planSnapshotOverwrite(prior, rows);
      const bustoutLine = `[${plan.beforeBustouts.join(", ")}] → [${plan.bustouts.join(", ")}]`;
      const gapLine = plan.gapDiffs.length ? plan.gapDiffs.join("; ") : "(no gap changes)";
      console.log(`  ${showDate}: bustouts ${bustoutLine}`);
      console.log(`    songGaps ${gapLine}`);
      console.log(`    scoreReconcile: ${plan.scoreReconcileReason}`);
      if (plan.skip) {
        failed += 1;
        continue;
      }
      if (!plan.changed) {
        unchanged += 1;
        console.log("    unchanged");
        continue;
      }
      changed += 1;
      if (!apply) continue;
      const result = await applySnapshotReconcile({
        db,
        admin,
        showDate,
        plan,
      });
      console.log(
        `    wrote bustouts/songGaps; picks updated ${result.updatedPicks}; graded totals reconciled ${result.reconciledGradedPicks}`
      );
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  ${showDate}: FAILED — ${msg}`);
    }
  }

  if (!apply) {
    console.log(
      `\nDry-run complete. Changed: ${changed}. Unchanged: ${unchanged}. Failed: ${failed}. Re-run with --apply to write.`
    );
    return;
  }
  console.log(
    `\nBackfill complete. Changed: ${changed}. Unchanged: ${unchanged}. Failed: ${failed}.`
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error("\nbackfillReconcileSetlistSnapshots.js failed:");
    console.error(e instanceof Error ? e.stack || e.message : e);
    process.exit(1);
  });
}

module.exports = { parseArgs };
