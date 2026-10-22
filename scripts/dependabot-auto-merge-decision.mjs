/**
 * CLI for `.github/workflows/dependabot-auto-merge.yml` (#967, #1148).
 *
 * Reads Dependabot metadata from the environment and appends
 * `action`, `reason`, `group`, `major`, and `ui-check` to `GITHUB_OUTPUT`.
 *
 * DEPENDABOT_MODE=t0 classifies a CI failure alert and ignores `actor`,
 * so a non-Dependabot workflow actor cannot suppress the alert.
 */
import { appendFileSync, readFileSync } from "node:fs";

import {
  classifyDependabotAutoMerge,
  isT0DependabotPr,
} from "./lib/dependabotAutoMergePolicy.mjs";

const bodyFile = process.env.DEPENDABOT_BODY_FILE || "";
const body = bodyFile ? readFileSync(bodyFile, "utf8") : process.env.DEPENDABOT_BODY || "";

const input = {
  author: process.env.DEPENDABOT_AUTHOR || "",
  actor: process.env.DEPENDABOT_ACTOR || "",
  baseRef: process.env.DEPENDABOT_BASE || "",
  title: process.env.DEPENDABOT_TITLE || "",
  body,
  headRef: process.env.DEPENDABOT_HEAD || "",
  dependencyGroup: process.env.DEPENDABOT_GROUP || "",
  dependencyNames: process.env.DEPENDABOT_NAMES || "",
  updateType: process.env.DEPENDABOT_UPDATE_TYPE || "",
  alertState: process.env.DEPENDABOT_ALERT_STATE || "",
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
writeOutput("major", decision.major ? "true" : "false");
writeOutput("ui-check", decision.uiCheck ? "true" : "false");
writeOutput("update-class", decision.updateClass);
console.log(JSON.stringify(decision));

function writeOutput(key, value) {
  const safe = String(value ?? "").replace(/\r?\n/g, " ");
  const line = `${key}=${safe}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, line);
  }
}
