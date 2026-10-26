/**
 * Quarterly Node and Vercel runtime check (factory dependency standard, #1148).
 *
 * The project runtime pin is `functions/package.json` `engines.node`.
 * `@types/node` majors beyond that LTS major are ignored in dependabot.yml.
 * This module only builds the reminder issue. It does not change Vercel,
 * Node, or repository settings.
 */

import { readFileSync } from "node:fs";

export const RUNTIME_CHECK_MARKER = "<!-- runtime-quarterly-check -->";
export const RUNTIME_CHECK_LABELS = ["agent-queue", "p3", "dependencies", "skip-prd"];

/**
 * @param {Date} date
 * @returns {string}
 */
export function quarterLabel(date) {
  const month = date.getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `${date.getUTCFullYear()} Q${quarter}`;
}

/**
 * @param {string} dependabotYml
 * @param {string} floor e.g. ">=25.0.0"
 * @returns {number}
 */
export function countTypesNodeIgnores(dependabotYml, floor) {
  const pattern = new RegExp(
    `dependency-name:\\s*"@types/node"[\\s\\S]*?versions:\\s*\\["${floor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\]`,
    "g",
  );
  return [...String(dependabotYml || "").matchAll(pattern)].length;
}

/**
 * @param {object} input
 * @param {string} input.enginesNode
 * @param {string} input.dependabotYml
 * @param {string} [input.ciNode]
 * @param {Date} [input.now]
 * @returns {{ title: string, body: string, labels: string[], marker: string, enginesNode: string, ignoreFloor: string, aligned: boolean }}
 */
export function buildRuntimeQuarterlyIssue(input) {
  const enginesNode = String(input?.enginesNode || "").trim();
  const major = Number.parseInt(enginesNode, 10);
  const ignoreFloor = Number.isFinite(major) ? `>=${major + 1}.0.0` : "";
  const matches = ignoreFloor ? countTypesNodeIgnores(input?.dependabotYml || "", ignoreFloor) : 0;
  const aligned = enginesNode !== "" && matches >= 2;
  const now = input?.now instanceof Date ? input.now : new Date();
  const quarter = quarterLabel(now);
  const ciNode = input?.ciNode || "20";
  const lines = [
    "[SKIP-PRD]",
    "",
    RUNTIME_CHECK_MARKER,
    "",
    `Quarterly Node and Vercel runtime check for ${quarter}.`,
    "",
    "This issue is a reminder. Opening it does not change Node, Vercel, DNS, or repository settings.",
    "",
    `- Functions runtime (\`functions/package.json\` \`engines.node\`): **${enginesNode || "missing"}**.`,
    `- \`@types/node\` ignore floor expected in both npm Dependabot entries: \`${ignoreFloor || "unknown"}\`. Found **${matches}** matching ignore blocks. ${aligned ? "The pin matches." : "The pin does not match. Update the ignore rules before the next Dependabot scan."}`,
    `- GitHub Actions \`node-version\` for verify/build is **${ciNode}**. Confirm that split from the functions runtime is still intentional.`,
    "- Vercel: open the project → Settings → General → Node.js Version. Confirm it is still the runtime you want for production builds. Do not change it from this issue unless you mean to.",
    "",
    "Runtime-pinned packages such as `@types/node` ignore majors beyond the Node LTS major this project runs. The functions `engines.node` value is that major. When you move the functions runtime to a newer LTS, raise the Dependabot ignore floor to one major above it in the same change.",
    "",
    "Security updates stay ungrouped and auto-merge when checks pass. This check is not a dependency bump.",
  ];
  return {
    title: `chore(runtime): quarterly Node and Vercel check (${quarter})`,
    body: lines.join("\n"),
    labels: [...RUNTIME_CHECK_LABELS],
    marker: RUNTIME_CHECK_MARKER,
    enginesNode,
    ignoreFloor,
    aligned,
  };
}

/**
 * @param {string} packageJsonPath
 * @returns {string}
 */
export function readEnginesNode(packageJsonPath) {
  const json = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return String(json?.engines?.node || "");
}
