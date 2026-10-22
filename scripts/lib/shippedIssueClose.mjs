/**
 * Pure helpers for closing issues a staging → main promote shipped.
 *
 * GitHub only honors Closes / Fixes / Resolves when the pull request merges
 * into the default branch. Feature PRs merge to staging, and the promote
 * squash does not carry those keywords. Collection is keyword-only: plain
 * mentions, "Part of", and "Related" never close.
 *
 * The workflow in `.github/workflows/close-shipped-issues.yml` applies the
 * plan when a release is published. Tests cover this file, not the network.
 */

export const KEEP_OPEN_LABEL = "keep-open";

const KEYWORD_SOURCE = "\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\b\\s*:?\\s*";

const REF_RE =
  /^(?:https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(?:issues|pull)\/(\d+)|(?:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+))?#(\d+))/i;

/**
 * Drop fenced blocks, inline code, and HTML comments so an example
 * "Closes #1" in a snippet is not treated as a ship.
 */
export function stripNonProse(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/`[^`\n]+`/g, " ");
}

function keywordIsNegated(source, index) {
  const before = source.slice(Math.max(0, index - 16), index).toLowerCase();
  return /(?:\bnot |n't )$/.test(before);
}

function sameRepo(refOwner, refRepo, owner, repo) {
  if (!refOwner || !refRepo) return true;
  if (!owner || !repo) return true;
  return (
    refOwner.toLowerCase() === owner.toLowerCase() &&
    refRepo.toLowerCase() === repo.toLowerCase()
  );
}

/**
 * Issue numbers named with a closing keyword in `text`.
 * `owner` / `repo` drop cross-repo references. A keyword may introduce a
 * list: "Closes #1, #2 and #3".
 */
export function collectClosingIssueNumbers(text, { owner, repo } = {}) {
  const source = stripNonProse(text);
  const numbers = [];
  const keywordRe = new RegExp(KEYWORD_SOURCE, "gi");
  for (const match of source.matchAll(keywordRe)) {
    if (keywordIsNegated(source, match.index)) continue;
    let i = match.index + match[0].length;
    let first = true;
    while (i < source.length) {
      const rest = source.slice(i);
      if (!first) {
        const sep = rest.match(/^(?:,|&|\band\b)\s*/i);
        if (!sep) break;
        i += sep[0].length;
      }
      const ref = REF_RE.exec(source.slice(i));
      if (!ref) break;
      first = false;
      const refOwner = ref[1] || ref[4] || "";
      const refRepo = ref[2] || ref[5] || "";
      const number = Number(ref[3] || ref[6]);
      i += ref[0].length;
      if (number > 0 && sameRepo(refOwner, refRepo, owner, repo)) {
        numbers.push(number);
      }
      const ws = /^\s+/.exec(source.slice(i));
      if (ws) i += ws[0].length;
    }
  }
  return [...new Set(numbers)];
}

/** GitHub squash subjects end with the merging PR: "title (#1188)". */
export function extractMergedPullNumber(message) {
  const subject = String(message || "").split(/\r?\n/, 1)[0];
  const matches = [...subject.matchAll(/\(#(\d+)\)/g)];
  if (!matches.length) return null;
  return Number(matches[matches.length - 1][1]);
}

export function commitMessage(commit) {
  if (!commit) return "";
  if (typeof commit === "string") return commit;
  if (typeof commit.message === "string") return commit.message;
  return commit.commit?.message || "";
}

export function pullRequestView(pr) {
  if (!pr) return null;
  return {
    number: pr.number,
    title: pr.title || "",
    body: pr.body || "",
    mergedAt: pr.merged_at || pr.mergedAt || null,
    mergeSha: pr.merge_commit_sha || pr.mergeSha || null,
    baseRef: pr.base?.ref || pr.baseRef || "",
    headRef: pr.head?.ref || pr.headRef || "",
  };
}

export function isPromotePullRequest(pr) {
  const view = pullRequestView(pr);
  if (!view?.mergedAt) return false;
  if (view.baseRef.toLowerCase() !== "main") return false;
  const head = view.headRef.toLowerCase();
  return head === "staging" || head.startsWith("promote/");
}

function titleHasVersion(title, version) {
  if (!version) return false;
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`).test(title || "");
}

/**
 * The staging → main (or promote/* → main) pull request this release shipped.
 * Prefer the merge commit the tag points at, then a title that names the
 * version, then the latest promote merged before the release was published.
 */
export function selectPromotePullRequest(pulls, { tag, publishedAt, mergeSha } = {}) {
  const version = String(tag || "").replace(/^v/, "");
  const candidates = (pulls || []).filter((pr) => isPromotePullRequest(pr));
  if (mergeSha) {
    const shaHit = candidates.find((pr) => pullRequestView(pr).mergeSha === mergeSha);
    if (shaHit) return shaHit;
  }
  const titled = candidates.filter((pr) => titleHasVersion(pr.title, version));
  const pool = titled.length ? titled : candidates;
  const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
  const before = Number.isFinite(publishedMs)
    ? pool.filter((pr) => Date.parse(pullRequestView(pr).mergedAt) <= publishedMs + 15 * 60 * 1000)
    : pool;
  const ranked = (before.length ? before : pool).slice();
  ranked.sort(
    (a, b) => Date.parse(pullRequestView(b).mergedAt) - Date.parse(pullRequestView(a).mergedAt),
  );
  return ranked[0] || null;
}

/** Previous non-draft, non-prerelease tag, excluding the release under test. */
export function selectPreviousRelease(releases, { tag, publishedAt } = {}) {
  const currentMs = publishedAt ? Date.parse(publishedAt) : NaN;
  const candidates = (releases || []).filter((release) => {
    if (!release?.tag_name || release.tag_name === tag) return false;
    if (release.draft || release.prerelease) return false;
    if (!release.published_at) return false;
    if (Number.isFinite(currentMs) && Date.parse(release.published_at) >= currentMs) return false;
    return true;
  });
  candidates.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  return candidates[0]?.tag_name || null;
}

/**
 * Closing references on the promote PR, its commits, and the feature PRs
 * those commits merged into staging.
 */
export function collectFromPromote({ promotePr, commits, pullRequests, owner, repo } = {}) {
  const entries = [];
  const featurePrs = new Set();
  const promoteNumber = promotePr?.number ?? null;

  if (promotePr) {
    const text = `${promotePr.title || ""}\n${promotePr.body || ""}`;
    for (const number of collectClosingIssueNumbers(text, { owner, repo })) {
      entries.push({ number, sourcePr: promoteNumber });
    }
  }

  for (const commit of commits || []) {
    const message = commitMessage(commit);
    const mergedPr = extractMergedPullNumber(message);
    if (mergedPr) featurePrs.add(mergedPr);
    for (const number of collectClosingIssueNumbers(message, { owner, repo })) {
      entries.push({ number, sourcePr: mergedPr || promoteNumber });
    }
  }

  for (const pr of pullRequests || []) {
    if (pr?.number) featurePrs.add(pr.number);
    const text = `${pr?.title || ""}\n${pr?.body || ""}`;
    for (const number of collectClosingIssueNumbers(text, { owner, repo })) {
      entries.push({ number, sourcePr: pr.number });
    }
  }

  return {
    featurePrNumbers: [...featurePrs].sort((a, b) => a - b),
    references: entries,
  };
}

function labelNames(issue) {
  return (issue?.labels || []).map((label) => (typeof label === "string" ? label : label?.name)).filter(Boolean);
}

export function shippedCloseMarker(tag) {
  return `<!-- shipped-close ${tag} -->`;
}

export function dryRunMarker(tag) {
  return `<!-- shipped-close-dry-run ${tag} -->`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function commentsIncludeShipment(comments, tag) {
  const marker = shippedCloseMarker(tag);
  const line = new RegExp(`^Shipped in ${escapeRegExp(tag)} \\(#\\d+\\)`, "m");
  return (comments || []).some((comment) => {
    const body = comment?.body || "";
    return body.includes(marker) || line.test(body);
  });
}

/**
 * action `close` posts the shipment comment and closes.
 * action `close-only` closes an issue that already has this release's comment.
 * action `skip` leaves the issue alone.
 */
export function classifyShippedIssue(issue, { comments = [], tag } = {}) {
  if (!issue) return { action: "skip", reason: "missing" };
  if (issue.pull_request) return { action: "skip", reason: "pull-request" };
  if (labelNames(issue).includes(KEEP_OPEN_LABEL)) return { action: "skip", reason: "keep-open" };
  if (issue.state === "closed") return { action: "skip", reason: "closed" };
  const thread = comments.length ? comments : issue.comments || [];
  if (tag && commentsIncludeShipment(thread, tag)) {
    return { action: "close-only", reason: "already-commented" };
  }
  return { action: "close", reason: "closing-keyword" };
}

export function formatShippedComment({ tag, promotePr, sourcePrs } = {}) {
  const promote = promotePr ? ` (#${promotePr})` : "";
  const sources = [...new Set(sourcePrs || [])]
    .filter((number) => number && number !== promotePr)
    .sort((a, b) => a - b);
  const via = sources.length ? ` via ${sources.map((number) => `#${number}`).join(", ")}` : "";
  return `${shippedCloseMarker(tag)}\nShipped in ${tag}${promote}${via}.`;
}

export function formatDryRunComment({ tag, promotePr, decisions } = {}) {
  const closing = (decisions || []).filter((row) => row.action === "close" || row.action === "close-only");
  const skipped = (decisions || []).filter((row) => row.action === "skip");
  const lines = [
    dryRunMarker(tag),
    `Dry run for ${tag}${promotePr ? ` (promote #${promotePr})` : ""}. Nothing was closed.`,
    "",
    "Would close:",
  ];
  if (!closing.length) lines.push("- (none)");
  for (const row of closing) {
    const via = (row.sourcePrs || []).filter(Boolean).map((number) => `#${number}`).join(", ");
    lines.push(`- #${row.number}${via ? ` via ${via}` : ""}`);
  }
  lines.push("", "Skipped:");
  if (!skipped.length) lines.push("- (none)");
  for (const row of skipped) {
    lines.push(`- #${row.number} (${row.reason})`);
  }
  return lines.join("\n");
}

function groupReferences(references) {
  const map = new Map();
  for (const entry of references || []) {
    if (!entry?.number) continue;
    if (!map.has(entry.number)) map.set(entry.number, new Set());
    if (entry.sourcePr) map.get(entry.number).add(entry.sourcePr);
  }
  return map;
}

export function planShippedCloses({
  owner,
  repo,
  tag,
  promotePr,
  commits,
  pullRequests,
  issues,
} = {}) {
  const collected = collectFromPromote({ promotePr, commits, pullRequests, owner, repo });
  const grouped = groupReferences(collected.references);
  const byNumber = new Map((issues || []).map((issue) => [issue.number, issue]));
  const promoteNumber = promotePr?.number ?? null;
  const decisions = [...grouped.keys()]
    .sort((a, b) => a - b)
    .map((number) => {
      const sourcePrs = [...grouped.get(number)]
        .filter((source) => source && source !== number)
        .sort((a, b) => a - b);
      const classified = classifyShippedIssue(byNumber.get(number) || null, { tag });
      return {
        number,
        action: classified.action,
        reason: classified.reason,
        sourcePrs,
      };
    });

  return {
    featurePrNumbers: collected.featurePrNumbers,
    decisions,
    dryRunComment: formatDryRunComment({ tag, promotePr: promoteNumber, decisions }),
    closeComments: decisions
      .filter((row) => row.action === "close")
      .map((row) => ({
        number: row.number,
        body: formatShippedComment({
          tag,
          promotePr: promoteNumber,
          sourcePrs: row.sourcePrs,
        }),
      })),
  };
}
