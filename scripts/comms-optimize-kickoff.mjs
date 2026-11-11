#!/usr/bin/env node
/**
 * Scheduled / manual Comms Optimize kickoff (#778).
 *
 *   npm run comms:optimize-kickoff
 *   npm run comms:optimize-kickoff -- --mode weekly --post
 *   npm run comms:optimize-kickoff -- --mode post_show --show-date 2026-07-31 --post
 *
 * --post comments on GitHub issue #573 (requires `gh` auth).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  buildKickoffMarkdown,
  calendarDateInTz,
  parseOverrideFromOptimizeForMd,
  parseShowDatesFromSource,
  resolveOptimizeKickoff,
} from "./lib/commsOptimizeSchedule.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const EPIC = 573;
const TZ = "America/Denver";

function parseArgs(argv) {
  const args = {
    mode: "auto",
    post: false,
    showDate: null,
    date: null,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--mode") args.mode = argv[++i] || "auto";
    else if (a === "--post") args.post = true;
    else if (a === "--show-date") args.showDate = argv[++i] || null;
    else if (a === "--date") args.date = argv[++i] || null;
    else if (a === "--force") args.force = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: comms-optimize-kickoff [--mode auto|weekly|post_show] [--date YYYY-MM-DD] [--show-date YYYY-MM-DD] [--post] [--force]`);
      process.exit(0);
    }
  }
  if (!["auto", "weekly", "post_show"].includes(args.mode)) {
    console.error(`Invalid --mode ${args.mode}`);
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const showDatesPath = path.join(root, "src/shared/data/showDates.js");
  const optimizeForPath = path.join(
    root,
    "docs/comms-triggers/optimize_for.md",
  );
  const showDates = parseShowDatesFromSource(
    fs.readFileSync(showDatesPath, "utf8"),
  );
  const override = parseOverrideFromOptimizeForMd(
    fs.readFileSync(optimizeForPath, "utf8"),
  );

  const todayYmd =
    args.date || calendarDateInTz(new Date(), TZ);
  const resolved = resolveOptimizeKickoff({
    mode: args.mode,
    todayYmd,
    timeZone: TZ,
    showDates,
    override,
    showDate: args.showDate,
  });

  if (resolved.action === "skip" && !args.force) {
    console.log(`SKIP: ${resolved.reason}`);
    process.exit(0);
  }

  if (resolved.action === "skip" && args.force) {
    console.error("Nothing to force-kick (resolution skipped). Use --mode weekly|post_show.");
    process.exit(1);
  }

  let body = buildKickoffMarkdown({
    optimize_for: resolved.optimize_for,
    window: resolved.window,
    mode: resolved.mode,
    showDate: resolved.showDate,
    reason: resolved.reason,
    runDate: todayYmd,
  });

  // Post-show: attach live narrative QA (#779). A failed live read skips the
  // section. The Fenway fixture stays a local/CI smoke test and is never posted.
  if (resolved.mode === "post_show" && resolved.showDate) {
    const qaScript = path.join(root, "scripts/comms-show-recap-narrative-qa.mjs");
    const qa = spawnSync(
      process.execPath,
      [qaScript, "--show-date", resolved.showDate, "--live"],
      { cwd: root, encoding: "utf8" },
    );
    if (qa.status === 0 || qa.status === 2) {
      const qaBody = String(qa.stdout || "").trim();
      body = `${body.trim()}\n\n---\n\n${qaBody}\n`;
    } else {
      const raw = String(qa.stderr || "")
        .split("\n")
        .map((s) => s.trim())
        .find(Boolean) || "live read failed";
      const line = /PRIVATE KEY|BEGIN /i.test(raw)
        ? "live read failed"
        : raw.slice(0, 240);
      body = `${body.trim()}\n\n---\n\n### Show-recap uniqueness QA — ${resolved.showDate}\n\n**Status:** skipped\n\nLive \`comms_show_context/${resolved.showDate}\` was not read. This kickoff has no sample narrative.\n\n_${line}_\n`;
    }
  }

  console.log(body);

  if (!args.post) {
    console.error("\n(dry) Pass --post to comment on GitHub issue #573.");
    return;
  }

  const r = spawnSync(
    "gh",
    ["issue", "comment", String(EPIC), "--body-file", "-"],
    {
      cwd: root,
      input: body,
      encoding: "utf8",
    },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || "gh issue comment failed");
    process.exit(r.status ?? 1);
  }
  console.error(`\nPosted kickoff comment on #${EPIC}`);
  if (r.stdout) console.error(r.stdout.trim());
}

main();
