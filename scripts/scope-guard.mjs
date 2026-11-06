#!/usr/bin/env node
/**
 * Pull-request scope guard. See scripts/lib/scopeGuard.mjs.
 *
 *   PR_NUMBER=123 node scripts/scope-guard.mjs
 */

import { spawnSync } from "node:child_process";

import { evaluateScopeGuard, formatScopeGuardResult } from "./lib/scopeGuard.mjs";

const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;

if (!repo || !prNumber) {
  console.error("scope-guard: PR_NUMBER and GITHUB_REPOSITORY are required.");
  process.exit(1);
}

/**
 * @param {string[]} args
 */
function gh(args) {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "gh failed");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const view = JSON.parse(
  gh(["pr", "view", prNumber, "--repo", repo, "--json", "labels,headRefName"]),
);
const filesJson = gh([
  "api",
  "--paginate",
  `repos/${repo}/pulls/${prNumber}/files`,
  "--jq",
  ".[] | {path:.filename,status}",
]);
const files = filesJson
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const result = evaluateScopeGuard({
  files,
  labels: (view.labels || []).map((label) => label.name),
  headRef: view.headRefName || "",
});
console.log(formatScopeGuardResult(result));
process.exit(result.ok ? 0 : 1);
