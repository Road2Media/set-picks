#!/usr/bin/env node
/**
 * Ensure `deploy:functions:phishnet` includes every callable that the War Room
 * and phishnet runbooks document as part of the standard bundle.
 *
 *   npm run verify:phishnet-deploy-manifest
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));

/** Callables that must ship with the phishnet deploy script. */
const REQUIRED_EXPORTS = [
  "getPhishnetSetlist",
  "scheduledPhishnetShowCalendar",
  "refreshPhishnetShowCalendar",
  "refreshLiveScoresForShow",
  "scheduledPhishnetSongCatalog",
  "refreshPhishnetSongCatalog",
  "scheduledPickRecommendations",
  "refreshPickRecommendations",
  "scheduledPickRecommendationHistory",
  "refreshPickRecommendationHistory",
  "scheduledPhishnetLiveSetlistPoll",
  "scheduledPicksLockReminder",
  "setLiveSetlistAutomationState",
  "pollLiveSetlistNow",
  "setLiveSetlistServiceStatus",
  "sendPushCanary",
  "lockPicksForShowNow",
  "scheduledPublicTourStatsRefresh",
  "refreshPublicTourStats",
];

const script = pkg.scripts?.["deploy:functions:phishnet"];
if (!script || typeof script !== "string") {
  console.error("❌ package.json is missing scripts.deploy:functions:phishnet");
  process.exit(1);
}

const deployed = new Set(
  [...script.matchAll(/functions:([A-Za-z0-9_]+)/g)].map((m) => m[1]),
);

const missing = REQUIRED_EXPORTS.filter((name) => !deployed.has(name));
if (missing.length > 0) {
  console.error("❌ deploy:functions:phishnet is missing exports:\n");
  for (const name of missing) {
    console.error(`   - ${name}`);
  }
  console.error(
    "\nAdd them to package.json and functions/package.json deploy:functions:phishnet.",
  );
  process.exit(1);
}

const indexSource = readFileSync(path.join(root, "functions/index.js"), "utf8");
const notExported = REQUIRED_EXPORTS.filter(
  (name) => !indexSource.includes(`exports.${name}`),
);
if (notExported.length > 0) {
  console.error("❌ functions/index.js does not export:\n");
  for (const name of notExported) {
    console.error(`   - ${name}`);
  }
  process.exit(1);
}

console.log(
  `✅ phishnet deploy manifest OK (${REQUIRED_EXPORTS.length} required exports)`,
);
