#!/usr/bin/env node
/**
 * One-time admin backfill for the #244 materialized season aggregates.
 *
 * Iterates every graded pick in Firestore, rebuilds the three per-user
 * numbers (`totalPoints`, `showsPlayed`, `wins`) and the per-tour
 * `seasonStats.{tourKey}` map from scratch, and writes them onto
 * `users/{uid}` — overwriting rather than incrementing so the result is
 * idempotent no matter how many times you run it.
 *
 * Each user write also deletes the legacy nested `stats` blob (#298).
 * Merge never named that field, so earlier backfills left it in place.
 * Users with no graded picks are not touched here; `cleanupLegacyUserStats.js`
 * scans the whole `users` collection.
 *
 * Also stamps `winCredited` on every pick so the live
 * `rollupScoresForShow` can diff wins on re-finalization (required for
 * the idempotent wins delta on future runs).
 *
 * Usage (from `functions/`):
 *   # Dry-run: report per-user diffs vs. current values; no writes.
 *   node scripts/backfillSeasonAggregates.js
 *
 *   # Execute:
 *   node scripts/backfillSeasonAggregates.js --apply
 *
 *   # Partial backfill (debug):
 *   node scripts/backfillSeasonAggregates.js --uids=uid-alice,uid-bob --apply
 *
 * Auth:
 *   Requires Application Default Credentials for firebase-admin:
 *     gcloud auth application-default login
 *   Your ADC identity must have Firestore read/write on the project.
 *
 * Project id:
 *   Read from repo-root `.env` (`VITE_FIREBASE_PROJECT_ID`) or the
 *   `GOOGLE_CLOUD_PROJECT` env var.
 *
 * Resume behavior:
 *   The script processes shows in `show_calendar/snapshot` order, batched
 *   at 500 writes per batch (Firestore limit). Interrupting mid-run leaves
 *   any committed batches in place; re-running starts from scratch but
 *   overwrites produce the same final state, so there's no drift.
 *
 * Write budget estimate:
 *   `|picks with isGraded=true| + |users with graded picks|` writes.
 *   For a mature season with ~30 shows × ~100 players, that's ~3100
 *   writes. The script prints the planned write count before applying.
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const {
  computeGlobalMaxScore,
  resolveTourKeyForDate,
  hasNonEmptyPicksObject,
} = require("../rollupSeasonAggregates");
const {
  countCorrectSlots,
  persistableActualSetlistFromOfficialDoc,
} = require("../scoringCore");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");

const MAX_FIRESTORE_BATCH_WRITES = 500;

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
      "  node scripts/backfillSeasonAggregates.js               # dry-run",
      "  node scripts/backfillSeasonAggregates.js --apply",
      "  node scripts/backfillSeasonAggregates.js --uids=uid-a,uid-b --apply",
      "",
      "Flags:",
      "  --dry-run         Default. Walks Firestore, prints per-user plan; no writes.",
      "  --apply           Actually write `users.{uid}.*` + `picks.{id}.winCredited`.",
      "  --uids=...        Comma-separated UID allowlist (debug / partial backfill).",
      "",
      "Auth:  gcloud auth application-default login",
      "Env:   GOOGLE_CLOUD_PROJECT or .env VITE_FIREBASE_PROJECT_ID",
      "",
    ].join("\n")
  );
  process.exit(msg ? 1 : 0);
}

/**
 * User-doc merge payload for one backfill row.
 * `stats: FieldValue.delete()` removes the pre-launch blob without
 * touching any other unnamed field.
 *
 * @param {{
 *   totalPoints: number,
 *   shows: number,
 *   wins: number,
 *   careerCorrectSlots: number,
 *   latestShow: string,
 *   seasonStats: Record<string, unknown>,
 * }} row
 * @param {{ serverTimestamp: () => unknown, delete: () => unknown }} FieldValue
 */
function buildSeasonAggregateUserPatch(row, FieldValue) {
  return {
    totalPoints: row.totalPoints,
    showsPlayed: row.shows,
    wins: row.wins,
    careerCorrectSlots: row.careerCorrectSlots,
    seasonStats: row.seasonStats,
    seasonStatsSnapshotAt: FieldValue.serverTimestamp(),
    seasonStatsThroughShow: row.latestShow,
    stats: FieldValue.delete(),
  };
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
 * Load the show calendar into a sorted-asc list of dates and a
 * `showDatesByTour` pass-through for `resolveTourKeyForDate`.
 *
 * @param {import("firebase-admin").firestore.Firestore} db
 */
async function loadShowCalendar(db) {
  const snap = await db.collection("show_calendar").doc("snapshot").get();
  const data = snap.exists ? snap.data() || {} : {};
  const byTour = Array.isArray(data.showDatesByTour)
    ? data.showDatesByTour
    : null;
  /** @type {string[]} */
  const dates = [];
  if (byTour) {
    for (const group of byTour) {
      if (!group || !Array.isArray(group.shows)) continue;
      for (const s of group.shows) {
        if (s && typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
          dates.push(s.date);
        }
      }
    }
  }
  dates.sort();
  // Dedupe.
  const seen = new Set();
  const unique = [];
  for (const d of dates) {
    if (seen.has(d)) continue;
    seen.add(d);
    unique.push(d);
  }
  return { dates: unique, showDatesByTour: byTour };
}

/**
 * Walk every `picks` doc for a given show date and group by user.
 *
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} showDate
 */
async function loadGradedPicksForShow(db, showDate) {
  const snap = await db
    .collection("picks")
    .where("showDate", "==", showDate)
    .get();
  /** @type {Array<{ id: string, ref: FirebaseFirestore.DocumentReference } & Record<string, unknown>>} */
  const rows = [];
  for (const d of snap.docs) {
    const data = d.data() || {};
    rows.push({ id: d.id, ref: d.ref, ...data });
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usageAndExit();

  const apply = args.apply === true;
  const dryRun = !apply;
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
      "backfill-season-aggregates (#244)",
      `  project: ${projectId}`,
      `  mode: ${dryRun ? "DRY RUN (no writes)" : "APPLY"}`,
      uidAllowlist ? `  uids filter: ${[...uidAllowlist].join(", ")}` : "",
      "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  console.log("Loading show calendar...");
  const { dates: showDates, showDatesByTour } = await loadShowCalendar(db);
  if (showDates.length === 0) {
    console.log("No show dates in show_calendar/snapshot. Nothing to do.");
    return;
  }
  console.log(`  ${showDates.length} show dates found.`);

  /**
   * Per-user rolled-up totals.
   * @type {Map<string, {
   *   totalPoints: number,
   *   shows: number,
   *   wins: number,
   *   careerCorrectSlots: number,
   *   latestShow: string,
   *   seasonStats: Record<string, { totalPoints: number, shows: number, wins: number, correctSlots: number }>,
   * }>}
   */
  const perUser = new Map();

  /** @type {{ ref: FirebaseFirestore.DocumentReference, winCredited: boolean, correctSlotsCredited: number }[]} */
  const picksToStamp = [];

  let totalGradedPicks = 0;
  let skippedEmpty = 0;

  for (const showDate of showDates) {
    const rows = await loadGradedPicksForShow(db, showDate);
    if (rows.length === 0) continue;

    // Use persisted scores directly — we're not re-grading, just
    // re-aggregating. If the stored score is wrong, that's a separate
    // fix (the bustouts backfill + rollup handles rescoring).
    const gmax = computeGlobalMaxScore(rows);
    const tourKey = resolveTourKeyForDate(showDate, showDatesByTour);

    const setlistSnap = await db
      .collection("official_setlists")
      .doc(showDate)
      .get();
    const actualSetlist = setlistSnap.exists
      ? persistableActualSetlistFromOfficialDoc(setlistSnap.data() || {})
      : null;

    for (const r of rows) {
      const uid = typeof r.userId === "string" ? r.userId : "";
      if (!uid) continue;
      if (uidAllowlist && !uidAllowlist.has(uid)) continue;

      const countsTowardSeason =
        r.isGraded === true && hasNonEmptyPicksObject(r.picks);
      if (!countsTowardSeason) {
        if (r.isGraded === true) skippedEmpty += 1;
        // Still stamp winCredited=false so re-finalize diffs cleanly.
        picksToStamp.push({
          ref: r.ref,
          winCredited: false,
          correctSlotsCredited: 0,
        });
        continue;
      }

      totalGradedPicks += 1;
      const score = typeof r.score === "number" ? r.score : 0;
      const isWin =
        typeof gmax === "number" && gmax > 0 && score === gmax;
      const correctSlots = actualSetlist
        ? countCorrectSlots(r.picks || {}, actualSetlist)
        : 0;

      const existing = perUser.get(uid) || {
        totalPoints: 0,
        shows: 0,
        wins: 0,
        careerCorrectSlots: 0,
        latestShow: "",
        seasonStats: {},
      };
      existing.totalPoints += score;
      existing.shows += 1;
      if (isWin) existing.wins += 1;
      existing.careerCorrectSlots += correctSlots;
      if (showDate > existing.latestShow) existing.latestShow = showDate;
      if (tourKey) {
        const tour = existing.seasonStats[tourKey] || {
          totalPoints: 0,
          shows: 0,
          wins: 0,
          correctSlots: 0,
        };
        tour.totalPoints += score;
        tour.shows += 1;
        if (isWin) tour.wins += 1;
        tour.correctSlots += correctSlots;
        existing.seasonStats[tourKey] = tour;
      }
      perUser.set(uid, existing);

      picksToStamp.push({
        ref: r.ref,
        winCredited: isWin,
        correctSlotsCredited: correctSlots,
      });
    }
  }

  console.log(
    [
      "",
      "Plan:",
      `  users touched            : ${perUser.size}`,
      `  graded picks processed   : ${totalGradedPicks}`,
      `  graded-but-empty skipped : ${skippedEmpty}`,
      `  pick winCredited stamps  : ${picksToStamp.length}`,
      "",
    ].join("\n")
  );

  // Report a sample of the plan even in dry-run.
  const sample = [...perUser.entries()].slice(0, 5);
  if (sample.length) {
    console.log("Sample plan (first 5 users):");
    for (const [uid, row] of sample) {
      console.log(
        `  ${uid} → totalPoints=${row.totalPoints}, shows=${row.shows}, wins=${row.wins}, ` +
          `correctSlots=${row.careerCorrectSlots}, latestShow=${row.latestShow}, tours=${Object.keys(row.seasonStats).length}`
      );
    }
    console.log("");
  }

  if (dryRun) {
    console.log("Dry-run complete. Re-run with --apply to execute the backfill.");
    return;
  }

  console.log(
    `Applying ${perUser.size} user writes + ${picksToStamp.length} pick stamps...`
  );

  let batch = db.batch();
  let opCount = 0;
  const commitIfFull = async () => {
    if (opCount >= MAX_FIRESTORE_BATCH_WRITES) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  for (const [uid, row] of perUser) {
    await commitIfFull();
    batch.set(
      db.collection("users").doc(uid),
      buildSeasonAggregateUserPatch(row, admin.firestore.FieldValue),
      { merge: true }
    );
    opCount += 1;
  }

  for (const p of picksToStamp) {
    await commitIfFull();
    batch.update(p.ref, {
      winCredited: p.winCredited,
      correctSlotsCredited: p.correctSlotsCredited,
    });
    opCount += 1;
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log("\nBackfill complete.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\nbackfillSeasonAggregates.js failed:");
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  });
}

module.exports = {
  buildSeasonAggregateUserPatch,
};
