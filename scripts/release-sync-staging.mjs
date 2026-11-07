#!/usr/bin/env node
/**
 * Push main to release-sync/vX.Y.Z and open a pull request into staging.
 *
 * Uses SYNC_BOT_TOKEN only, and only one Authorization header. Checkout must
 * use persist-credentials: false so the job token's extraheader is not also
 * sent. If the token is unset, this exits 0 and does nothing.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkg = require(path.join(root, "package.json"));

const token = (process.env.SYNC_BOT_TOKEN || "").trim();
if (!token) {
  console.log("release-sync: SYNC_BOT_TOKEN is unset. Skipping the staging sync.");
  process.exit(0);
}
process.env.GH_TOKEN = token;

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
  console.error("release-sync: GITHUB_REPOSITORY is required.");
  process.exit(1);
}

const version = pkg.version;
const branch = `release-sync/v${version}`;
const remote = `https://x-access-token:${token}@github.com/${repo}.git`;

/**
 * @param {string} text
 */
function redact(text) {
  return (text || "").split(token).join("[redacted]");
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ allowFailure?: boolean }} [opts]
 */
function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0 && !opts.allowFailure) {
    console.error(redact(result.stderr));
    console.error(redact(result.stdout));
    process.exit(result.status ?? 1);
  }
  return result;
}

run("git", ["config", "--unset-all", "http.https://github.com/.extraheader"], { allowFailure: true });
run("git", ["push", remote, `HEAD:refs/heads/${branch}`]);

const [owner] = repo.split("/");
const list = run("gh", [
  "api",
  "--method",
  "GET",
  `repos/${repo}/pulls`,
  "-f",
  `head=${owner}:${branch}`,
  "-f",
  "base=staging",
  "-f",
  "state=open",
]);
const open = JSON.parse(list.stdout || "[]");
if (open.length > 0) {
  console.log(`release-sync: pull request #${open[0].number} already tracks ${branch}.`);
  process.exit(0);
}

const created = spawnSync(
  "gh",
  [
    "pr",
    "create",
    "--repo",
    repo,
    "--base",
    "staging",
    "--head",
    branch,
    "--title",
    `chore: sync Release v${version} back to staging`,
    "--body",
    [
      `Syncs \`main\` after Release v${version} back onto \`staging\`.`,
      "",
      "This is not a promote. Production already moved when that release was published.",
    ].join("\n"),
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: token },
  },
);

const combined = redact(`${created.stdout || ""}\n${created.stderr || ""}`);
if (created.status !== 0) {
  if (/no commits between/i.test(combined) || /already exists/i.test(combined)) {
    console.log("release-sync: staging already has this commit. Nothing to open.");
    process.exit(0);
  }
  console.error(combined);
  process.exit(created.status ?? 1);
}

console.log(redact(created.stdout).trim());
