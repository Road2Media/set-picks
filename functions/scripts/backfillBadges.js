#!/usr/bin/env node
/**
 * Ops backfill for career badges (#568, #712) from fields already on
 * `users/{uid}`: shows, wins, points, createdAt, favoriteSong.
 *
 * Usage (from `functions/`):
 *   node scripts/backfillBadges.js
 *   node scripts/backfillBadges.js --apply
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const {
  computeUnlockedBadgeIds,
  badgeIdsToAward,
  statsFromUserDoc,
} = require("../badgeAwards");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const MAX_OPS = 450;

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

  const through =
    typeof args.through === "string" && args.through.trim()
      ? args.through.trim()
      : new Date().toISOString().slice(0, 10);

  console.log(
    `\nbackfill-badges (#568, #712)\n  project: ${projectId}\n  through: ${through}\n  mode: ${apply ? "APPLY" : "DRY RUN"}\n`
  );

  const snap = await db.collection("users").get();
  /** @type {{ uid: string, toAward: string[] }[]} */
  const plan = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const unlocked = computeUnlockedBadgeIds(statsFromUserDoc(data, through));
    const toAward = badgeIdsToAward(unlocked, data.badges);
    if (toAward.length) plan.push({ uid: doc.id, toAward });
  }

  console.log(`Users needing awards: ${plan.length}`);
  for (const row of plan.slice(0, 8)) {
    console.log(`  ${row.uid} → ${row.toAward.join(", ")}`);
  }
  if (plan.length > 8) console.log(`  … +${plan.length - 8} more`);

  if (!apply) {
    console.log("\nDry-run complete. Re-run with --apply to write.");
    return;
  }

  let batch = db.batch();
  let ops = 0;
  let awards = 0;
  const flush = async () => {
    if (!ops) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const row of plan) {
    if (ops >= MAX_OPS) await flush();
    /** @type {Record<string, object>} */
    const patch = {};
    for (const id of row.toAward) {
      patch[id] = {
        awardedAt: admin.firestore.FieldValue.serverTimestamp(),
        scope: "career",
        sourceThroughShow: through,
      };
    }
    batch.set(db.collection("users").doc(row.uid), { badges: patch }, { merge: true });
    ops += 1;
    awards += row.toAward.length;
  }
  await flush();
  console.log(`\nBackfill complete. Awards written: ${awards}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
