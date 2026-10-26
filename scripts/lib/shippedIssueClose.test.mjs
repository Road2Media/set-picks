import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectClosingIssueNumbers,
  collectFromPromote,
  classifyShippedIssue,
  commentsIncludeShipment,
  extractMergedPullNumber,
  formatShippedComment,
  isPromotePullRequest,
  planShippedCloses,
  selectPreviousRelease,
  selectPromotePullRequest,
} from "./shippedIssueClose.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repo = { owner: "Road2Media", repo: "set-picks" };

describe("collectClosingIssueNumbers", () => {
  it("collects closing keywords and a list after one keyword", () => {
    const text = [
      "Closes #1149",
      "Fixes: #12",
      "This resolves #3.",
      "fixed #9",
      "RESOLVES #4",
      "Closes #1, #2 and #3",
    ].join("\n");
    assert.deepEqual(collectClosingIssueNumbers(text, repo), [1149, 12, 3, 9, 4, 1, 2]);
  });

  it("ignores plain mentions, partial-work phrases, and negated keywords", () => {
    const text = [
      "Related: #5",
      "Related #6",
      "Part of #7",
      "Slice A of #8",
      "See #9",
      "do not close #10",
      "don't close #11",
      "closing #12",
      "closure #13",
      "disclosure #14",
    ].join("\n");
    assert.deepEqual(collectClosingIssueNumbers(text, repo), []);
  });

  it("keeps same-repo references and drops other repositories", () => {
    const text = [
      "Closes Road2Media/set-picks#10",
      "Fixes other/repo#11",
      "Resolves https://github.com/Road2Media/set-picks/issues/12",
      "Closes https://github.com/Road2Media/other/issues/13",
    ].join("\n");
    assert.deepEqual(collectClosingIssueNumbers(text, repo), [10, 12]);
  });

  it("ignores closing keywords inside fenced or inline code", () => {
    const text = ["```", "Closes #1", "```", "Use `Fixes #2` in the body.", "Closes #3"].join("\n");
    assert.deepEqual(collectClosingIssueNumbers(text, repo), [3]);
  });
});

describe("promote commit collection", () => {
  it("reads the trailing squash PR number, not an earlier issue number", () => {
    assert.equal(
      extractMergedPullNumber("feat(game): Rewind Mode (#1142) (#1188)\n\nCloses #1142\n"),
      1188,
    );
  });

  it("collects Closes from a squash body and ignores unlabeled numbers in the promote body", () => {
    const promotePr = {
      number: 1173,
      title: "promote: 1.89.0",
      body: "## Summary\n- #1166 password reset via Resend (#1049), #1167 email field (#1050).",
    };
    const commits = [
      {
        message: [
          "Send password reset from Resend (#1166)",
          "",
          "Closes #1049",
          "",
          "Related: #1050",
          "Part of #1120",
        ].join("\n"),
      },
    ];
    const collected = collectFromPromote({ ...repo, promotePr, commits, pullRequests: [] });
    assert.deepEqual(collected.featurePrNumbers, [1166]);
    assert.deepEqual(collected.references, [{ number: 1049, sourcePr: 1166 }]);
  });

  it("still reads a feature PR body when the squash subject has no keyword", () => {
    const collected = collectFromPromote({
      ...repo,
      promotePr: { number: 50, title: "promote: 1.2.3", body: "Ships staging." },
      commits: [{ message: "Tighten copy (#77)" }],
      pullRequests: [{ number: 77, title: "Tighten copy", body: "Fixes #88\nPart of #90" }],
    });
    assert.deepEqual(collected.references, [{ number: 88, sourcePr: 77 }]);
  });
});

describe("planShippedCloses", () => {
  const promotePr = { number: 456, title: "promote: 1.2.3", body: "No keywords here. See #999." };
  const commits = [{ message: "Ship the board (#789)\n\nCloses #10\nCloses #11\n" }];
  const pullRequests = [
    { number: 789, title: "Ship the board", body: "Closes #10\nResolves #12\n" },
  ];

  function issue(number, extra = {}) {
    return { number, state: "open", labels: [], ...extra };
  }

  it("closes keyword issues, skips PRs, closed issues, and keep-open", () => {
    const plan = planShippedCloses({
      ...repo,
      tag: "v1.2.3",
      promotePr,
      commits,
      pullRequests,
      issues: [
        issue(10),
        issue(11, { state: "closed" }),
        issue(12, { labels: [{ name: "keep-open" }] }),
        issue(789, { pull_request: { url: "https://example.test/789" } }),
      ],
    });

    assert.deepEqual(
      plan.decisions.map((row) => ({ number: row.number, action: row.action, reason: row.reason })),
      [
        { number: 10, action: "close", reason: "closing-keyword" },
        { number: 11, action: "skip", reason: "closed" },
        { number: 12, action: "skip", reason: "keep-open" },
      ],
    );
    assert.equal(plan.decisions.some((row) => row.number === 999), false);
    assert.equal(
      plan.closeComments[0].body,
      "<!-- shipped-close v1.2.3 -->\nShipped in v1.2.3 (#456) via #789.",
    );
    assert.match(plan.closeComments[0].body, /Shipped in v1\.2\.3 \(#456\)/);
    assert.match(plan.dryRunComment, /Would close:\n- #10 via #789/);
    assert.match(plan.dryRunComment, /#11 \(closed\)/);
    assert.match(plan.dryRunComment, /#12 \(keep-open\)/);
    assert.match(plan.dryRunComment, /Nothing was closed/);
  });

  it("does not draft a second comment when this release already commented", () => {
    const plan = planShippedCloses({
      ...repo,
      tag: "v1.2.3",
      promotePr,
      commits,
      pullRequests,
      issues: [
        issue(10, {
          comments: [{ body: "<!-- shipped-close v1.2.3 -->\nShipped in v1.2.3 (#456) via #789." }],
        }),
      ],
    });
    assert.equal(plan.decisions[0].action, "close-only");
    assert.equal(plan.decisions[0].reason, "already-commented");
    assert.deepEqual(plan.closeComments, []);
    assert.equal(
      commentsIncludeShipment(
        [{ body: "<!-- shipped-close v1.2.3 -->\nShipped in v1.2.3 (#456) via #789." }],
        "v1.2.3",
      ),
      true,
    );
  });

  it("skips a closing keyword that names a pull request", () => {
    const decision = classifyShippedIssue(
      { number: 789, state: "open", pull_request: { url: "https://example.test/789" } },
      { tag: "v1.2.3" },
    );
    assert.deepEqual(decision, { action: "skip", reason: "pull-request" });
  });

  it("names every distinct source PR and omits the promote number from the via list", () => {
    const body = formatShippedComment({ tag: "v1.2.3", promotePr: 456, sourcePrs: [40, 12, 456] });
    assert.equal(body, "<!-- shipped-close v1.2.3 -->\nShipped in v1.2.3 (#456) via #12, #40.");
  });
});

describe("release to promote PR", () => {
  const pulls = [
    {
      number: 100,
      title: "feat: hotfix",
      merged_at: "2026-10-22T03:00:00Z",
      merge_commit_sha: "aaa",
      base: { ref: "main" },
      head: { ref: "cursor/hotfix" },
    },
    {
      number: 1173,
      title: "promote: 1.89.0",
      merged_at: "2026-10-22T03:17:28Z",
      merge_commit_sha: "79c39f8",
      base: { ref: "main" },
      head: { ref: "staging" },
    },
    {
      number: 900,
      title: "promote: 1.80.0",
      merged_at: "2026-09-01T00:00:00Z",
      merge_commit_sha: "old",
      base: { ref: "main" },
      head: { ref: "promote/1.80.0" },
    },
  ];

  it("selects the promote whose merge commit is the tag", () => {
    const selected = selectPromotePullRequest(pulls, {
      tag: "v1.89.0",
      publishedAt: "2026-10-22T03:17:38Z",
      mergeSha: "79c39f8",
    });
    assert.equal(selected.number, 1173);
  });

  it("falls back to the promote title when the tag SHA is unknown", () => {
    const selected = selectPromotePullRequest(pulls, {
      tag: "v1.89.0",
      publishedAt: "2026-10-22T03:17:38Z",
    });
    assert.equal(selected.number, 1173);
  });

  it("does not treat a non-staging main PR as a promote", () => {
    assert.equal(isPromotePullRequest(pulls[0]), false);
    assert.equal(isPromotePullRequest(pulls[2]), true);
  });

  it("picks the previous non-prerelease tag", () => {
    const tag = selectPreviousRelease(
      [
        { tag_name: "v1.89.0", published_at: "2026-10-22T03:17:38Z", prerelease: false },
        { tag_name: "v1.90.0-rc.1", published_at: "2026-10-21T00:00:00Z", prerelease: true },
        { tag_name: "v1.83.1", published_at: "2026-10-20T00:00:00Z", prerelease: false },
      ],
      { tag: "v1.89.0", publishedAt: "2026-10-22T03:17:38Z" },
    );
    assert.equal(tag, "v1.83.1");
  });
});

describe("workflow contract", () => {
  const yml = readFileSync(
    path.join(root, ".github/workflows/close-shipped-issues.yml"),
    "utf8",
  );
  const permissions = yml.match(/permissions:\n([\s\S]*?)\n\n/)[1];

  it("publishes on release and exposes a dry-run dispatch", () => {
    assert.match(yml, /release:\n\s+types:\s+\[published\]/);
    assert.match(yml, /workflow_dispatch:/);
    assert.match(yml, /dry_run:/);
    assert.match(yml, /--dry-run/);
    assert.match(yml, /--confirm/);
  });

  it("grants issues write and pull-request read, and does not grant content write", () => {
    assert.match(permissions, /issues:\s*write/);
    assert.match(permissions, /pull-requests:\s*read/);
    assert.match(permissions, /contents:\s*read/);
    assert.doesNotMatch(permissions, /contents:\s*write/);
    assert.doesNotMatch(permissions, /pull-requests:\s*write/);
  });
});
