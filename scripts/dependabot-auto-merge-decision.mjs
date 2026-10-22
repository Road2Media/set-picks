/**
 * CLI for `.github/workflows/dependabot-auto-merge.yml` (#967).
 *
 * Reads Dependabot metadata from the environment and appends
 * `action`, `reason`, and `group` to `GITHUB_OUTPUT`.
 *
 * DEPENDABOT_MODE=t0 classifies a CI failure alert and ignores `actor`,
 * so a non-Dependabot workflow actor cannot suppress the alert.
 */
import { appendFileSync } from "node:fs";

import {
  classifyDependabotAutoMerge,
  isT0DependabotPr,
} from "./lib/dependabotAutoMergePolicy.mjs";

const input = {
  author: process.env.DEPENDABOT_AUTHOR || "",
  actor: process.env.DEPENDABOT_ACTOR || "",
  baseRef: process.env.DEPENDABOT_BASE || "",
  title: process.env.DEPENDABOT_TITLE || "",
  headRef: process.env.DEPENDABOT_HEAD || "",
  dependencyGroup: process.env.DEPENDABOT_GROUP || "",
  updateType: process.env.DEPENDABOT_UPDATE_TYPE || "",
  draft: process.env.DEPENDABOT_DRAFT === "true",
  state: process.env.DEPENDABOT_STATE || "",
  metadataOk: process.env.DEPENDABOT_METADATA_OK !== "false",
};

const decision =
  process.env.DEPENDABOT_MODE === "t0"
    ? isT0DependabotPr(input)
    : classifyDependabotAutoMerge(input);

writeOutput("action", decision.action);
writeOutput("reason", decision.reason);
writeOutput("group", decision.group);
console.log(JSON.stringify(decision));

function writeOutput(key, value) {
  const safe = String(value ?? "").replace(/\r?\n/g, " ");
  const line = `${key}=${safe}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, line);
  }
}
