/**
 * Close issues shipped by a staging → main promote when a release is published.
 *
 *   node scripts/close-shipped-issues.mjs --tag v1.97.5 --dry-run
 *   node scripts/close-shipped-issues.mjs --tag v1.97.5 --confirm
 *
 * The promote pull request is the one whose merge commit is the tag. An older
 * squash on main (for example promote: 1.89.0 (#1173)) is an ancestor, not
 * the current release. A one-commit tree replacement reads closing keywords
 * from the staging range named by `staging at <sha>`.
 *
 * Dry run logs the would-close list and comments it on that promote PR.
 * `--confirm` comments and closes. Re-running the same tag does not comment
 * twice and does not reopen anything. Already-closed issues are left alone.
 * Pre-releases are logged and skipped on `--confirm`.
 *
 * Requires GITHUB_TOKEN (or GH_TOKEN) and GITHUB_REPOSITORY (`owner/repo`).
 */
import { pathToFileURL } from "node:url";

import {
  commitMessage,
  commitsIncludeMergedPull,
  dryRunMarker,
  extractMergedPullNumber,
  featureCommitsForRelease,
  planShippedCloses,
  selectPreviousRelease,
  selectPromotePullRequest,
  shippedCloseMarker,
  stagingPinFromRelease,
} from "./lib/shippedIssueClose.mjs";

const PAGE_CAP = 10;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

async function gh(pathname, { method = "GET", body } = {}) {
  const auth = token();
  if (!auth) throw new Error("GITHUB_TOKEN is required");
  const url = pathname.startsWith("http") ? pathname : `https://api.github.com${pathname}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "set-picks-close-shipped-issues",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`${method} ${pathname} -> ${response.status} ${data?.message || ""}`.trim());
    error.status = response.status;
    throw error;
  }
  return { data, headers: response.headers };
}

function nextUrl(headers) {
  const link = headers.get("link");
  if (!link) return null;
  const part = link.split(",").find((entry) => entry.includes('rel="next"'));
  const match = part?.match(/<([^>]+)>/);
  return match ? match[1] : null;
}

async function ghPages(pathname) {
  const rows = [];
  let url = pathname;
  for (let page = 0; page < PAGE_CAP && url; page += 1) {
    const { data, headers } = await gh(url);
    rows.push(...(Array.isArray(data) ? data : []));
    url = nextUrl(headers);
  }
  if (url) {
    console.log(`warning: stopped after ${PAGE_CAP} pages for ${pathname}`);
  }
  return rows;
}

async function resolveTagCommitSha(owner, repo, tag) {
  try {
    const { data } = await gh(`/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`);
    if (data.object?.type === "commit") return data.object.sha;
    if (data.object?.type === "tag") {
      const peeled = await gh(`/repos/${owner}/${repo}/git/tags/${data.object.sha}`);
      return peeled.data.object?.sha || null;
    }
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  return null;
}

async function listPullsForCommit(owner, repo, sha) {
  if (!sha) return [];
  try {
    return await ghPages(`/repos/${owner}/${repo}/commits/${sha}/pulls?per_page=100`);
  } catch (error) {
    if (error.status === 404 || error.status === 422) return [];
    throw error;
  }
}

async function listClosedMainPulls(owner, repo) {
  return ghPages(
    `/repos/${owner}/${repo}/pulls?state=closed&base=main&per_page=100&sort=updated&direction=desc`,
  );
}

async function listHistory(owner, repo, sha) {
  if (!sha) return [];
  const { data } = await gh(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(sha)}&per_page=30`);
  return Array.isArray(data) ? data : [];
}

async function commitTreeSha(owner, repo, sha) {
  const { data } = await gh(`/repos/${owner}/${repo}/commits/${sha}`);
  return data.commit?.tree?.sha || null;
}

async function findCommitWithTree(owner, repo, startSha, treeSha) {
  if (!startSha || !treeSha) return null;
  let url = `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(startSha)}&per_page=100`;
  for (let page = 0; page < PAGE_CAP && url; page += 1) {
    const { data, headers } = await gh(url);
    const commits = Array.isArray(data) ? data : [];
    for (const commit of commits) {
      if (commit.commit?.tree?.sha === treeSha) return commit.sha;
    }
    url = nextUrl(headers);
  }
  return null;
}

function mergePulls(primary, extra) {
  const byNumber = new Map();
  for (const pr of [...primary, ...extra]) {
    if (pr?.number && !byNumber.has(pr.number)) byNumber.set(pr.number, pr);
  }
  return [...byNumber.values()];
}

async function listPromoteCommits(owner, repo, number) {
  return ghPages(`/repos/${owner}/${repo}/pulls/${number}/commits?per_page=100`);
}

async function compareCommits(owner, repo, base, head) {
  const { data } = await gh(
    `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
  );
  if ((data.total_commits || 0) > (data.commits || []).length) {
    console.log(
      `warning: compare ${base}...${head} returned ${data.commits.length} of ${data.total_commits} commits`,
    );
  }
  return data.commits || [];
}

async function listComments(owner, repo, number) {
  return ghPages(`/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`);
}

async function upsertComment(owner, repo, number, marker, body) {
  const comments = await listComments(owner, repo, number);
  const existing = comments.find((comment) => (comment.body || "").includes(marker));
  if (existing && existing.body === body) return "unchanged";
  if (existing) {
    await gh(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: { body },
    });
    return "updated";
  }
  await gh(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: { body },
  });
  return "created";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");
  if (dryRun === confirm) {
    console.error("Pass exactly one of --dry-run or --confirm");
    process.exit(1);
  }
  const tag = argValue("--tag");
  if (!tag) {
    console.error("Pass --tag vX.Y.Z");
    process.exit(1);
  }
  const repository = argValue("--repo") || process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    console.error("Set GITHUB_REPOSITORY or pass --repo owner/repo");
    process.exit(1);
  }

  const { data: release } = await gh(`/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`);
  if (release.prerelease && confirm) {
    console.log(`${tag} is a pre-release. Issues stay open until a full release.`);
    return;
  }

  const mergeSha = await resolveTagCommitSha(owner, repo, tag);
  const associated = await listPullsForCommit(owner, repo, mergeSha);
  const listed = await listClosedMainPulls(owner, repo);
  const history = await listHistory(owner, repo, mergeSha);
  const ancestorCommits = history.filter((commit) => commit.sha !== mergeSha);
  const promotePr = selectPromotePullRequest(mergePulls(associated, listed), {
    tag,
    publishedAt: release.published_at,
    mergeSha,
    ancestorCommits,
  });
  if (promotePr && mergeSha && promotePr.merge_commit_sha && promotePr.merge_commit_sha !== mergeSha) {
    console.log(
      `warning: promote #${promotePr.number} merge commit does not equal ${tag} (${mergeSha})`,
    );
  }

  const { data: releases } = await gh(`/repos/${owner}/${repo}/releases?per_page=100`);
  const previous = selectPreviousRelease(releases, {
    tag,
    publishedAt: release.published_at,
  });

  let promoteCommits = [];
  if (promotePr) {
    promoteCommits = await listPromoteCommits(owner, repo, promotePr.number);
  }

  let stagingHead = null;
  let stagingBase = null;
  let stagingRangeCommits = [];
  if (!commitsIncludeMergedPull(promoteCommits)) {
    stagingHead = stagingPinFromRelease({ promotePr, commits: promoteCommits });
    if (!stagingHead && mergeSha) {
      const tree = await commitTreeSha(owner, repo, mergeSha);
      stagingHead = await findCommitWithTree(owner, repo, "staging", tree);
      if (stagingHead) console.log(`Matched ${tag} tree to staging ${stagingHead}.`);
    }
    if (previous && stagingHead) {
      const previousSha = await resolveTagCommitSha(owner, repo, previous);
      if (previousSha) {
        const previousPulls = await listPullsForCommit(owner, repo, previousSha);
        const previousPromote = selectPromotePullRequest(previousPulls, {
          tag: previous,
          mergeSha: previousSha,
        });
        if (previousPromote) {
          const previousCommits = await listPromoteCommits(owner, repo, previousPromote.number);
          stagingBase = stagingPinFromRelease({
            promotePr: previousPromote,
            commits: previousCommits,
          });
        }
        if (!stagingBase) {
          const tree = await commitTreeSha(owner, repo, previousSha);
          stagingBase = await findCommitWithTree(owner, repo, stagingHead, tree);
        }
      }
    }
    if (stagingHead && stagingBase) {
      console.log(`Comparing staging ${stagingBase}...${stagingHead} for ${tag}.`);
      try {
        stagingRangeCommits = await compareCommits(owner, repo, stagingBase, stagingHead);
      } catch (error) {
        if (error.status !== 404) throw error;
        console.log(`warning: compare ${stagingBase}...${stagingHead} returned 404`);
      }
    }
  }

  const chosen = featureCommitsForRelease({ promoteCommits, stagingRangeCommits });
  let commits = chosen.commits;
  let commitSource = chosen.source;
  if (!commits.length && !promotePr && previous) {
    console.log(`No promote PR matched ${tag}. Comparing ${previous}...${tag}.`);
    commits = await compareCommits(owner, repo, previous, tag);
    commitSource = "tag-range";
  } else if (!commits.length && !promotePr) {
    console.log(`No promote PR and no previous release for ${tag}.`);
  } else if (chosen.source === "promote-commits" && promotePr && !commitsIncludeMergedPull(promoteCommits)) {
    console.log(
      `Promote #${promotePr.number} has no feature commits and no staging range (${stagingBase || "?"}...${stagingHead || "?"}).`,
    );
  }

  const featureNumbers = new Set();
  for (const commit of commits) {
    const merged = extractMergedPullNumber(commitMessage(commit));
    if (merged) featureNumbers.add(merged);
  }

  const pullRequests = [];
  for (const number of featureNumbers) {
    try {
      const { data } = await gh(`/repos/${owner}/${repo}/pulls/${number}`);
      pullRequests.push(data);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }

  const preview = planShippedCloses({
    owner,
    repo,
    tag,
    promotePr,
    commits,
    pullRequests,
    issues: [],
  });
  const issueNumbers = preview.decisions.map((row) => row.number);
  const issues = [];
  for (const number of issueNumbers) {
    try {
      const { data } = await gh(`/repos/${owner}/${repo}/issues/${number}`);
      const comments =
        data.state === "closed" || data.pull_request
          ? []
          : await listComments(owner, repo, number);
      issues.push({ ...data, comments });
    } catch (error) {
      if (error.status === 404) {
        issues.push(null);
        continue;
      }
      throw error;
    }
  }

  const plan = planShippedCloses({
    owner,
    repo,
    tag,
    promotePr,
    commits,
    pullRequests,
    issues: issues.filter(Boolean),
  });

  console.log(
    JSON.stringify(
      {
        tag,
        dryRun,
        promotePr: promotePr?.number || null,
        commitSource,
        stagingBase,
        stagingHead,
        decisions: plan.decisions,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    if (promotePr) {
      const result = await upsertComment(
        owner,
        repo,
        promotePr.number,
        dryRunMarker(tag),
        plan.dryRunComment,
      );
      console.log(`Dry-run comment on #${promotePr.number}: ${result}`);
    } else {
      console.log("Dry run logged only. No promote PR to comment on.");
    }
    console.log(plan.dryRunComment);
    return;
  }

  const failures = [];
  for (const row of plan.decisions) {
    if (row.action === "skip") continue;
    try {
      if (row.action === "close") {
        const comment = plan.closeComments.find((entry) => entry.number === row.number);
        const existing = await listComments(owner, repo, row.number);
        const marker = shippedCloseMarker(tag);
        if (!existing.some((entry) => (entry.body || "").includes(marker))) {
          await gh(`/repos/${owner}/${repo}/issues/${row.number}/comments`, {
            method: "POST",
            body: { body: comment.body },
          });
        }
      }
      await gh(`/repos/${owner}/${repo}/issues/${row.number}`, {
        method: "PATCH",
        body: { state: "closed", state_reason: "completed" },
      });
      console.log(`Closed #${row.number}`);
    } catch (error) {
      failures.push({ number: row.number, message: error.message });
      console.error(`Failed #${row.number}: ${error.message}`);
    }
  }

  if (failures.length) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
