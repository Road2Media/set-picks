/**
 * A major Dependabot update that fails required checks stays open and
 * becomes an agent-queue p3 migration issue (#1148 factory standard).
 * A later green run may still auto-merge. This module does not merge.
 */

import { extractDependencyNames } from "./dependabotAutoMergePolicy.mjs";

export const MAJOR_MIGRATION_MARKER_PREFIX = "<!-- dependabot-major-migration pr:";
export const MAJOR_MIGRATION_LABELS = ["agent-queue", "p3", "dependencies", "skip-prd"];

/**
 * @param {number | string} number
 * @returns {string}
 */
export function majorMigrationMarker(number) {
  return `${MAJOR_MIGRATION_MARKER_PREFIX}${number} -->`;
}

/**
 * @param {object} input
 * @param {number | string} input.number
 * @param {string} [input.url]
 * @param {string} [input.title]
 * @param {string} [input.body]
 * @param {string} [input.dependencyNames]
 * @returns {{ title: string, body: string, labels: string[], marker: string, packages: string[] }}
 */
export function buildMajorMigrationIssue(input) {
  const number = input?.number;
  const packages = extractDependencyNames(input);
  const label = packages.length ? packages.join(", ") : "dependency";
  const short = label.length > 80 ? `${label.slice(0, 77)}...` : label;
  const marker = majorMigrationMarker(number);
  const lines = [
    "[SKIP-PRD]",
    "",
    marker,
    "",
    `Dependabot #${number} is a major update that failed required checks. It stays open and was not merged.`,
    "",
  ];
  if (input?.url) lines.push(`Pull request: ${input.url}`, "");
  if (packages.length) lines.push(`Packages: ${packages.join(", ")}`, "");
  lines.push(
    "This is migration work. Do not merge the Dependabot pull request while checks are red. Fix the upgrade on a migration branch, or close the Dependabot pull request once that migration replaces it.",
    "",
    "If a later CI run goes green, squash auto-merge may still land the pull request. Close this issue if that happens.",
    "",
    "Visitor-facing packages (UI libraries, the router, the Firebase client SDK, Tailwind) keep the `ui-check` label so staging can be spot-checked before release.",
  );
  return {
    title: `chore(deps): migrate ${short} major (Dependabot #${number})`,
    body: lines.join("\n"),
    labels: [...MAJOR_MIGRATION_LABELS],
    marker,
    packages,
  };
}

/**
 * @param {object} input
 * @param {"failure" | "success" | string} input.mode
 * @param {boolean} input.existing
 * @returns {"create" | "keep" | "note-recovered" | "noop"}
 */
export function planMajorMigrationAction(input) {
  const mode = input?.mode;
  const existing = input?.existing === true;
  if (mode === "failure" && !existing) return "create";
  if (mode === "failure" && existing) return "keep";
  if (mode === "success" && existing) return "note-recovered";
  return "noop";
}

/**
 * @param {string} [runUrl]
 * @returns {string}
 */
export function recoveredMajorComment(runUrl) {
  return [
    "CI on this major Dependabot pull request is green again. Squash auto-merge may land it. Close this migration issue if the pull request merges.",
    runUrl || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
