import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  SEVEN_DAYS_MS,
  STUCK_COMMENT_MARKER,
  assessStuckState,
  isDependabotCommit,
  planScheduledDependabotExecution,
  stuckCommentBody,
} from "./dependabotScheduledExecution.mjs";
import {
  applyScheduledPlan,
  autoMergeErrorKind,
  createGitHubSweepClient,
  runDependabotScheduledSweep,
} from "./dependabotScheduledSweep.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NOW = "2026-10-22T18:00:00.000Z";
const DAY_MS = SEVEN_DAYS_MS / 7;

function isoDaysBefore(days) {
  return new Date(Date.parse(NOW) - days * DAY_MS).toISOString();
}

function dependabotCommit(committedAt = isoDaysBefore(1)) {
  return {
    authorLogin: "dependabot[bot]",
    committerLogin: "dependabot[bot]",
    authorEmail: "49699333+dependabot[bot]@users.noreply.github.com",
    committerEmail: "49699333+dependabot[bot]@users.noreply.github.com",
    committedAt,
  };
}

function safeInput(overrides = {}) {
  return {
    number: 1161,
    nodeId: "PR_node_1161",
    author: "dependabot[bot]",
    baseRef: "staging",
    title: "chore(deps): Bump the root-production-safe group across 1 directory with 5 updates",
    headRef: "dependabot/npm_and_yarn/staging/root-production-safe-2b56be94b7",
    state: "open",
    labels: ["dependencies", "skip-version-bump"],
    autoMergeEnabled: false,
    mergeableState: "clean",
    headSha: "abc123",
    headCommittedAt: isoDaysBefore(1),
    commits: [dependabotCommit(isoDaysBefore(1))],
    checks: [
      {
        name: "verify",
        status: "completed",
        conclusion: "success",
        completedAt: isoDaysBefore(0.1),
        headSha: "abc123",
      },
    ],
    now: NOW,
    metadataOk: true,
    ...overrides,
  };
}

function types(plan) {
  return plan.actions.map((action) => action.type);
}

describe("dependabot scheduled execution plan", () => {
  it("enables squash auto-merge and adds skip-version-bump when the event workflow missed the PR", () => {
    const plan = planScheduledDependabotExecution(
      safeInput({ labels: ["dependencies"], autoMergeEnabled: false }),
    );
    assert.equal(plan.t0, true);
    assert.equal(plan.reason, "t0-safe-group");
    assert.equal(plan.group, "root-production-safe");
    assert.deepEqual(types(plan), ["add-label", "enable-automerge", "clear-stuck-alert"]);
    assert.equal(plan.actions[0].label, "skip-version-bump");
    assert.equal(plan.actions[1].mergeMethod, "SQUASH");
  });

  it("does not enable again when squash auto-merge is already on and the label is present", () => {
    const plan = planScheduledDependabotExecution(safeInput({ autoMergeEnabled: true }));
    assert.deepEqual(types(plan), ["clear-stuck-alert"]);
  });

  it("accepts a Dependabot commit identified by the noreply email when login is empty", () => {
    const commit = {
      authorLogin: "",
      committerLogin: "",
      authorEmail: "49699333+dependabot[bot]@users.noreply.github.com",
      committerEmail: "49699333+dependabot[bot]@users.noreply.github.com",
      committedAt: isoDaysBefore(1),
    };
    assert.equal(isDependabotCommit(commit), true);
    const plan = planScheduledDependabotExecution(safeInput({ commits: [commit], autoMergeEnabled: true }));
    assert.equal(plan.reason, "t0-safe-group");
  });

  it("enables a major and actions-all, and skips a non-staging base or a human author", () => {
    const major = planScheduledDependabotExecution(
      safeInput({
        title: "chore(deps): Bump firebase-admin from 13.10.0 to 14.5.0",
        headRef: "dependabot/npm_and_yarn/staging/firebase-admin-14.5.0",
        dependencyGroup: "",
      }),
    );
    const actions = planScheduledDependabotExecution(
      safeInput({
        title: "chore(deps): Bump the actions-all group with 2 updates",
        headRef: "dependabot/github_actions/staging/actions-all-abcdef1234",
        dependencyGroup: "actions-all",
      }),
    );
    const router = planScheduledDependabotExecution(
      safeInput({
        title: "chore(deps): Bump react-router-dom from 6.30.3 to 7.18.2",
        headRef: "dependabot/npm_and_yarn/staging/react-router-dom-7.18.2",
        dependencyGroup: "",
        labels: ["dependencies", "skip-version-bump"],
      }),
    );
    const mainBase = planScheduledDependabotExecution(safeInput({ baseRef: "main" }));
    const human = planScheduledDependabotExecution(safeInput({ author: "pat792" }));
    assert.equal(major.t0, true);
    assert.equal(major.reason, "semver-major");
    assert.equal(major.uiCheck, false);
    assert.ok(types(major).includes("enable-automerge"));
    assert.equal(actions.t0, true);
    assert.equal(actions.reason, "version-update");
    assert.ok(types(actions).includes("enable-automerge"));
    assert.equal(router.uiCheck, true);
    assert.ok(types(router).includes("add-label"));
    assert.equal(router.actions.find((action) => action.type === "add-label").label, "ui-check");
    for (const plan of [mainBase, human]) {
      assert.equal(plan.t0, false, plan.reason);
      assert.deepEqual(plan.actions, []);
    }
  });

  it("does not enable when a commit is not from Dependabot, and disables auto-merge that was already on", () => {
    const humanCommit = {
      authorLogin: "github-actions[bot]",
      committerLogin: "github-actions[bot]",
      authorEmail: "41898282+github-actions[bot]@users.noreply.github.com",
      committerEmail: "41898282+github-actions[bot]@users.noreply.github.com",
      committedAt: isoDaysBefore(1),
    };
    const quiet = planScheduledDependabotExecution(
      safeInput({ commits: [dependabotCommit(), humanCommit], autoMergeEnabled: false }),
    );
    assert.equal(quiet.reason, "non-dependabot-commit");
    assert.deepEqual(quiet.actions, []);

    const revoke = planScheduledDependabotExecution(
      safeInput({ commits: [humanCommit], autoMergeEnabled: true }),
    );
    assert.deepEqual(types(revoke), ["disable-automerge"]);
    assert.equal(revoke.actions[0].reason, "non-dependabot-commit");
  });

  it("does not enable when the commit list could not be verified", () => {
    const plan = planScheduledDependabotExecution(safeInput({ commits: [], autoMergeEnabled: true }));
    assert.equal(plan.t0, true);
    assert.equal(plan.reason, "commits-unverified");
    assert.deepEqual(plan.actions, []);
  });

  it("leaves a behind-staging PR for Dependabot rebase and still enables auto-merge", () => {
    const plan = planScheduledDependabotExecution(
      safeInput({
        mergeableState: "behind",
        headCommittedAt: isoDaysBefore(20),
        labels: ["dependencies"],
      }),
    );
    assert.equal(plan.stuck.alert, false);
    assert.deepEqual(types(plan), ["add-label", "enable-automerge", "clear-stuck-alert"]);
    assert.equal(JSON.stringify(plan.actions).includes("update-branch"), false);
    assert.equal(JSON.stringify(plan.actions).includes("rebase"), false);
  });

  it("alerts when verify has been failing for 7 days and stays quiet before that", () => {
    const failing = (completedAt, extra = {}) => ({
      name: "verify",
      status: "completed",
      conclusion: "failure",
      completedAt,
      headSha: "abc123",
      ...extra,
    });
    const old = planScheduledDependabotExecution(
      safeInput({ checks: [failing(isoDaysBefore(8))], autoMergeEnabled: true }),
    );
    assert.equal(old.stuck.alert, true);
    assert.equal(old.stuck.reason, "checks-failed");
    assert.match(stuckCommentBody(old.actions.find((action) => action.type === "alert-stuck"), old.group), /verify has been failing/);
    assert.match(stuckCommentBody(old.actions.at(-1), old.group), new RegExp(STUCK_COMMENT_MARKER));

    const fresh = planScheduledDependabotExecution(
      safeInput({ checks: [failing(isoDaysBefore(1))], autoMergeEnabled: true }),
    );
    assert.equal(fresh.stuck.alert, false);
    assert.deepEqual(types(fresh), ["clear-stuck-alert"]);
  });

  it("counts a failure as continuous only back to the last success, and ignores an in-progress rerun", () => {
    const verify = (conclusion, days, status = "completed") => ({
      name: "verify",
      status,
      conclusion,
      completedAt: isoDaysBefore(days),
      headSha: "abc123",
    });
    const recovered = assessStuckState({
      now: NOW,
      checks: [verify("failure", 8), verify("success", 3), verify("failure", 1)],
    });
    assert.equal(recovered.alert, false);

    const stillFailing = assessStuckState({
      now: NOW,
      checks: [verify("failure", 9), verify("failure", 2)],
    });
    assert.equal(stillFailing.alert, true);
    assert.equal(stillFailing.since, isoDaysBefore(9));

    const rerunning = assessStuckState({
      now: NOW,
      checks: [verify("failure", 9), verify("", 0, "in_progress")],
    });
    assert.equal(rerunning.alert, false);
  });

  it("alerts on a functions or Vercel failure and on a conflicted head older than 7 days", () => {
    const functionsFailed = planScheduledDependabotExecution(
      safeInput({
        checks: [
          {
            name: "verify",
            status: "completed",
            conclusion: "success",
            completedAt: isoDaysBefore(1),
            headSha: "abc123",
          },
          {
            name: "functions",
            status: "completed",
            conclusion: "failure",
            completedAt: isoDaysBefore(8),
            headSha: "abc123",
          },
        ],
        autoMergeEnabled: true,
      }),
    );
    assert.equal(functionsFailed.stuck.reason, "checks-failed");
    assert.match(functionsFailed.stuck.details.join(" "), /functions has been failing/);

    const vercel = planScheduledDependabotExecution(
      safeInput({
        checks: [
          {
            name: "Vercel – set-picks",
            status: "completed",
            conclusion: "failure",
            completedAt: isoDaysBefore(8),
            headSha: "abc123",
          },
        ],
        autoMergeEnabled: true,
      }),
    );
    assert.match(vercel.stuck.details.join(" "), /Vercel/);

    const skipped = planScheduledDependabotExecution(
      safeInput({
        checks: [
          {
            name: "build",
            status: "completed",
            conclusion: "skipped",
            completedAt: isoDaysBefore(8),
            headSha: "abc123",
          },
        ],
        autoMergeEnabled: true,
      }),
    );
    assert.equal(skipped.stuck.alert, false);

    const conflicted = planScheduledDependabotExecution(
      safeInput({
        mergeableState: "dirty",
        headCommittedAt: isoDaysBefore(8),
        commits: [dependabotCommit(isoDaysBefore(8))],
        autoMergeEnabled: true,
      }),
    );
    assert.equal(conflicted.stuck.reason, "conflicted");

    const freshConflict = planScheduledDependabotExecution(
      safeInput({ mergeableState: "dirty", headCommittedAt: isoDaysBefore(1), autoMergeEnabled: true }),
    );
    assert.equal(freshConflict.stuck.alert, false);

    const both = planScheduledDependabotExecution(
      safeInput({
        mergeableState: "DIRTY",
        headCommittedAt: isoDaysBefore(10),
        commits: [dependabotCommit(isoDaysBefore(10))],
        checks: [
          {
            name: "verify",
            status: "completed",
            conclusion: "timed_out",
            completedAt: isoDaysBefore(8),
            headSha: "abc123",
          },
        ],
        autoMergeEnabled: true,
      }),
    );
    assert.equal(both.stuck.reason, "conflicted-and-checks-failed");
    assert.equal(both.stuck.since, isoDaysBefore(10));
  });

  it("ignores a failing check from a different commit", () => {
    const plan = planScheduledDependabotExecution(
      safeInput({
        checks: [
          {
            name: "verify",
            status: "completed",
            conclusion: "failure",
            completedAt: isoDaysBefore(20),
            headSha: "old",
          },
        ],
        autoMergeEnabled: true,
      }),
    );
    assert.equal(plan.stuck.alert, false);
  });

  it("requires an ISO now", () => {
    assert.throws(() => planScheduledDependabotExecution(safeInput({ now: "" })), /ISO date/);
  });
});

describe("dependabot scheduled execution apply", () => {
  it("refuses to enable a forged major and still applies the next T0 PR", async () => {
    const calls = [];
    const github = {
      async enableAutoMerge(nodeId) {
        calls.push(["enable", nodeId]);
      },
      async addLabel(number, label) {
        calls.push(["label", number, label]);
      },
      async listComments() {
        return [];
      },
      async createComment() {
        throw new Error("should not comment");
      },
      async updateComment() {
        throw new Error("should not update");
      },
    };
    const forged = {
      number: 799,
      nodeId: "PR_major",
      t0: false,
      reason: "semver-major",
      group: "",
      actions: [{ type: "enable-automerge", mergeMethod: "SQUASH" }],
    };
    const real = planScheduledDependabotExecution(safeInput({ labels: ["dependencies"] }));
    const result = await applyScheduledPlan({ github, items: [forged, real], log() {} });
    assert.equal(result.ok, false);
    assert.equal(result.results[0].ok, false);
    assert.match(result.results[0].error, /non-T0/);
    assert.equal(result.results[1].ok, true);
    assert.deepEqual(calls.map((call) => call[0]), ["label", "enable"]);
    assert.equal(calls[1][1], "PR_node_1161");
  });

  it("treats already-enabled and conflict errors as non-fatal and comments on a real enable failure", async () => {
    assert.equal(autoMergeErrorKind(new Error("Auto merge is already enabled")), "already");
    assert.equal(autoMergeErrorKind(new Error("Pull request cannot be merged due to conflicts")), "conflict");
    assert.equal(autoMergeErrorKind(new Error("Resource not accessible by integration")), "fatal");

    const comments = [];
    const github = {
      async enableAutoMerge() {
        const error = new Error("Resource not accessible by integration");
        error.data = { message: error.message };
        throw error;
      },
      async listComments() {
        return comments.map((body, index) => ({ id: index + 1, body }));
      },
      async createComment(_number, body) {
        comments.push(body);
      },
      async updateComment() {
        throw new Error("no update");
      },
    };
    const item = planScheduledDependabotExecution(safeInput({ autoMergeEnabled: false }));
    const result = await applyScheduledPlan({ github, items: [item], log() {} });
    assert.equal(result.ok, false);
    assert.match(comments[0], /dependabot-t0-scheduled-enable-failure/);
  });

  it("updates an existing stuck comment in place and clears it once the PR recovers", async () => {
    const store = [
      {
        id: 9,
        body: `${STUCK_COMMENT_MARKER}\n\nold`,
      },
    ];
    const github = {
      async listComments() {
        return store;
      },
      async updateComment(id, body) {
        const found = store.find((comment) => comment.id === id);
        found.body = body;
      },
      async createComment() {
        throw new Error("create");
      },
    };
    const stuck = planScheduledDependabotExecution(
      safeInput({
        autoMergeEnabled: true,
        checks: [
          {
            name: "verify",
            status: "completed",
            conclusion: "failure",
            completedAt: isoDaysBefore(8),
            headSha: "abc123",
          },
        ],
      }),
    );
    await applyScheduledPlan({ github, items: [stuck], runUrl: "https://example.test/run/1", log() {} });
    assert.match(store[0].body, /verify has been failing/);
    assert.match(store[0].body, /https:\/\/example.test\/run\/1/);

    const recovered = planScheduledDependabotExecution(safeInput({ autoMergeEnabled: true }));
    await applyScheduledPlan({ github, items: [recovered], log() {} });
    assert.match(store[0].body, /no longer red or conflicted/);
  });
});

describe("dependabot scheduled sweep client", () => {
  it("enables one missed group PR and a major, and keeps going when another load fails", async () => {
    const calls = [];
    const safePull = {
      number: 1161,
      node_id: "PR_node_1161",
      title: "chore(deps): Bump the root-production-safe group across 1 directory with 5 updates",
      draft: false,
      state: "open",
      user: { login: "dependabot[bot]" },
      base: { ref: "staging" },
      head: {
        ref: "dependabot/npm_and_yarn/staging/root-production-safe-2b56be94b7",
        sha: "abc123",
      },
      labels: [{ name: "dependencies" }],
      auto_merge: null,
      mergeable_state: "clean",
    };
    const brokenPull = {
      ...safePull,
      number: 1162,
      node_id: "PR_node_1162",
      head: {
        ref: "dependabot/npm_and_yarn/staging/root-development-safe-51652a77a7",
        sha: "def456",
      },
      title: "chore(deps): Bump the root-development-safe group across 1 directory with 2 updates",
    };
    const majorPull = {
      ...safePull,
      number: 1067,
      node_id: "PR_major",
      title: "chore(deps): Bump firebase-admin from 13.10.0 to 14.5.0",
      head: { ref: "dependabot/npm_and_yarn/staging/firebase-admin-14.5.0", sha: "maj" },
    };

    function jsonResponse(body, status = 200) {
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        headers: { get: () => null },
        async text() {
          return JSON.stringify(body);
        },
      };
    }

    const fetchImpl = async (url, options = {}) => {
      const method = options.method || "GET";
      calls.push({ url, method, body: options.body || "", authorization: options.headers?.Authorization || "" });
      const pathname = new URL(url).pathname;
      if (pathname.endsWith("/pulls") && url.includes("state=open")) {
        return jsonResponse([majorPull, brokenPull, safePull]);
      }
      if (pathname.endsWith("/pulls/1162")) return jsonResponse({ message: "boom" }, 500);
      if (pathname.endsWith("/pulls/1067")) return jsonResponse(majorPull);
      if (pathname.endsWith("/pulls/1067/commits")) {
        return jsonResponse([
          {
            author: { login: "dependabot[bot]" },
            committer: { login: "dependabot[bot]" },
            commit: {
              author: { email: "49699333+dependabot[bot]@users.noreply.github.com", date: isoDaysBefore(1) },
              committer: { email: "49699333+dependabot[bot]@users.noreply.github.com", date: isoDaysBefore(1) },
            },
          },
        ]);
      }
      if (pathname.endsWith("/commits/maj/check-runs")) {
        return jsonResponse({
          check_runs: [
            {
              name: "verify",
              status: "completed",
              conclusion: "success",
              completed_at: isoDaysBefore(0.1),
              head_sha: "maj",
            },
          ],
        });
      }
      if (pathname.endsWith("/commits/maj/statuses")) return jsonResponse([]);
      if (pathname.endsWith("/issues/1067/labels") && method === "POST") return jsonResponse([]);
      if (pathname.endsWith("/issues/1067/comments")) return jsonResponse([]);
      if (pathname.endsWith("/pulls/1161")) return jsonResponse(safePull);
      if (pathname.endsWith("/pulls/1161/commits")) {
        return jsonResponse([
          {
            author: { login: "dependabot[bot]" },
            committer: { login: "dependabot[bot]" },
            commit: {
              author: { email: "49699333+dependabot[bot]@users.noreply.github.com", date: isoDaysBefore(1) },
              committer: { email: "49699333+dependabot[bot]@users.noreply.github.com", date: isoDaysBefore(1) },
            },
          },
        ]);
      }
      if (pathname.endsWith("/commits/abc123/check-runs")) {
        return jsonResponse({
          check_runs: [
            {
              name: "verify",
              status: "completed",
              conclusion: "success",
              completed_at: isoDaysBefore(0.1),
              head_sha: "abc123",
            },
          ],
        });
      }
      if (pathname.endsWith("/commits/abc123/statuses")) return jsonResponse([]);
      if (pathname.endsWith("/issues/1161/labels") && method === "POST") return jsonResponse([]);
      if (pathname.endsWith("/issues/1161/comments")) return jsonResponse([]);
      if (pathname.endsWith("/graphql")) {
        const payload = JSON.parse(options.body);
        assert.equal(payload.variables.mergeMethod, "SQUASH");
        assert.ok(["PR_node_1161", "PR_major"].includes(payload.variables.pullRequestId));
        assert.doesNotMatch(JSON.stringify(payload), /"MERGE"/);
        return jsonResponse({ data: { enablePullRequestAutoMerge: { pullRequest: { number: 1161 } } } });
      }
      throw new Error(`unexpected ${method} ${url}`);
    };

    const github = createGitHubSweepClient({
      token: "test-token",
      repository: "Road2Media/set-picks",
      fetchImpl,
    });
    const result = await runDependabotScheduledSweep({
      github,
      now: NOW,
      dryRun: false,
      log() {},
    });

    assert.equal(result.considered, 2);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].number, 1162);
    const enabled = result.applied.find((item) => item.number === 1161);
    assert.equal(enabled.ok, true);
    assert.deepEqual(enabled.applied, ["add-label", "enable-automerge"]);
    assert.equal(calls.some((call) => call.url.includes("/pulls/1067")), true);
    const majorEnabled = result.applied.find((item) => item.number === 1067);
    assert.equal(majorEnabled.ok, true);
    assert.ok(majorEnabled.applied.includes("enable-automerge"));
    assert.equal(calls.some((call) => call.url.includes("update-branch")), false);
    assert.match(calls[0].authorization, /Bearer test-token/);
    const labelCall = calls.find((call) => call.url.includes("/labels"));
    assert.match(labelCall.body, /skip-version-bump/);
  });

  it("dry-run does not label or enable", async () => {
    const calls = [];
    const pull = {
      number: 1161,
      node_id: "PR_node_1161",
      title: "chore(deps): Bump the root-production-safe group across 1 directory with 5 updates",
      draft: false,
      state: "open",
      user: { login: "dependabot[bot]" },
      base: { ref: "staging" },
      head: {
        ref: "dependabot/npm_and_yarn/staging/root-production-safe-2b56be94b7",
        sha: "abc123",
      },
      labels: [{ name: "dependencies" }, { name: "skip-version-bump" }],
      auto_merge: { enabled_at: NOW },
      mergeable_state: "behind",
    };
    const fetchImpl = async (url) => {
      calls.push(url);
      const pathname = new URL(url).pathname;
      const body = pathname.endsWith("/pulls")
        ? [pull]
        : pathname.endsWith("/pulls/1161")
          ? pull
          : pathname.endsWith("/commits")
            ? [
                {
                  author: { login: "dependabot[bot]" },
                  committer: { login: "dependabot[bot]" },
                  commit: {
                    author: { email: "49699333+dependabot[bot]@users.noreply.github.com" },
                    committer: {
                      email: "49699333+dependabot[bot]@users.noreply.github.com",
                      date: isoDaysBefore(2),
                    },
                  },
                },
              ]
            : pathname.endsWith("/check-runs")
              ? { check_runs: [] }
              : pathname.endsWith("/statuses")
                ? []
                : pathname.endsWith("/comments")
                  ? []
                  : null;
      if (body === null) throw new Error(`unexpected ${url}`);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => null },
        async text() {
          return JSON.stringify(body);
        },
      };
    };
    const github = createGitHubSweepClient({
      token: "t",
      repository: "Road2Media/set-picks",
      fetchImpl,
    });
    const result = await runDependabotScheduledSweep({ github, now: NOW, dryRun: true, log() {} });
    assert.equal(result.ok, true);
    assert.equal(calls.some((url) => url.includes("/graphql") || url.includes("/labels")), false);
  });

  it("the sweep entrypoint refuses to run without a token", () => {
    const result = spawnSync(process.execPath, [path.join(root, "scripts/dependabot-scheduled-sweep.mjs")], {
      env: { ...process.env, GITHUB_TOKEN: "", GITHUB_REPOSITORY: "" },
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GITHUB_TOKEN/);
  });
});

describe("dependabot scheduled execution repo contract", () => {
  it("schedules the Monday sweep without branch updates, rebases, or merge commits", () => {
    const workflow = readFileSync(
      path.join(root, ".github/workflows/dependabot-scheduled-execution.yml"),
      "utf8",
    );
    assert.match(workflow, /cron:\s*"0 18 \* \* 1"/);
    assert.match(workflow, /node scripts\/dependabot-scheduled-sweep\.mjs/);
    assert.match(workflow, /persist-credentials:\s*false/);
    assert.match(workflow, /ref:\s*\$\{\{\s*github\.sha\s*\}\}/);
    assert.match(workflow, /pull-requests:\s*write/);
    assert.match(workflow, /issues:\s*write/);
    assert.match(workflow, /checks:\s*read/);
    assert.doesNotMatch(workflow, /pull_request/);
    assert.doesNotMatch(workflow, /update-branch/);
    assert.doesNotMatch(workflow, /@dependabot rebase/);
    assert.doesNotMatch(workflow, /"MERGE"/);

    const sources = [
      "scripts/dependabot-scheduled-sweep.mjs",
      "scripts/lib/dependabotScheduledSweep.mjs",
      "scripts/lib/dependabotScheduledExecution.mjs",
    ];
    for (const relative of sources) {
      const text = readFileSync(path.join(root, relative), "utf8");
      assert.doesNotMatch(text, /update-branch/, relative);
      assert.doesNotMatch(text, /@dependabot rebase/, relative);
      assert.doesNotMatch(text, /mergeMethod: "MERGE"/, relative);
      assert.doesNotMatch(text, /"REBASE"/, relative);
    }

    const dependabot = readFileSync(path.join(root, ".github/dependabot.yml"), "utf8");
    assert.equal((dependabot.match(/rebase-strategy: disabled/g) || []).length, 3);
    const limits = [...dependabot.matchAll(/open-pull-requests-limit:\s*(\d+)/g)].map((match) => Number(match[1]));
    assert.deepEqual(limits, [2, 2, 2]);

    const pkg = readFileSync(path.join(root, "package.json"), "utf8");
    assert.match(pkg, /dependabotScheduledExecution\.test\.mjs/);
    const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    assert.match(ci, /npm run test:dependabot-auto-merge/);
  });
});
