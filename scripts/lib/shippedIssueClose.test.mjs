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
  commitsIncludeMergedPull,
  extractMergedPullNumber,
  extractStagingPin,
  featureCommitsForRelease,
  formatShippedComment,
  isPromotePullRequest,
  isReleasePullRequest,
  planShippedCloses,
  selectPreviousRelease,
  selectPromotePullRequest,
  stagingPinFromRelease,
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

  it("keeps a closing keyword between the agent body markers on a squash commit", () => {
    const text = [
      "chore(deps): migrate dependabot/fetch-metadata to v3 (#1199) (#1209)",
      "",
      "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->",
      "Closes #1199",
      "<!-- CURSOR_AGENT_PR_BODY_END -->",
    ].join("\n");
    assert.deepEqual(collectClosingIssueNumbers(text, repo), [1199]);
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

describe("v1.97.5 diverged squash history", () => {
  const tagSha = "acd38ca1ffcf595e30a6fd68b0543536c8ba191a";
  const pulls = [
    {
      number: 1210,
      title: "Release 1.97.5",
      merged_at: "2026-11-07T19:43:29Z",
      merge_commit_sha: tagSha,
      base: { ref: "main" },
      head: { ref: "cursor/release-1.97.5-0500" },
    },
    {
      number: 1197,
      title: "promote: 1.97.1",
      merged_at: "2026-10-26T03:15:00Z",
      merge_commit_sha: "7214fa21f853395c98afd4759e54f30d6b8ddafd",
      base: { ref: "main" },
      head: { ref: "release/1.97.1" },
    },
    {
      number: 1173,
      title: "promote: 1.89.0",
      merged_at: "2026-10-22T03:17:28Z",
      merge_commit_sha: "79c39f8366e813645a4b58ef13e7949df8a19a85",
      base: { ref: "main" },
      head: { ref: "staging" },
    },
  ];
  const history = [
    "Release 1.97.5 (#1210)",
    "promote: 1.97.1 (#1197)",
    "promote: 1.89.0 (#1173)",
  ];

  it("does not pick ancestor #1173 when the tag commit is release #1210", () => {
    assert.equal(isPromotePullRequest(pulls[0]), false);
    assert.equal(isReleasePullRequest(pulls[0]), true);
    assert.equal(isPromotePullRequest(pulls[2]), true);

    const byNumber = new Map(pulls.map((pr) => [pr.number, pr]));
    const walked = history
      .map((message) => byNumber.get(extractMergedPullNumber(message)))
      .find((pr) => pr && isPromotePullRequest(pr));
    assert.equal(walked.number, 1173);

    const selected = selectPromotePullRequest(pulls, {
      tag: "v1.97.5",
      publishedAt: "2026-11-07T19:43:45Z",
      mergeSha: tagSha,
      ancestorCommits: history.slice(1),
    });
    assert.equal(selected.number, 1210);
  });

  it("still prefers the release title when the tag SHA is not on the pull request", () => {
    const selected = selectPromotePullRequest(pulls, {
      tag: "v1.97.5",
      publishedAt: "2026-11-07T19:43:45Z",
      ancestorCommits: history.slice(1),
    });
    assert.equal(selected.number, 1210);
  });

  it("reads the staging pin from a one-commit tree replacement", () => {
    const message = [
      "promote: 1.97.5",
      "",
      "Replace this branch's tree with staging at 68c9d47 so the 1.97.5 production promote matches staging exactly.",
    ].join("\n");
    assert.equal(extractStagingPin(message), "68c9d47");
    assert.equal(extractStagingPin("Promotes current staging (`68c9d47`, package.json `1.97.5`)."), "68c9d47");
    assert.equal(commitsIncludeMergedPull([{ message }]), false);
    const pin = stagingPinFromRelease({
      promotePr: { number: 1210, title: "Release 1.97.5", body: "See staging (`68c9d47`)." },
      commits: [{ message }],
    });
    assert.equal(pin, "68c9d47");
  });

  it("attributes #1210 and collects closing keywords from the staging range", () => {
    const promoteCommits = [
      {
        message: [
          "promote: 1.97.5",
          "",
          "Replace this branch's tree with staging at 68c9d47 so the 1.97.5 production promote matches staging exactly.",
          "The same squash-promote gap blocked #1196; #1197 used this tree replacement.",
        ].join("\n"),
      },
    ];
    const stagingRangeCommits = [
      { message: "feat(ci): factory guardrails and idempotent release publish (#1206)\n\nRefs #1162\n" },
      { message: "chore(deps): migrate svix 1.96.1 to 2.9.1 in functions (#1208)\n\nCloses #1205\n" },
      {
        message: [
          "chore(deps): migrate dependabot/fetch-metadata to v3 (#1199) (#1209)",
          "",
          "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->",
          "Closes #1199",
          "<!-- CURSOR_AGENT_PR_BODY_END -->",
        ].join("\n"),
      },
    ];
    const chosen = featureCommitsForRelease({
      promoteCommits,
      stagingRangeCommits: stagingRangeCommits,
    });
    assert.equal(chosen.source, "staging-range");

    const plan = planShippedCloses({
      ...repo,
      tag: "v1.97.5",
      promotePr: { number: 1210, title: "Release 1.97.5", body: "Promotes staging (`68c9d47`)." },
      commits: chosen.commits,
      pullRequests: [],
      issues: [
        { number: 1199, state: "open", labels: [] },
        { number: 1205, state: "closed", labels: [] },
      ],
    });

    assert.equal(plan.decisions.some((row) => row.number === 1162), false);
    assert.equal(plan.decisions.some((row) => row.number === 1173), false);
    assert.deepEqual(
      plan.decisions.map((row) => ({ number: row.number, action: row.action, reason: row.reason })),
      [
        { number: 1199, action: "close", reason: "closing-keyword" },
        { number: 1205, action: "skip", reason: "closed" },
      ],
    );
    assert.equal(
      plan.closeComments[0].body,
      "<!-- shipped-close v1.97.5 -->\nShipped in v1.97.5 (#1210) via #1209.",
    );
    assert.deepEqual(plan.closeComments.map((row) => row.number), [1199]);
    assert.match(plan.dryRunComment, /promote #1210/);
    assert.doesNotMatch(plan.dryRunComment, /#1173/);
  });

  it("keeps feature commits that already sit on the promote pull request", () => {
    const promoteCommits = [{ message: "Send password reset from Resend (#1166)\n\nCloses #1049\n" }];
    const chosen = featureCommitsForRelease({
      promoteCommits,
      stagingRangeCommits: [{ message: "other (#9999)\n\nCloses #1\n" }],
    });
    assert.equal(chosen.source, "promote-commits");
    assert.equal(chosen.commits, promoteCommits);
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
