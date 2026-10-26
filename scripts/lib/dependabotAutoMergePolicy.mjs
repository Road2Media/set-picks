/**
 * Dependabot auto-merge policy (#967, factory standard 2026-10-22, #1148).
 *
 * Every Dependabot pull request into `staging` is eligible for squash
 * auto-merge once required checks pass. That includes minor, patch, major,
 * Actions, and security updates. GitHub still refuses to merge a red check,
 * so a failing major stays open. The CI failure path opens an `agent-queue`
 * `p3` migration issue for that major.
 *
 * `dependabot/fetch-metadata` must succeed on the event workflow before
 * auto-merge is enabled. That action fails when the PR contains a
 * non-Dependabot commit. A failed lookup must not fall open.
 *
 * Visitor-facing packages get the `ui-check` label so a human can spot-check
 * staging before release. The label does not block the merge.
 */

const DEPENDABOT_AUTHOR = "dependabot[bot]";
const SAFE_GROUP_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*-safe$/;

/**
 * Packages whose updates change what a visitor sees or interacts with.
 * Build tooling (vite, vitest, eslint) is intentionally absent.
 * `firebase` is the client SDK. `firebase-admin` is not in this list.
 */
export const VISITOR_FACING_PACKAGES = [
  "react",
  "react-dom",
  "react-router",
  "react-router-dom",
  "lucide-react",
  "tailwindcss",
  "autoprefixer",
  "postcss",
  "firebase",
  "react-markdown",
  "react-helmet-async",
  "@tanstack/react-query",
];

const ENABLE_REASONS = new Set([
  "t0-safe-group",
  "version-update",
  "semver-major",
  "security-update",
]);

/**
 * @param {string | undefined | null} title
 * @returns {boolean}
 */
export function titleHasMajorBump(title) {
  const text = String(title || "");
  const pattern = /\bfrom\s+v?(\d+)(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?\s+to\s+v?(\d+)(?:\.\d+){0,2}/gi;
  for (const match of text.matchAll(pattern)) {
    if (match[1] !== match[2]) return true;
  }
  return false;
}

/**
 * @param {string | undefined | null} text
 * @returns {boolean}
 */
export function textLooksLikeSecurityUpdate(text) {
  const value = String(text || "");
  return /security fix/i.test(value) || /GHSA-[0-9a-z-]+/i.test(value) || /CVE-\d{4}-\d+/i.test(value);
}

/**
 * @param {string | undefined | null} name
 * @returns {boolean}
 */
export function isVisitorFacingPackage(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return false;
  if (VISITOR_FACING_PACKAGES.includes(normalized)) return true;
  if (normalized.startsWith("@tailwindcss/")) return true;
  if (normalized.startsWith("@firebase/") && !normalized.includes("rules-unit-testing")) return true;
  return false;
}

/**
 * @param {object} input
 * @param {string} [input.title]
 * @param {string} [input.body]
 * @param {string} [input.dependencyNames]
 * @returns {string[]}
 */
export function extractDependencyNames(input = {}) {
  const names = new Set();
  for (const part of String(input.dependencyNames || "").split(/[,\n]/)) {
    const name = part.trim().replace(/^['"]|['"]$/g, "");
    if (name) names.add(name);
  }
  const text = `${input.title || ""}\n${input.body || ""}`;
  for (const match of text.matchAll(/\bBump\s+([^\s]+)\s+from\s+/gi)) {
    if (!/^the$/i.test(match[1])) names.add(match[1].replace(/[`,]+$/g, ""));
  }
  for (const match of text.matchAll(/Updates\s+`([^`]+)`\s+from\s+/gi)) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * @param {object} input
 * @returns {boolean}
 */
export function pullRequestNeedsUiCheck(input = {}) {
  return extractDependencyNames(input).some((name) => isVisitorFacingPackage(name));
}

/**
 * @param {string | undefined | null} headRef
 * @returns {string}
 */
export function extractSafeGroupFromHeadRef(headRef) {
  const last = String(headRef || "").split("/").pop()?.toLowerCase() || "";
  const stripped = last.replace(/-[0-9a-f]{6,}$/i, "");
  return SAFE_GROUP_NAME.test(stripped) ? stripped : "";
}

/**
 * @param {string | undefined | null} title
 * @returns {string}
 */
export function extractSafeGroupFromTitle(title) {
  const match = String(title || "")
    .toLowerCase()
    .match(/\b([a-z0-9]+(?:-[a-z0-9]+)*-safe)\b/);
  return match && SAFE_GROUP_NAME.test(match[1]) ? match[1] : "";
}

/**
 * Reasons the Monday sweep is allowed to enable squash auto-merge for.
 *
 * @param {string} reason
 * @returns {boolean}
 */
export function isAutoMergeEnableReason(reason) {
  return ENABLE_REASONS.has(reason);
}

/**
 * @param {object} fields
 * @returns {{ action: "enable" | "skip" | "revoke", reason: string, group: string, uiCheck: boolean, major: boolean, updateClass: string }}
 */
function decision(fields) {
  return {
    action: fields.action,
    reason: fields.reason,
    group: fields.group || "",
    uiCheck: fields.uiCheck === true,
    major: fields.major === true,
    updateClass: fields.updateClass || "",
  };
}

/**
 * @param {object} input
 * @param {string} [input.author]
 * @param {string} [input.actor]
 * @param {string} [input.baseRef]
 * @param {string} [input.title]
 * @param {string} [input.body]
 * @param {string} [input.headRef]
 * @param {string} [input.dependencyGroup]
 * @param {string} [input.dependencyNames]
 * @param {string} [input.updateType]
 * @param {string} [input.alertState]
 * @param {boolean} [input.draft]
 * @param {string} [input.state]
 * @param {boolean} [input.metadataOk]
 * @returns {{ action: "enable" | "skip" | "revoke", reason: string, group: string, uiCheck: boolean, major: boolean, updateClass: string }}
 */
export function classifyDependabotAutoMerge(input) {
  const author = input?.author || "";
  const actor = input?.actor || "";
  const baseRef = input?.baseRef || "";
  const title = input?.title || "";
  const headRef = input?.headRef || "";
  const draft = input?.draft === true;
  const state = input?.state || "";
  const uiCheck = pullRequestNeedsUiCheck(input);

  if (author !== DEPENDABOT_AUTHOR) {
    return decision({ action: "skip", reason: "not-dependabot-author" });
  }
  if (draft) {
    return decision({ action: "skip", reason: "draft" });
  }
  if (state && state !== "open") {
    return decision({ action: "skip", reason: "not-open" });
  }
  if (baseRef !== "staging") {
    return decision({ action: "skip", reason: "base-not-staging" });
  }
  if (headRef && !headRef.startsWith("dependabot/")) {
    return decision({ action: "skip", reason: "head-not-dependabot" });
  }
  if (actor && actor !== DEPENDABOT_AUTHOR) {
    return decision({ action: "revoke", reason: "non-dependabot-actor", uiCheck });
  }

  return classifyUpdate(input, uiCheck);
}

/**
 * Same decision as {@link classifyDependabotAutoMerge} without the
 * non-Dependabot-actor revoke. CI failure alerts use this so the workflow
 * actor cannot hide a red Dependabot PR.
 *
 * @param {object} input
 * @returns {{ action: "enable" | "skip", reason: string, group: string, uiCheck: boolean, major: boolean, updateClass: string }}
 */
export function isT0DependabotPr(input) {
  const result = classifyDependabotAutoMerge({ ...input, actor: "" });
  if (result.action === "revoke") {
    return { ...result, action: "skip" };
  }
  return result;
}

/**
 * @param {object} input
 * @param {boolean} uiCheck
 */
function classifyUpdate(input, uiCheck) {
  const title = input?.title || "";
  const body = input?.body || "";
  const headRef = input?.headRef || "";
  const metadataGroup = String(input?.dependencyGroup || "").trim().toLowerCase();
  const updateType = String(input?.updateType || "").trim();
  const alertState = String(input?.alertState || "").trim();
  const text = `${title}\n${body}`;
  const major = updateType.includes("semver-major") || titleHasMajorBump(text);
  const security = Boolean(alertState) || textLooksLikeSecurityUpdate(text);
  const guessedGroup = extractSafeGroupFromHeadRef(headRef) || extractSafeGroupFromTitle(title);

  if (input?.metadataOk === false) {
    return decision({
      action: "skip",
      reason: "metadata-unavailable",
      group: guessedGroup,
      uiCheck,
      major,
      updateClass: major ? "major" : "",
    });
  }

  let group = "";
  if (metadataGroup) group = metadataGroup;
  else group = guessedGroup;

  if (security) {
    return decision({
      action: "enable",
      reason: "security-update",
      group,
      uiCheck,
      major,
      updateClass: "security",
    });
  }

  if (major) {
    return decision({
      action: "enable",
      reason: "semver-major",
      group,
      uiCheck,
      major: true,
      updateClass: "major",
    });
  }

  const safeGroup = group && SAFE_GROUP_NAME.test(group);
  if (safeGroup && (!updateType || updateType.includes("semver-minor") || updateType.includes("semver-patch"))) {
    return decision({
      action: "enable",
      reason: "t0-safe-group",
      group,
      uiCheck,
      major: false,
      updateClass: updateType.includes("semver-patch") ? "patch" : "minor",
    });
  }

  return decision({
    action: "enable",
    reason: "version-update",
    group,
    uiCheck,
    major: false,
    updateClass: updateType.includes("semver-patch") ? "patch" : "minor",
  });
}
