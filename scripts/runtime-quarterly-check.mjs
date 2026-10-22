/**
 * Open the quarterly Node/Vercel runtime reminder if one is not already open.
 * Schedule and dispatch live in `.github/workflows/runtime-quarterly-check.yml`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRuntimeQuarterlyIssue, readEnginesNode } from "./lib/runtimeQuarterlyCheck.mjs";
import { readFileSync } from "node:fs";

const token = process.env.GITHUB_TOKEN || "";
const repository = process.env.GITHUB_REPOSITORY || "";
const dryRun = process.env.DRY_RUN === "true";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!token || !repository) {
  console.error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  process.exit(1);
}

const plan = buildRuntimeQuarterlyIssue({
  enginesNode: readEnginesNode(path.join(root, "functions/package.json")),
  dependabotYml: readFileSync(path.join(root, ".github/dependabot.yml"), "utf8"),
  ciNode: "20",
  now: new Date(),
});

console.log(JSON.stringify({
  title: plan.title,
  aligned: plan.aligned,
  enginesNode: plan.enginesNode,
  ignoreFloor: plan.ignoreFloor,
  dryRun,
}));

const query = `repo:${repository} is:issue is:open "${plan.marker}" in:body`;
const existing = await githubRequest(token, `/search/issues?q=${encodeURIComponent(query)}&per_page=5`);
const open = (existing.items || []).find((item) => item.state === "open");
if (open) {
  console.log(`Quarterly check already open: #${open.number}`);
  process.exit(0);
}

if (dryRun) {
  console.log("Dry run: would open the quarterly runtime check.");
  process.exit(0);
}

const created = await githubRequest(token, `/repos/${repository}/issues`, {
  method: "POST",
  body: { title: plan.title, body: plan.body, labels: plan.labels },
});
console.log(`Opened quarterly runtime check #${created.number}`);

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
      "User-Agent": "set-picks-runtime-quarterly-check",
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
