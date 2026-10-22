/**
 * Monday execution plan for grouped Dependabot minor/patch PRs (#1052).
 *
 * Builds on the #967 event workflow. That workflow enables squash auto-merge
 * when Dependabot opens or updates a `*-safe` pull request. This planner is
 * the scheduled backstop for PRs that event missed, plus the 7-day
 * red/conflicted alert.
 *
 * It never plans a branch update or a rebase. A commit from this workflow
 * would fail `dependabot/fetch-metadata` and the #967 revoke job would turn
 * auto-merge off. Dependabot's own rebase (default `rebase-strategy: auto`)
 * is what catches a behind-`staging` branch up as `dependabot[bot]`.
 */

import { isT0DependabotPr } from "./dependabotAutoMergePolicy.mjs";

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const SKIP_VERSION_BUMP_LABEL = "skip-version-bump";
export const STUCK_COMMENT_MARKER = "<!-- dependabot-t0-stuck-7d -->";
export const ENABLE_FAILURE_MARKER = "<!-- dependabot-t0-scheduled-enable-failure -->";
export const SCHEDULED_REVOKE_MARKER = "<!-- dependabot-t0-scheduled-revoke -->";

const DEPENDABOT_LOGIN = "dependabot[bot]";
const FAILURE_CONCLUSIONS = new Set(["failure", "timed_out", "startup_failure", "error"]);
const OBSERVED_JOBS = new Set(["verify", "build", "functions"]);

/**
 * @param {string | undefined | null} login
 * @param {string | undefined | null} email
 * @returns {boolean}
 */
export function isDependabotIdentity(login, email) {
  if (login === DEPENDABOT_LOGIN) return true;
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized.includes("dependabot[bot]@") || normalized.endsWith("@dependabot.com");
}

/**
 * Both author and committer must be Dependabot. A merge commit from
 * "Update branch" or a human push fails closed.
 *
 * @param {object | undefined | null} commit
 * @returns {boolean}
 */
export function isDependabotCommit(commit) {
  const authorOk = isDependabotIdentity(commit?.authorLogin, commit?.authorEmail);
  const committerOk = isDependabotIdentity(commit?.committerLogin, commit?.committerEmail);
  return authorOk && committerOk;
}

/**
 * @param {Array<object> | undefined | null} commits
 * @returns {{ verified: boolean, contaminated: boolean }}
 */
export function classifyDependabotCommits(commits) {
  if (!Array.isArray(commits) || commits.length === 0) {
    return { verified: false, contaminated: false };
  }
  const contaminated = commits.some((commit) => !isDependabotCommit(commit));
  return { verified: !contaminated, contaminated };
}

/**
 * @param {object} apiCommit
 * @returns {object}
 */
export function toCommitIdentity(apiCommit) {
  return {
    authorLogin: apiCommit?.author?.login || "",
    committerLogin: apiCommit?.committer?.login || "",
    authorEmail: apiCommit?.commit?.author?.email || "",
    committerEmail: apiCommit?.commit?.committer?.email || "",
    committedAt: apiCommit?.commit?.committer?.date || apiCommit?.commit?.author?.date || "",
  };
}

/**
 * @param {Array<object>} commits
 * @returns {string}
 */
export function latestCommitTime(commits) {
  let latest = "";
  let latestMs = -1;
  for (const commit of commits || []) {
    const ms = Date.parse(commit?.committedAt || "");
    if (!Number.isNaN(ms) && ms >= latestMs) {
      latestMs = ms;
      latest = commit.committedAt;
    }
  }
  return latest;
}

/**
 * Check runs and legacy commit statuses, normalized for the planner.
 *
 * @param {object} input
 * @param {Array<object>} [input.checkRuns]
 * @param {Array<object>} [input.statuses]
 * @returns {Array<{ name: string, status: string, conclusion: string, completedAt: string, headSha: string }>}
 */
export function normalizeObservationChecks({ checkRuns = [], statuses = [] } = {}) {
  const checks = [];
  for (const run of checkRuns) {
    checks.push({
      name: String(run?.name || ""),
      status: String(run?.status || (run?.conclusion ? "completed" : "")),
      conclusion: String(run?.conclusion || ""),
      completedAt: String(run?.completed_at || run?.completedAt || ""),
      headSha: String(run?.head_sha || run?.headSha || ""),
    });
  }
  for (const status of statuses) {
    const state = String(status?.state || "");
    const pending = state === "pending";
    checks.push({
      name: String(status?.context || status?.name || ""),
      status: pending ? "in_progress" : "completed",
      conclusion: state === "error" ? "failure" : state,
      completedAt: String(status?.updated_at || status?.updatedAt || status?.created_at || ""),
      headSha: String(status?.sha || ""),
    });
  }
  return checks.filter((check) => check.name);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isObservedCheck(name) {
  if (OBSERVED_JOBS.has(name)) return true;
  return /^vercel\b/i.test(name);
}

/**
 * @param {object} check
 * @returns {boolean}
 */
function isPending(check) {
  const status = String(check?.status || "").toLowerCase();
  const conclusion = String(check?.conclusion || "").toLowerCase();
  return (
    status === "queued" ||
    status === "in_progress" ||
    status === "pending" ||
    status === "waiting" ||
    conclusion === "pending"
  );
}

/**
 * @param {Array<object>} checks
 * @param {string} headSha
 * @returns {Array<object>}
 */
function checksForHead(checks, headSha) {
  if (!headSha) return checks || [];
  return (checks || []).filter((check) => !check.headSha || check.headSha === headSha);
}

/**
 * Continuous failure age: walk back from the latest completed run until a
 * non-failure. A newer in-progress run suppresses the alert for that check.
 *
 * @param {Array<object>} runs
 * @param {number} nowMs
 * @param {number} stuckAfterMs
 * @returns {string | null}
 */
function continuousFailureSince(runs, nowMs, stuckAfterMs) {
  if ((runs || []).some((run) => isPending(run))) return null;
  const completed = (runs || [])
    .filter((run) => run.completedAt && String(run.status || "completed").toLowerCase() === "completed")
    .filter((run) => !Number.isNaN(Date.parse(run.completedAt)))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  if (!completed.length) return null;
  if (!FAILURE_CONCLUSIONS.has(String(completed[0].conclusion || "").toLowerCase())) return null;
  let oldest = completed[0];
  for (const run of completed) {
    if (!FAILURE_CONCLUSIONS.has(String(run.conclusion || "").toLowerCase())) break;
    oldest = run;
  }
  const sinceMs = Date.parse(oldest.completedAt);
  if (nowMs - sinceMs < stuckAfterMs) return null;
  return oldest.completedAt;
}

/**
 * GitHub does not record when a pull request became conflicted. The head
 * commit time is the last Dependabot update. A dirty PR whose head is at
 * least 7 days old has gone through a Monday scan without a successful rebase.
 *
 * @param {object} input
 * @returns {{ alert: boolean, reason: string, since: string, details: string[] }}
 */
export function assessStuckState(input) {
  const nowMs = Date.parse(input?.now || "");
  const stuckAfterMs = input?.stuckAfterMs || SEVEN_DAYS_MS;
  const empty = { alert: false, reason: "", since: "", details: [] };
  if (Number.isNaN(nowMs)) return empty;

  const grouped = new Map();
  for (const check of checksForHead(input?.checks, input?.headSha)) {
    if (!isObservedCheck(check.name)) continue;
    if (!grouped.has(check.name)) grouped.set(check.name, []);
    grouped.get(check.name).push(check);
  }

  const details = [];
  let earliestMs = null;
  let checksFailed = false;
  for (const [name, runs] of grouped) {
    const since = continuousFailureSince(runs, nowMs, stuckAfterMs);
    if (!since) continue;
    checksFailed = true;
    details.push(`${name} has been failing since ${since}.`);
    const ms = Date.parse(since);
    if (earliestMs === null || ms < earliestMs) earliestMs = ms;
  }

  const mergeableState = String(input?.mergeableState || "").toLowerCase();
  const headMs = Date.parse(input?.headCommittedAt || "");
  const conflicted =
    mergeableState === "dirty" && !Number.isNaN(headMs) && nowMs - headMs >= stuckAfterMs;
  if (conflicted) {
    details.unshift(`Conflicted, and the newest Dependabot commit is from ${input.headCommittedAt}.`);
    if (earliestMs === null || headMs < earliestMs) earliestMs = headMs;
  }

  if (!checksFailed && !conflicted) return empty;
  let reason = "checks-failed";
  if (conflicted && checksFailed) reason = "conflicted-and-checks-failed";
  else if (conflicted) reason = "conflicted";
  return {
    alert: true,
    reason,
    since: new Date(earliestMs).toISOString(),
    details,
  };
}

/**
 * @param {object} fields
 * @param {object} input
 * @returns {object}
 */
function planResult(fields, input) {
  return {
    number: input?.number || 0,
    nodeId: input?.nodeId || "",
    t0: false,
    reason: "",
    group: "",
    actions: [],
    stuck: null,
    ...fields,
  };
}

/**
 * @param {object} input
 * @returns {object}
 */
export function planScheduledDependabotExecution(input) {
  const nowMs = Date.parse(input?.now || "");
  if (Number.isNaN(nowMs)) {
    throw new Error("planScheduledDependabotExecution requires input.now as an ISO date");
  }

  const decision = isT0DependabotPr({
    author: input?.author || "",
    baseRef: input?.baseRef || "",
    title: input?.title || "",
    headRef: input?.headRef || "",
    dependencyGroup: input?.dependencyGroup || "",
    updateType: input?.updateType || "",
    draft: input?.draft === true,
    state: input?.state || "open",
    metadataOk: input?.metadataOk !== false,
  });

  if (decision.action !== "enable") {
    return planResult(
      { t0: false, reason: decision.reason, group: decision.group, actions: [], stuck: null },
      input,
    );
  }

  const commitState = classifyDependabotCommits(input?.commits);
  if (!commitState.verified) {
    const actions = [];
    if (input?.autoMergeEnabled && commitState.contaminated) {
      actions.push({ type: "disable-automerge", reason: "non-dependabot-commit" });
    }
    return planResult(
      {
        t0: true,
        reason: commitState.contaminated ? "non-dependabot-commit" : "commits-unverified",
        group: decision.group,
        actions,
        stuck: null,
      },
      input,
    );
  }

  const actions = [];
  const labels = Array.isArray(input?.labels) ? input.labels : [];
  if (!labels.includes(SKIP_VERSION_BUMP_LABEL)) {
    actions.push({ type: "add-label", label: SKIP_VERSION_BUMP_LABEL });
  }
  if (!input?.autoMergeEnabled) {
    actions.push({ type: "enable-automerge", mergeMethod: "SQUASH" });
  }

  const stuck = assessStuckState({
    checks: input?.checks,
    headSha: input?.headSha,
    mergeableState: input?.mergeableState,
    headCommittedAt: input?.headCommittedAt,
    now: input.now,
    stuckAfterMs: input?.stuckAfterMs,
  });
  if (stuck.alert) {
    actions.push({
      type: "alert-stuck",
      reason: stuck.reason,
      since: stuck.since,
      details: stuck.details,
    });
  } else {
    actions.push({ type: "clear-stuck-alert" });
  }

  return planResult(
    { t0: true, reason: "t0-safe-group", group: decision.group, actions, stuck },
    input,
  );
}

/**
 * @param {object} action
 * @param {string} group
 * @param {string} [runUrl]
 * @returns {string}
 */
export function stuckCommentBody(action, group, runUrl) {
  return [
    STUCK_COMMENT_MARKER,
    "This `*-safe` Dependabot pull request has been red or conflicted long enough that the Monday execution sweep left it open.",
    group ? `Group: \`${group}\`.` : "",
    action?.reason ? `Reason: \`${action.reason}\`.` : "",
    ...(action?.details || []),
    "Squash auto-merge stays enabled only for a verified Dependabot `*-safe` group, and GitHub still waits for green required checks. This sweep does not push to the branch. Majors and `actions-all` are left for a human.",
    runUrl || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {string} [runUrl]
 * @returns {string}
 */
export function clearedStuckCommentBody(runUrl) {
  return [STUCK_COMMENT_MARKER, "This T0 Dependabot pull request is no longer red or conflicted. No further alert.", runUrl || ""]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {string} message
 * @param {string} [runUrl]
 * @returns {string}
 */
export function enableFailureCommentBody(message, runUrl) {
  return [
    ENABLE_FAILURE_MARKER,
    "The Monday Dependabot sweep could not enable squash auto-merge on this `*-safe` pull request.",
    message ? `Error: ${message}` : "",
    "The pull request stays open. Required checks still gate the land.",
    runUrl || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {string} [runUrl]
 * @returns {string}
 */
export function revokeCommentBody(runUrl) {
  return [
    SCHEDULED_REVOKE_MARKER,
    "The Monday sweep turned auto-merge off because a commit on this Dependabot pull request is not from `dependabot[bot]`.",
    "T0 auto-merge stays off until Dependabot pushes a branch whose commits are only Dependabot's.",
    runUrl || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
