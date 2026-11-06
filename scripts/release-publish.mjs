#!/usr/bin/env node
/**
 * Publish a GitHub Release from the current package.json version.
 *
 * Requires explicit opt-in:
 *   npm run release:publish -- --confirm
 *
 * Idempotent: if the GitHub Release for this version already exists, exit 0
 * and do not create another tag. A tag that points at a different commit is
 * not moved.
 *
 * In GitHub Actions, SYNC_BOT_TOKEN is the token used to push the tag and
 * create the Release when it is set. A release created with the default
 * workflow token does not start other workflows (close-shipped-issues).
 * See RELEASING.md.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { commitShaForTag, planReleasePublish } from "./lib/releasePublishPlan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkg = require(path.join(root, "package.json"));

const args = process.argv.slice(2);
if (!args.includes("--confirm")) {
  console.error("Refusing to publish without --confirm");
  console.error("Usage: npm run release:publish -- --confirm [--verify] [--title \"…\"] [--notes-file path]");
  process.exit(1);
}

if (process.env.GITHUB_ACTIONS === "true" && process.env.SYNC_BOT_TOKEN) {
  process.env.GH_TOKEN = process.env.SYNC_BOT_TOKEN;
}

const publishToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

const runVerify = args.includes("--verify");
const titleIdx = args.indexOf("--title");
const notesFileIdx = args.indexOf("--notes-file");
const customTitle = titleIdx >= 0 ? args[titleIdx + 1] : null;
const notesFile = notesFileIdx >= 0 ? args[notesFileIdx + 1] : null;

/**
 * @param {string} text
 */
function redact(text) {
  if (!publishToken) return text || "";
  return (text || "").split(publishToken).join("[redacted]");
}

/**
 * @param {string} cmd
 * @param {string[]} cmdArgs
 * @param {{ allowFailure?: boolean, cwd?: string }} [opts]
 */
function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || root,
    encoding: "utf8",
  });
  if (result.status !== 0 && !opts.allowFailure) {
    if (result.stdout) console.error(redact(result.stdout));
    if (result.stderr) console.error(redact(result.stderr));
    process.exit(result.status ?? 1);
  }
  return result;
}

function extractChangelogSection(version) {
  const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const header = `## [${version}]`;
  const start = changelog.indexOf(header);
  if (start === -1) return null;
  const afterHeader = changelog.indexOf("\n", start);
  const next = changelog.indexOf("\n## [", afterHeader + 1);
  return changelog.slice(afterHeader + 1, next === -1 ? changelog.length : next).trim();
}

/**
 * @param {string} tag
 * @returns {string | null}
 */
function remoteTagCommit(tag) {
  const repo = process.env.GITHUB_REPOSITORY;
  const remoteArgs =
    repo && publishToken
      ? ["ls-remote", `https://x-access-token:${publishToken}@github.com/${repo}.git`, `refs/tags/${tag}`]
      : ["ls-remote", "origin", `refs/tags/${tag}`];
  const listed = run("git", remoteArgs, { allowFailure: true });
  if (!listed || listed.status !== 0) {
    console.error(redact(listed?.stderr || listed?.stdout || "git ls-remote failed"));
    process.exit(listed?.status ?? 1);
  }
  return commitShaForTag(tag, listed.stdout || "");
}

function releaseExists(tag) {
  const viewed = run("gh", ["release", "view", tag, "--json", "tagName"], { allowFailure: true });
  return Boolean(viewed && viewed.status === 0);
}

/**
 * @param {string} tag
 */
function pushTag(tag) {
  run("git", ["config", "--unset-all", "http.https://github.com/.extraheader"], { allowFailure: true });
  const repo = process.env.GITHUB_REPOSITORY;
  if (process.env.GITHUB_ACTIONS === "true" && repo && publishToken) {
    const remote = `https://x-access-token:${publishToken}@github.com/${repo}.git`;
    run("git", ["push", remote, `refs/tags/${tag}`]);
    return;
  }
  run("git", ["push", "origin", `refs/tags/${tag}`]);
}

const version = pkg.version;
const tag = `v${version}`;
const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const tagCommit = remoteTagCommit(tag);
const plan = planReleasePublish({
  releaseExists: releaseExists(tag),
  tagExists: Boolean(tagCommit),
  tagMatchesHead: tagCommit === head,
});

console.log(`Release plan for ${tag}: ${plan.action} (${plan.reason})`);

if (plan.action === "noop") {
  console.log(`Release ${tag} already exists. Nothing to publish.`);
  process.exit(0);
}

if (plan.action === "fail") {
  console.error(`Refusing to move existing tag ${tag}. It does not point at HEAD (${head}).`);
  process.exit(1);
}

if (process.env.GITHUB_ACTIONS === "true" && !process.env.SYNC_BOT_TOKEN) {
  console.warn(
    "SYNC_BOT_TOKEN is unset. Publishing with the workflow token. close-shipped-issues will not start from that release event. Add SYNC_BOT_TOKEN and re-run once the tag is still absent, or dispatch Close shipped issues.",
  );
}

run("node", ["scripts/release-gate.mjs", ...(runVerify ? ["--verify"] : [])]);

if (plan.action === "tag-and-release") {
  const localTag = run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}^{}`], {
    allowFailure: true,
  });
  const localSha = (localTag.stdout || "").trim();
  if (localTag.status === 0 && localSha && localSha !== head) {
    console.error(`Refusing to move local tag ${tag}. It does not point at HEAD (${head}).`);
    process.exit(1);
  }
  if (localTag.status !== 0) {
    run("git", [
      "-c",
      "user.email=github-actions[bot]@users.noreply.github.com",
      "-c",
      "user.name=github-actions[bot]",
      "tag",
      tag,
      "-m",
      `Release ${version}`,
    ]);
  }
  pushTag(tag);
}

const gateNotes = extractChangelogSection(version);
const notes =
  notesFile != null
    ? readFileSync(path.resolve(root, notesFile), "utf8")
    : gateNotes || `Release ${version}`;
const title = customTitle || `v${version}`;

const created = run(
  "gh",
  ["release", "create", tag, "--title", title, "--latest", "--notes", notes],
  { allowFailure: true },
);
if (created.status !== 0) {
  const combined = redact(`${created.stdout || ""}\n${created.stderr || ""}`);
  if (/already exists/i.test(combined)) {
    console.log(`Release ${tag} already exists. Nothing to publish.`);
    process.exit(0);
  }
  console.error(combined);
  process.exit(created.status ?? 1);
}

console.log(`\nPublished ${tag}`);
