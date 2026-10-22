/**
 * T0 Dependabot auto-merge policy (#967).
 *
 * Enable squash auto-merge only for Dependabot PRs into `staging` whose
 * dependency group is a `*-safe` minor/patch group. Individual majors and
 * groups that are not `*-safe` (including `actions-all`) are never enabled.
 *
 * `dependabot/fetch-metadata` must succeed before a PR can be enabled. That
 * action fails when the PR contains a non-Dependabot commit. A failed lookup
 * must not fall open from the branch name alone.
 */

const DEPENDABOT_AUTHOR = "dependabot[bot]";
const SAFE_GROUP_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*-safe$/;
const T0_UPDATE_TYPES = new Set([
  "version-update:semver-minor",
  "version-update:semver-patch",
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
 * @param {object} input
 * @param {string} [input.author]
 * @param {string} [input.actor]
 * @param {string} [input.baseRef]
 * @param {string} [input.title]
 * @param {string} [input.headRef]
 * @param {string} [input.dependencyGroup]
 * @param {string} [input.updateType]
 * @param {boolean} [input.draft]
 * @param {string} [input.state]
 * @param {boolean} [input.metadataOk]
 * @returns {{ action: "enable" | "skip" | "revoke", reason: string, group: string }}
 */
export function classifyDependabotAutoMerge(input) {
  const author = input?.author || "";
  const actor = input?.actor || "";
  const baseRef = input?.baseRef || "";
  const title = input?.title || "";
  const headRef = input?.headRef || "";
  const draft = input?.draft === true;
  const state = input?.state || "";

  if (author !== DEPENDABOT_AUTHOR) {
    return { action: "skip", reason: "not-dependabot-author", group: "" };
  }
  if (draft) {
    return { action: "skip", reason: "draft", group: "" };
  }
  if (state && state !== "open") {
    return { action: "skip", reason: "not-open", group: "" };
  }
  if (baseRef !== "staging") {
    return { action: "skip", reason: "base-not-staging", group: "" };
  }
  if (headRef && !headRef.startsWith("dependabot/")) {
    return { action: "skip", reason: "head-not-dependabot", group: "" };
  }
  if (actor && actor !== DEPENDABOT_AUTHOR) {
    return { action: "revoke", reason: "non-dependabot-actor", group: "" };
  }

  return classifyT0Group(input);
}

/**
 * Same T0 decision as {@link classifyDependabotAutoMerge} without the
 * non-Dependabot-actor revoke. CI failure alerts use this so the workflow
 * actor (not the PR author) cannot hide a red `*-safe` PR.
 *
 * @param {object} input
 * @returns {{ action: "enable" | "skip", reason: string, group: string }}
 */
export function isT0DependabotPr(input) {
  const decision = classifyDependabotAutoMerge({ ...input, actor: "" });
  if (decision.action === "revoke") {
    return { action: "skip", reason: decision.reason, group: decision.group };
  }
  return decision;
}

/**
 * @param {object} input
 * @returns {{ action: "enable" | "skip", reason: string, group: string }}
 */
function classifyT0Group(input) {
  const title = input?.title || "";
  const headRef = input?.headRef || "";
  const metadataGroup = String(input?.dependencyGroup || "").trim().toLowerCase();
  const updateType = String(input?.updateType || "").trim();

  if (input?.metadataOk === false) {
    const guessed = extractSafeGroupFromHeadRef(headRef) || extractSafeGroupFromTitle(title);
    if (guessed) {
      return { action: "skip", reason: "metadata-unavailable", group: guessed };
    }
    return { action: "skip", reason: "not-safe-group", group: "" };
  }

  if (updateType.includes("semver-major") || titleHasMajorBump(title)) {
    return { action: "skip", reason: "semver-major", group: "" };
  }

  let group = "";
  if (metadataGroup) {
    if (!metadataGroup.endsWith("-safe") || !SAFE_GROUP_NAME.test(metadataGroup)) {
      return { action: "skip", reason: "group-not-safe", group: "" };
    }
    group = metadataGroup;
  } else {
    group = extractSafeGroupFromHeadRef(headRef) || extractSafeGroupFromTitle(title);
  }

  if (!group) {
    return { action: "skip", reason: "not-safe-group", group: "" };
  }

  if (updateType && !T0_UPDATE_TYPES.has(updateType)) {
    return { action: "skip", reason: "update-type-not-t0", group: "" };
  }

  return { action: "enable", reason: "t0-safe-group", group };
}
