/**
 * Open or update the p3 migration issue for a failed major Dependabot PR.
 * Invoked by `.github/workflows/dependabot-auto-merge.yml`. Does not merge.
 */
import { readFileSync } from "node:fs";

import {
  buildMajorMigrationIssue,
  planMajorMigrationAction,
  recoveredMajorComment,
} from "./lib/dependabotMajorMigration.mjs";

const token = process.env.GITHUB_TOKEN || "";
const repository = process.env.GITHUB_REPOSITORY || "";
const number = process.env.PR_NUMBER || "";
const mode = process.env.MIGRATION_MODE || "";
const runUrl = process.env.RUN_URL || "";

if (!token || !repository || !number) {
  console.error("GITHUB_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required");
  process.exit(1);
}

const bodyFile = process.env.PR_BODY_FILE || "";
const pr = {
  number,
  url: process.env.PR_URL || "",
  title: process.env.PR_TITLE || "",
  body: bodyFile ? readFileSync(bodyFile, "utf8") : "",
  dependencyNames: process.env.DEPENDABOT_NAMES || "",
};

const plan = buildMajorMigrationIssue(pr);
const existing = await findExistingIssue(repository, token, number, plan.marker);
const action = planMajorMigrationAction({ mode, existing: Boolean(existing) });
console.log(JSON.stringify({ action, existing: existing?.number || null, title: plan.title }));

if (action === "create") {
  const created = await githubRequest(token, `/repos/${repository}/issues`, {
    method: "POST",
    body: { title: plan.title, body: plan.body, labels: plan.labels },
  });
  console.log(`Opened migration issue #${created.number} for Dependabot #${number}`);
} else if (action === "note-recovered" && existing?.number) {
  await githubRequest(token, `/repos/${repository}/issues/${existing.number}/comments`, {
    method: "POST",
    body: { body: recoveredMajorComment(runUrl) },
  });
  console.log(`Noted recovery on migration issue #${existing.number}`);
}

/**
 * @param {string} repo
 * @param {string} auth
 * @param {string} number
 * @param {string} marker
 */
async function findExistingIssue(repo, auth, number, marker) {
  const query = `repo:${repo} is:issue "Dependabot #${number}" in:title`;
  const data = await githubRequest(auth, `/search/issues?q=${encodeURIComponent(query)}&per_page=10`);
  for (const item of data.items || []) {
    if (String(item.body || "").includes(marker)) return item;
    if (!String(item.title || "").includes(`(Dependabot #${number})`)) continue;
    const full = await githubRequest(auth, `/repos/${repo}/issues/${item.number}`);
    if (String(full.body || "").includes(marker)) return full;
  }
  return null;
}

/**
 * @param {string} auth
 * @param {string} pathname
 * @param {{ method?: string, body?: object }} [options]
 */
async function githubRequest(auth, pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      "User-Agent": "set-picks-dependabot-major-migration",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${pathname} failed (${response.status}): ${data.message || response.statusText}`);
  }
  return data;
}
