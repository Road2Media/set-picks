#!/usr/bin/env node
/**
 * Pull-request label integrity. See scripts/lib/labelIntegrity.mjs.
 *
 *   PR_NUMBER=123 node scripts/label-integrity.mjs
 */

import { spawnSync } from "node:child_process";

import { evaluateLabelIntegrity, formatLabelIntegrityResult, isBotLogin } from "./lib/labelIntegrity.mjs";

const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;

if (!repo || !prNumber) {
  console.error("label-integrity: PR_NUMBER and GITHUB_REPOSITORY are required.");
  process.exit(1);
}

/**
 * @param {string[]} args
 * @param {{ allowFailure?: boolean }} [opts]
 */
function gh(args, opts = {}) {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    if (opts.allowFailure) return null;
    console.error(result.stderr || result.stdout || "gh failed");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const view = JSON.parse(
  gh(["pr", "view", prNumber, "--repo", repo, "--json", "labels"]),
);
const labels = (view.labels || []).map((label) => label.name);
const needsBoth = labels.includes("needs-human") && labels.includes("auto-merge-ok");

let autoMergeActor = null;
let autoMergeAt = null;
let needsHumanAt = null;
let autoMergeActorIsAdmin = false;

if (needsBoth) {
  const eventsJson = gh([
    "api",
    "--paginate",
    `repos/${repo}/issues/${prNumber}/events`,
    "--jq",
    '.[] | select(.event=="labeled") | {label:.label.name,actor:.actor.login,created_at}',
  ]);
  for (const line of eventsJson.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const event = JSON.parse(trimmed);
    if (event.label === "needs-human") {
      needsHumanAt = event.created_at;
    }
    if (event.label === "auto-merge-ok") {
      autoMergeActor = event.actor || null;
      autoMergeAt = event.created_at;
    }
  }

  if (autoMergeActor && !isBotLogin(autoMergeActor)) {
    const permissionJson = gh(
      ["api", `repos/${repo}/collaborators/${autoMergeActor}/permission`],
      { allowFailure: true },
    );
    if (permissionJson) {
      const permission = JSON.parse(permissionJson).permission;
      autoMergeActorIsAdmin = permission === "admin";
    }
  }
}

const result = evaluateLabelIntegrity({
  labels,
  autoMergeActor,
  autoMergeActorIsAdmin,
  needsHumanAt,
  autoMergeAt,
});
console.log(formatLabelIntegrityResult(result));
process.exit(result.ok ? 0 : 1);
