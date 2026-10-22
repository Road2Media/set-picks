/**
 * GitHub client and apply loop for the Monday Dependabot sweep (#1052).
 * The planner in `dependabotScheduledExecution.mjs` decides. This file only
 * reads pull requests and applies those decisions. It checks out nothing.
 */

import {
  clearedStuckCommentBody,
  enableFailureCommentBody,
  ENABLE_FAILURE_MARKER,
  latestCommitTime,
  normalizeObservationChecks,
  planScheduledDependabotExecution,
  revokeCommentBody,
  SCHEDULED_REVOKE_MARKER,
  SKIP_VERSION_BUMP_LABEL,
  stuckCommentBody,
  STUCK_COMMENT_MARKER,
  toCommitIdentity,
} from "./dependabotScheduledExecution.mjs";

const ENABLE_MUTATION = `mutation ($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
  enablePullRequestAutoMerge(input: {pullRequestId: $pullRequestId, mergeMethod: $mergeMethod}) {
    pullRequest { number }
  }
}`;

const DISABLE_MUTATION = `mutation ($pullRequestId: ID!) {
  disablePullRequestAutoMerge(input: {pullRequestId: $pullRequestId}) {
    pullRequest { number }
  }
}`;

/**
 * @param {Error & { data?: unknown }} error
 * @returns {"already" | "absent" | "conflict" | "fatal"}
 */
export function autoMergeErrorKind(error) {
  const text = `${error?.message || ""}\n${JSON.stringify(error?.data || "")}`.toLowerCase();
  const mentionsAutoMerge = /auto.?merge|automatically merge/.test(text);
  if (/already/.test(text) && mentionsAutoMerge) return "already";
  if (
    mentionsAutoMerge &&
    /not enabled|isn't enabled|is not enabled|cannot be disabled|can't disable|disabled/.test(text)
  ) {
    return "absent";
  }
  if (/conflict|dirty|not mergeable|cannot be merged|can't be merged/.test(text)) return "conflict";
  return "fatal";
}

export class GitHubApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, data?: unknown }} [extra]
   */
  constructor(message, extra = {}) {
    super(message);
    this.name = "GitHubApiError";
    this.status = extra.status;
    this.data = extra.data;
  }
}

/**
 * @param {string | null} linkHeader
 * @returns {string}
 */
function nextLink(linkHeader) {
  if (!linkHeader) return "";
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return "";
}

/**
 * @param {object} input
 * @param {string} input.token
 * @param {string} input.repository owner/repo
 * @param {typeof fetch} [input.fetchImpl]
 */
export function createGitHubSweepClient({ token, repository, fetchImpl = fetch }) {
  const [owner, repo] = String(repository || "").split("/");
  if (!owner || !repo || String(repository).split("/").length !== 2) {
    throw new Error("GITHUB_REPOSITORY must be owner/repo");
  }
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "set-picks-dependabot-scheduled-execution",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function request(url, { method = "GET", body } = {}) {
    const response = await fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text.slice(0, 500) };
      }
    }
    if (!response.ok) {
      throw new GitHubApiError(`${method} ${url} failed (${response.status}): ${data?.message || response.statusText}`, {
        status: response.status,
        data,
      });
    }
    return { data, link: response.headers.get("link") };
  }

  async function api(pathname, options) {
    const { data } = await request(`https://api.github.com${pathname}`, options);
    return data;
  }

  async function paginate(pathname) {
    const items = [];
    let url = `https://api.github.com${pathname}${pathname.includes("?") ? "&" : "?"}per_page=100`;
    for (let page = 0; url && page < 20; page += 1) {
      const { data, link } = await request(url);
      if (!Array.isArray(data)) break;
      items.push(...data);
      url = nextLink(link);
    }
    return items;
  }

  async function graphql(query, variables) {
    const data = await api("/graphql", { method: "POST", body: { query, variables } });
    if (data?.errors?.length) {
      throw new GitHubApiError(data.errors.map((error) => error.message).join("\n"), {
        status: 200,
        data,
      });
    }
    return data?.data;
  }

  return {
    owner,
    repo,
    listOpenPulls() {
      return paginate(`/repos/${owner}/${repo}/pulls?state=open&base=staging`);
    },
    getPull(number) {
      return api(`/repos/${owner}/${repo}/pulls/${number}`);
    },
    listCommits(number) {
      return paginate(`/repos/${owner}/${repo}/pulls/${number}/commits`);
    },
    async listCheckRuns(sha) {
      const runs = [];
      let url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`;
      for (let page = 0; url && page < 10; page += 1) {
        const { data, link } = await request(url);
        runs.push(...(data?.check_runs || []));
        url = nextLink(link);
      }
      return runs;
    },
    listStatuses(sha) {
      return paginate(`/repos/${owner}/${repo}/commits/${sha}/statuses`);
    },
    addLabel(number, label) {
      return api(`/repos/${owner}/${repo}/issues/${number}/labels`, {
        method: "POST",
        body: { labels: [label] },
      });
    },
    listComments(number) {
      return paginate(`/repos/${owner}/${repo}/issues/${number}/comments`);
    },
    createComment(number, body) {
      return api(`/repos/${owner}/${repo}/issues/${number}/comments`, {
        method: "POST",
        body: { body },
      });
    },
    updateComment(commentId, body) {
      return api(`/repos/${owner}/${repo}/issues/comments/${commentId}`, {
        method: "PATCH",
        body: { body },
      });
    },
    enableAutoMerge(nodeId) {
      return graphql(ENABLE_MUTATION, { pullRequestId: nodeId, mergeMethod: "SQUASH" });
    },
    disableAutoMerge(nodeId) {
      return graphql(DISABLE_MUTATION, { pullRequestId: nodeId });
    },
  };
}

/**
 * @param {object} pull
 * @returns {boolean}
 */
export function isSweepCandidate(pull) {
  return (
    pull?.user?.login === "dependabot[bot]" &&
    pull?.base?.ref === "staging" &&
    pull?.state === "open" &&
    pull?.draft !== true &&
    String(pull?.head?.ref || "").startsWith("dependabot/")
  );
}

/**
 * @param {object} pull
 * @param {string} now
 * @returns {object}
 */
function preliminaryPlan(pull, now) {
  return planScheduledDependabotExecution({
    number: pull.number,
    nodeId: pull.node_id || "",
    author: pull.user?.login || "",
    baseRef: pull.base?.ref || "",
    title: pull.title || "",
    headRef: pull.head?.ref || "",
    draft: pull.draft === true,
    state: pull.state || "open",
    labels: (pull.labels || []).map((label) => label.name).filter(Boolean),
    autoMergeEnabled: Boolean(pull.auto_merge),
    mergeableState: pull.mergeable_state || "unknown",
    headSha: pull.head?.sha || "",
    headCommittedAt: "",
    commits: [],
    checks: [],
    now,
    metadataOk: true,
  });
}

/**
 * @param {object} github
 * @param {object} listed list-endpoint pull
 * @param {string} now
 * @returns {Promise<object>}
 */
export async function loadPullPlan(github, listed, now) {
  const pull = await github.getPull(listed.number);
  const apiCommits = await github.listCommits(pull.number);
  const commits = apiCommits.map(toCommitIdentity);
  const [checkRuns, statuses] = await Promise.all([
    github.listCheckRuns(pull.head.sha),
    github.listStatuses(pull.head.sha),
  ]);
  return planScheduledDependabotExecution({
    number: pull.number,
    nodeId: pull.node_id || "",
    author: pull.user?.login || "",
    baseRef: pull.base?.ref || "",
    title: pull.title || "",
    headRef: pull.head?.ref || "",
    draft: pull.draft === true,
    state: pull.state || "open",
    labels: (pull.labels || []).map((label) => label.name).filter(Boolean),
    autoMergeEnabled: Boolean(pull.auto_merge),
    mergeableState: pull.mergeable_state || "unknown",
    headSha: pull.head?.sha || "",
    headCommittedAt: latestCommitTime(commits),
    commits,
    checks: normalizeObservationChecks({ checkRuns, statuses }),
    now,
    metadataOk: true,
  });
}

/**
 * @param {object} github
 * @param {number} number
 * @param {string} marker
 * @param {string} body
 * @param {boolean} dryRun
 * @returns {Promise<"created" | "updated" | "absent" | "dry-run">}
 */
async function upsertComment(github, number, marker, body, dryRun) {
  const comments = await github.listComments(number);
  const existing = comments.find((comment) => comment.body?.includes(marker));
  if (dryRun) return "dry-run";
  if (!existing) {
    await github.createComment(number, body);
    return "created";
  }
  if (existing.body === body) return "updated";
  await github.updateComment(existing.id, body);
  return "updated";
}

/**
 * Refuse to enable anything the planner did not classify as a verified T0 group.
 *
 * @param {object} item
 * @param {object} action
 */
function assertActionAllowed(item, action) {
  if (!item?.t0) {
    throw new Error(`refusing ${action.type} on non-T0 PR #${item?.number}`);
  }
  if (action.type === "enable-automerge") {
    if (item.reason !== "t0-safe-group") {
      throw new Error(`refusing enable on #${item.number} (${item.reason})`);
    }
    if (action.mergeMethod !== "SQUASH") {
      throw new Error(`refusing merge method ${action.mergeMethod || ""}`);
    }
  }
  if (action.type === "add-label" && action.label !== SKIP_VERSION_BUMP_LABEL) {
    throw new Error(`refusing label ${action.label || ""}`);
  }
  if (action.type === "disable-automerge" && item.reason !== "non-dependabot-commit") {
    throw new Error(`refusing disable on #${item.number} (${item.reason})`);
  }
}

/**
 * @param {object} input
 * @param {object} input.github
 * @param {object[]} input.items
 * @param {string} [input.runUrl]
 * @param {boolean} [input.dryRun]
 * @param {(line: string) => void} [input.log]
 * @returns {Promise<{ ok: boolean, results: object[] }>}
 */
export async function applyScheduledPlan({ github, items, runUrl = "", dryRun = false, log = console.log }) {
  const results = [];
  for (const item of items || []) {
    const applied = [];
    try {
      for (const action of item.actions || []) {
        assertActionAllowed(item, action);
        if (action.type === "add-label") {
          if (!dryRun) await github.addLabel(item.number, action.label);
          applied.push("add-label");
        } else if (action.type === "enable-automerge") {
          if (!dryRun) {
            try {
              await github.enableAutoMerge(item.nodeId);
              applied.push("enable-automerge");
            } catch (error) {
              const kind = autoMergeErrorKind(error);
              if (kind === "already") applied.push("enable-automerge-already");
              else if (kind === "conflict") applied.push("enable-automerge-skipped-conflict");
              else {
                await upsertComment(
                  github,
                  item.number,
                  ENABLE_FAILURE_MARKER,
                  enableFailureCommentBody(error.message, runUrl),
                  false,
                );
                throw error;
              }
            }
          } else {
            applied.push("enable-automerge");
          }
        } else if (action.type === "disable-automerge") {
          let changed = true;
          if (!dryRun) {
            try {
              await github.disableAutoMerge(item.nodeId);
            } catch (error) {
              if (autoMergeErrorKind(error) !== "absent") throw error;
              changed = false;
            }
          }
          if (changed) {
            await upsertComment(github, item.number, SCHEDULED_REVOKE_MARKER, revokeCommentBody(runUrl), dryRun);
            applied.push("disable-automerge");
          }
        } else if (action.type === "alert-stuck") {
          const body = stuckCommentBody(action, item.group, runUrl);
          const outcome = await upsertComment(github, item.number, STUCK_COMMENT_MARKER, body, dryRun);
          applied.push(`alert-stuck:${outcome}`);
        } else if (action.type === "clear-stuck-alert") {
          const comments = await github.listComments(item.number);
          const existing = (comments || []).find((comment) => comment.body?.includes(STUCK_COMMENT_MARKER));
          if (existing) {
            const body = clearedStuckCommentBody(runUrl);
            if (!dryRun && existing.body !== body) await github.updateComment(existing.id, body);
            applied.push("clear-stuck-alert");
          }
        } else {
          throw new Error(`unknown action ${action.type}`);
        }
      }
      log(`PR #${item.number} ${item.group || item.reason} ${applied.join(",") || "no-op"}`);
      results.push({ number: item.number, ok: true, applied });
    } catch (error) {
      log(`PR #${item.number} failed: ${error.message}`);
      results.push({ number: item.number, ok: false, applied, error: error.message });
    }
  }
  return { ok: results.every((result) => result.ok), results };
}

/**
 * @param {object} input
 * @param {object} input.github
 * @param {string} input.now ISO date
 * @param {string} [input.runUrl]
 * @param {boolean} [input.dryRun]
 * @param {(line: string) => void} [input.log]
 */
export async function runDependabotScheduledSweep({
  github,
  now,
  runUrl = "",
  dryRun = false,
  log = console.log,
}) {
  if (Number.isNaN(Date.parse(now || ""))) {
    throw new Error("runDependabotScheduledSweep requires now as an ISO date");
  }
  const pulls = await github.listOpenPulls();
  const items = [];
  const errors = [];
  for (const listed of pulls) {
    if (!isSweepCandidate(listed)) continue;
    const gate = preliminaryPlan(listed, now);
    if (!gate.t0) {
      log(`PR #${listed.number} skip ${gate.reason}`);
      items.push(gate);
      continue;
    }
    try {
      const plan = await loadPullPlan(github, listed, now);
      items.push(plan);
      if (!(plan.t0 && (plan.actions || []).length > 0)) {
        log(`PR #${listed.number} ${plan.group || "-"} ${plan.reason}`);
      }
    } catch (error) {
      log(`PR #${listed.number} load failed: ${error.message}`);
      errors.push({ number: listed.number, phase: "load", message: error.message });
    }
  }

  const actionable = items.filter((item) => item.t0 && (item.actions || []).length > 0);
  const applied = await applyScheduledPlan({ github, items: actionable, runUrl, dryRun, log });
  const ok = errors.length === 0 && applied.ok;
  return {
    ok,
    considered: items.length,
    dryRun,
    errors,
    applied: applied.results,
  };
}
