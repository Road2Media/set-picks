/**
 * Close issues shipped by a staging → main promote when a release is published.
 *
 *   node scripts/close-shipped-issues.mjs --tag v1.96.0 --dry-run
 *   node scripts/close-shipped-issues.mjs --tag v1.96.0 --confirm
 *
 * Dry run logs the would-close list and comments it on the promote PR.
 * `--confirm` comments and closes. Re-running the same tag does not comment
 * twice and does not reopen anything. Pre-releases are logged and skipped
 * on `--confirm`.
 *
 * Requires GITHUB_TOKEN (or GH_TOKEN) and GITHUB_REPOSITORY (`owner/repo`).
 */
import { pathToFileURL } from "node:url";

import {
  commitMessage,
  dryRunMarker,
  isPromotePullRequest,
  planShippedCloses,
  selectPreviousRelease,
  selectPromotePullRequest,
  shippedCloseMarker,
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

async function listCandidatePromotes(owner, repo) {
  const pulls = await ghPages(
    `/repos/${owner}/${repo}/pulls?state=closed&base=main&per_page=100&sort=updated&direction=desc`,
  );
  return pulls.filter((pr) => isPromotePullRequest(pr));
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
  const promotes = await listCandidatePromotes(owner, repo);
  const promotePr = selectPromotePullRequest(promotes, {
    tag,
    publishedAt: release.published_at,
    mergeSha,
  });

  let commits = [];
  if (promotePr) {
    commits = await listPromoteCommits(owner, repo, promotePr.number);
  } else {
    const { data: releases } = await gh(`/repos/${owner}/${repo}/releases?per_page=20`);
    const previous = selectPreviousRelease(releases, {
      tag,
      publishedAt: release.published_at,
    });
    if (previous) {
      console.log(`No promote PR matched ${tag}. Comparing ${previous}...${tag}.`);
      commits = await compareCommits(owner, repo, previous, tag);
    } else {
      console.log(`No promote PR and no previous release for ${tag}.`);
    }
  }

  const featureNumbers = new Set();
  for (const commit of commits) {
    const subject = commitMessage(commit).split(/\r?\n/, 1)[0];
    const matches = [...subject.matchAll(/\(#(\d+)\)/g)];
    if (matches.length) featureNumbers.add(Number(matches[matches.length - 1][1]));
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
