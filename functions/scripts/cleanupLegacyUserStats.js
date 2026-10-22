#!/usr/bin/env node
/**
 * One-shot delete of the legacy `users/{uid}.stats` blob (#298).
 *
 * Launch-day user docs still carry `stats: { showsPlayed: 0, totalPoints: 0 }`.
 * Nothing in the app reads or writes it. Season backfill and rollup used
 * `set(..., { merge: true })` and never named the field, so the blob survived.
 *
 * This script deletes only that field. It does not recompute season aggregates.
 * Default is a dry run. `--apply` writes. Do not run it against production
 * from an agent session — a human with Firestore credentials runs it once.
 *
 * Usage (from `functions/`):
 *   node scripts/cleanupLegacyUserStats.js
 *   node scripts/cleanupLegacyUserStats.js --apply
 *   node scripts/cleanupLegacyUserStats.js --uids=uid-a,uid-b --apply
 *
 * Auth: Application Default Credentials (`gcloud auth application-default login`).
 * Project: `GOOGLE_CLOUD_PROJECT` or repo-root `.env` `VITE_FIREBASE_PROJECT_ID`.
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const MAX_FIRESTORE_BATCH_WRITES = 500;
const PAGE_SIZE = 500;

/**
 * @param {string[]} argv
 * @returns {Record<string, string | true>}
 */
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

function usageAndExit(msg) {
  if (msg) console.error(`\nError: ${msg}\n`);
  console.log(
    [
      "Usage:",
      "  node scripts/cleanupLegacyUserStats.js                 # dry-run",
      "  node scripts/cleanupLegacyUserStats.js --apply",
      "  node scripts/cleanupLegacyUserStats.js --uids=uid-a,uid-b --apply",
      "",
      "Deletes `users/{uid}.stats` only. Does not rewrite season aggregates.",
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
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    env[k] = v;
  }
  return env;
}

/**
 * True when the user doc still has the legacy `stats` field, including an
 * explicit null. Absent fields are left alone.
 *
 * @param {unknown} data
 * @returns {boolean}
 */
function userDocHasLegacyStats(data) {
  return Boolean(data) && typeof data === "object" && Object.prototype.hasOwnProperty.call(data, "stats");
}

/**
 * Merge payload that removes only `stats`.
 *
 * @param {{ delete: () => unknown }} FieldValue
 * @returns {{ stats: unknown }}
 */
function legacyStatsDeletePatch(FieldValue) {
  return { stats: FieldValue.delete() };
}

/**
 * @param {Array<{ id: string, data?: unknown }>} docs
 * @returns {string[]}
 */
function selectLegacyStatsUserIds(docs) {
  /** @type {string[]} */
  const ids = [];
  for (const doc of docs || []) {
    if (!doc || typeof doc.id !== "string" || !doc.id) continue;
    if (userDocHasLegacyStats(doc.data)) ids.push(doc.id);
  }
  return ids;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usageAndExit();

  const apply = args.apply === true;
  const uidFilter = typeof args.uids === "string" ? args.uids.trim() : "";
  /** @type {Set<string> | null} */
  const uidAllowlist = uidFilter
    ? new Set(
        uidFilter
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : null;

  const fileEnv = loadEnv();
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || fileEnv.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Project id missing: set GOOGLE_CLOUD_PROJECT or VITE_FIREBASE_PROJECT_ID in .env"
    );
  }

  admin.initializeApp({ projectId });
  const db = admin.firestore();

  console.log(
    [
      "",
      "cleanup-legacy-user-stats (#298)",
      `  project: ${projectId}`,
      `  mode: ${apply ? "APPLY" : "DRY RUN (no writes)"}`,
      uidAllowlist ? `  uids filter: ${[...uidAllowlist].join(", ")}` : "",
      "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  /** @type {string[]} */
  const toDelete = [];

  if (uidAllowlist) {
    const refs = [...uidAllowlist].map((uid) => db.collection("users").doc(uid));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    toDelete.push(
      ...selectLegacyStatsUserIds(
        snaps.map((snap) => ({
          id: snap.id,
          data: snap.exists ? snap.data() : null,
        }))
      )
    );
  } else {
    let last = null;
    for (;;) {
      let query = db.collection("users").orderBy("__name__").limit(PAGE_SIZE);
      if (last) query = query.startAfter(last);
      const snap = await query.get();
      if (snap.empty) break;
      toDelete.push(
        ...selectLegacyStatsUserIds(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            data: docSnap.data(),
          }))
        )
      );
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }
  }

  console.log(`users with legacy stats: ${toDelete.length}`);
  const sample = toDelete.slice(0, 10);
  if (sample.length) {
    console.log("Sample:");
    for (const uid of sample) console.log(`  ${uid}`);
  }

  if (!apply) {
    console.log("\nDry-run complete. Re-run with --apply to delete `stats` only.");
    return;
  }

  const patch = legacyStatsDeletePatch(admin.firestore.FieldValue);
  let batch = db.batch();
  let opCount = 0;
  for (const uid of toDelete) {
    if (opCount >= MAX_FIRESTORE_BATCH_WRITES) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
    batch.set(db.collection("users").doc(uid), patch, { merge: true });
    opCount += 1;
  }
  if (opCount > 0) await batch.commit();
  console.log(`\nDeleted stats on ${toDelete.length} user docs.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\ncleanupLegacyUserStats.js failed:");
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  });
}

module.exports = {
  legacyStatsDeletePatch,
  selectLegacyStatsUserIds,
  userDocHasLegacyStats,
};
