# Dependabot operations (agent + human)

**Purpose:** Prevent post-release PR-queue floods. Injected into agent context via `AGENTS.md` and `.cursorrules`.

---

## What happened (2026-07-03 — definitive timeline)

| UTC | Event |
|-----|--------|
| 22:32 | [#476](https://github.com/pat792/set-picks/pull/476) merges — **first-ever** `.github/dependabot.yml` lands on `staging` (**no `target-branch`**) |
| 22:45 | Dependabot **immediate first scan** (not Monday schedule) opens **#479–#485** targeting **`main`** (repo default) |
| 22:57 | `378f41a` adds `target-branch: staging` → **#479–#485 closed**, **#486–#492 opened** (duplicate wave) |
| 22:58–23:00 | Seven Dependabot PRs sit open; each triggers full GitHub CI + Vercel preview |
| 23:30–23:33 | Sprint 6 train PRs **#493–#495** opened manually (separate from Dependabot, same evening) |

**Root cause:** Dependabot was enabled in the v1.18.0 train without (1) correct `target-branch` on day one, (2) SemVer exemption, (3) Vercel ignore for non-SPA PRs, or (4) a first-run agent runbook. The “clean slate after v1.18” lasted **~13 minutes** until the first Dependabot scan.

This is **not** recurring weekly noise — it was a **one-time enablement avalanche** plus same-evening Sprint 6 queueing.

---

## Factory dependency standard (2026-10-22)

Patrick set one standard for road2media, foco-pets, and set-picks. It replaces the older “never auto-merge a major” wording in #967, #1052, and #1148.

In plain language:

1. Dependabot updates, **majors included**, auto-merge into `staging` when the required checks pass.
2. A major that **fails** checks stays open. It is not merged. The CI failure path opens an `agent-queue` `p3` migration issue for it.
3. Visitor-facing package updates get the `ui-check` label so Patrick can spot-check staging before release. The label does not block the merge. The list is React, React DOM, React Router, Lucide, Tailwind (and `@tailwindcss/*`), PostCSS, Autoprefixer, the Firebase **client** SDK (`firebase` and `@firebase/*` except rules unit testing), React Markdown, React Helmet, and TanStack Query. Build tools such as Vite, Vitest, and ESLint are not on that list. `firebase-admin` is not visitor-facing.
4. Runtime-pinned packages such as `@types/node` ignore majors beyond the Node LTS major the project runs. That major is `functions/package.json` `engines.node`, which is **24**. Both npm entries ignore `@types/node` versions `>=25.0.0`.
5. Security updates go fast. Version-update groups set `applies-to: version-updates`, so security fixes are not held for the Monday batch. They open on their own and auto-merge when checks pass. `alert-lookup` on `dependabot/fetch-metadata` is off because it needs a personal access token, and this repo does not add one.
6. A quarterly Node and Vercel runtime check opens an `agent-queue` `p3` reminder (1 Jan, 1 Apr, 1 Jul, 1 Oct at 15:00 UTC). It does not change Node or Vercel by itself.
7. The `firebase-admin` major ignore in `/functions` stays. `firebase-functions-test` still cannot install admin 14.

## Current policy (reworked 2026-07-28, #744; factory standard #1148)

| Setting | Value | Why |
|---------|-------|-----|
| Groups | **minor/patch only** (`*-safe` groups) | One breaking major must never block a week of safe updates (July 2026 wave: #518/#519/#624 sat open ~3 weeks) |
| Majors | **Individual PRs**, one dependency each | Auto-merge when checks pass. A failed major stays open as an `agent-queue` `p3` issue. See "Major upgrades" |
| `firebase-admin` majors in `/functions` | **Ignored** | `firebase-functions-test@3.5.0` (latest as of 2026-09-24) still peers `firebase-admin` `^8`–`^13` only; admin 14 fails `npm ci` with ERESOLVE (#624, #799). `firebase-functions@7.4.0` now peers admin `^14`, but do not ship admin 14 until the test harness catches up. Remove the ignore when `firebase-functions-test` allows `firebase-admin ^14`. |
| CI `build` job | Runs on any PR touching `package.json` / `package-lock.json` / build config | `verify` doesn't run the production build and qa-runners skip lockfile-only diffs, so Tailwind-4-class breaks were only visible on Vercel (#519) |
| `open-pull-requests-limit` | **2** per updates entry (root npm, `/functions` npm, Actions) (#967) | Was **5/5/3** after the 2026-07-05 re-enable. 2 matches the two `*-safe` groups per npm directory. **0** is only for an ops reset |
| Auto-merge | Every Dependabot PR into `staging`, majors included (#1148) | `.github/workflows/dependabot-auto-merge.yml` runs `gh pr merge --auto --squash` after `dependabot/fetch-metadata`. It checks out the default branch only, never the PR head |
| Rebase | `disabled` on all three entries | A push to `staging` must not rebase open Dependabot PRs or mint new previews. GitHub still rebases PRs that were already open, for 30 days after they opened. Recreate those PRs to pick up the new setting |
| Monday sweep | 18:00 UTC Mondays (#1052) | Backstop for any Dependabot PR the event workflow missed, including majors. Adds `skip-version-bump` and `ui-check` when needed. Comments when the PR has been red or conflicted for 7 days. Does not push or rebase |
| CI gate | `ci-gate` always reports (#1148) | `build`, `functions`, and `rules` still skip when their paths did not change. `ci-gate` fails only when one of those jobs, or `verify`, actually failed |
| CI concurrency | `cancel-in-progress` on `.github/workflows/ci.yml` (#967) | A newer push or PR update cancels the older run. The nightly schedule uses its own concurrency group |
| SemVer gate | Skips `dependabot/*` + `skip-version-bump` label | Deps PRs never bump `package.json` |
| Vercel | `ignoreCommand` → `scripts/vercel-should-build.sh` | Any `dependabot/*` ref skips the preview. The script on that commit has to contain the rule, so recreate old Dependabot branches after this lands on `staging` |
| Security updates | Not grouped | `applies-to: version-updates` on every `*-safe` group. Security PRs auto-merge when checks pass. No Monday wait |
| `@types/node` | Ignore `>=25.0.0` on `/` and `/functions` | One major above Node 24. Quarterly check compares this to `engines.node` |
| Quarterly runtime check | `.github/workflows/runtime-quarterly-check.yml` | Reminder issue only. Does not change Vercel or Node |

### Merge policy by PR class

| PR class | Policy |
|----------|--------|
| Any Dependabot PR into `staging` (minor, patch, major, `actions-all`, security) | Squash auto-merge once required checks are green. The Monday sweep is the backstop when the open event was missed |
| Visitor-facing package (see the list above) | Same auto-merge, plus the `ui-check` label. Spot-check staging before release |
| Major whose checks **fail** | Stays open. Not merged. An `agent-queue` `p3` issue is opened (`<!-- dependabot-major-migration pr:N -->`). Do the migration on a normal branch |
| `firebase-admin` major in `/functions` | Still ignored, so Dependabot should not open a new one. An already-open PR is treated like any other major: green checks can merge it, red checks become a p3 issue |

### Auto-merge (#967, factory standard #1148)

`.github/workflows/dependabot-auto-merge.yml` enables GitHub squash auto-merge with `gh pr merge --auto --squash`. It does not change repository settings. Allow auto-merge has to be on, and the required checks have to be ones this repo actually reports. Those are Patrick's steps, listed in the #1148 PR.

What it enables:

- Author and actor are `dependabot[bot]`.
- Base branch is `staging`.
- `dependabot/fetch-metadata` succeeds, so every commit on the PR is Dependabot's. If that lookup fails, auto-merge stays off and the workflow comments. The branch name alone is not enough.
- Minor, patch, major, security, and `actions-all` are all enabled. GitHub waits for the required checks. A red check does not merge.
- A visitor-facing package gets `ui-check` before auto-merge is enabled.

What it does not enable:

- A pull request whose commits are not all from Dependabot. A later push by a person turns auto-merge off until Dependabot pushes again.
- Anything that is not a Dependabot PR into `staging`.

A failed major stays open and `scripts/dependabot-open-major-migration.mjs` opens one p3 issue. A later green run notes that auto-merge may still land the PR, and the issue should be closed if it does.

Alerts are failure-only:

- The workflow comments when it cannot enable auto-merge, or when a non-Dependabot actor updates the branch.
- A later CI failure updates one comment (`<!-- dependabot-t0-ci-failure -->`). A green CI run does not open a new comment.
- Success does not page anyone. The Monday sweep comments only when a Dependabot PR has been red or conflicted for 7 days.

Where the files live:

- `pull_request_target` runs the workflow from the **default branch** (`main`). Merging this to `staging` does not start auto-merge. It starts after the promote to `main`.
- Dependabot reads `.github/dependabot.yml` from `main` as well. The limit of 2 and the workflow turn on together at that promote.
- CI `concurrency` is in the workflow that runs for the PR merge commit, so it applies to `staging` as soon as that `ci.yml` is on `staging`.
- The Monday sweep workflow is also read from `main`. `schedule` does not run the copy on `staging`.

Do not `@dependabot rebase` the whole queue. Rebases are disabled, so a push to `staging` does not update open Dependabot PRs. GitHub keeps rebasing PRs that were already open, for 30 days after they were opened. Recreate those one at a time if you need them to stop. This change does not close or merge PRs that are already open.

`dependabot.yml`, this auto-merge workflow, the Monday sweep, and the quarterly check are read from the default branch (`main`). Merging to `staging` does not start them. They start after the promote to `main`. `ci-gate` is part of `ci.yml`, so it runs for a pull request as soon as that workflow file is on the pull request. The Vercel ignore script runs from the commit being built.

Troubleshooting:

| Symptom | What to do |
|---------|------------|
| Dependabot PR is green and still open | Confirm the workflow file is on `main`. Confirm Allow auto-merge is on. Read the `Dependabot auto-merge` run. The log line `major=true` with `action=enable` means a major was offered to auto-merge and is waiting on checks. |
| Comment says `metadata-unavailable` | A commit on the branch is not from Dependabot, or `dependabot/fetch-metadata` failed. Do not force-merge. Wait for Dependabot's next push or close the PR. |
| Comment says CI failed | The PR stays open. A major also gets a p3 migration issue. Do not merge around a red `functions`, `build`, or `ci-gate` job. |
| Auto-merge API error about the merge method | The workflow requests squash. Do not switch it to merge or rebase. |
| Too few new Dependabot PRs | Expected while two PRs are already open for that entry. The limit is 2. Existing PRs count. Do not raise the limit to clear a backlog; merge or close the open ones first, one at a time. |

### Scheduled execution (#1052)

`.github/workflows/dependabot-scheduled-execution.yml` runs Mondays at 18:00 UTC, after Dependabot's Monday scan (default 05:00 UTC when `dependabot.yml` sets no `time`), and on `workflow_dispatch`.

For each open Dependabot pull request into `staging` whose commits are all from `dependabot[bot]`, including majors, `actions-all`, and security updates:

- Add `skip-version-bump` when the label is missing. The sweep does not change `package.json`.
- Add `ui-check` when the pull request touches a visitor-facing package and the label is missing.
- Enable squash auto-merge when it is off. GitHub still waits for required checks. The sweep does not call the merge API itself and does not push.
- Comment when `verify`, `build`, `functions`, or a Vercel check has been failing for 7 days, or the pull request is conflicted and the newest commit is at least 7 days old. One comment, updated in place (`<!-- dependabot-t0-stuck-7d -->`). A later sweep rewrites that comment once the PR is green and mergeable. It does not open a separate success comment.

GitHub does not record when a pull request became conflicted. The sweep uses the newest commit time. A dirty PR whose head is at least 7 days old has gone through a Monday scan without a successful update.

The sweep leaves the branch alone. A commit created by this workflow would be from `github-actions[bot]`. `dependabot/fetch-metadata` fails on that commit, and `.github/workflows/dependabot-auto-merge.yml` turns auto-merge off. Rebases are disabled, so Dependabot will not catch the branch up on its own. If `staging` still requires branches to be up to date, auto-merge waits forever. Turn that requirement off, or update one branch at a time. Do not `@dependabot rebase` the queue.

The sweep does not run until the workflow file is on `main`.

`workflow_dispatch` input `dry_run` plans without labeling, enabling, or commenting.

| Symptom | What to do |
|---------|------------|
| Monday sweep did not enable a green Dependabot PR | Confirm this workflow file is on `main`. Read the run log. `commits-unverified` means the commit list was empty. `non-dependabot-commit` means a human or Actions commit is on the branch; auto-merge stays off |
| Stuck comment on a conflicted PR | Rebases are disabled, so Dependabot will not fix the conflict. Resolve it, recreate the PR, or close it. The sweep will not force-push |
| PR is behind `staging` with auto-merge enabled and still open | Expected when the ruleset requires the branch to be up to date. Rebases are disabled. Turn that requirement off, or update this one branch. Do not rebase the queue |

### Major upgrades

A major auto-merges when required checks pass. That is the factory standard. The migration playbook below is for a major that **failed** checks (the p3 issue) or for a visitor-facing bump you are spot-checking on staging before release. Dep-only diffs skip the Playwright suite, so a green `verify` does not prove the UI. `ui-check` is the signal to look before promote, not a second merge gate.

When you do take a failed major as migration work:

1. Branch `feat/<issue#>-<dep>-<major>`; apply the bump, run codemods/migration guides.
2. Label `ci/qa` (forces qa-runners) and `ci/full` for build-toolchain deps.
3. Browser-verify on the Vercel preview per `.cursor/skills/pr-qa/SKILL.md`.
4. Close the Dependabot PR once the migration replaces it. Do not also merge the red Dependabot PR.

Known pending majors (from the closed July 2026 group PRs — tracked in #744):

| Dependency | Risk | Notes |
|------------|------|-------|
| eslint 10, sharp 0.35 | Low | Do first, quick wins |
| vite 8 + @vitejs/plugin-react 6 + vitest 4 | High | Move as one unit (rolldown-based); re-check `qa:chunks` manual-chunk strategy |
| tailwindcss 4 | High | PostCSS plugin moved to `@tailwindcss/postcss`; CSS-first config; visual QA (border/ring defaults changed) |
| react 19 + react-router-dom 7 | High | Dedicated migration, full `ci/qa` |
| firebase 12 | High | QA WebChannel + App Check flows (see pr-qa traps.md) |
| @firebase/rules-unit-testing 5 | Medium | Pair with `npm run test:rules` |
| resend 6 (`/functions`) | Medium | Comms email worker QA + `functions` job |
| firebase-admin 14 (`/functions`) | **Blocked** (re-checked 2026-09-24) | Latest `firebase-functions-test` is still **3.5.0**; its `firebase-admin` peer is `^8`–`^13` (no `^14`). `firebase-functions@7.4.0` now allows admin 14, but functions unit tests cannot `npm ci` on that combo. Keep root + functions on admin 13. Leave Dependabot [#799](https://github.com/pat792/set-picks/pull/799) open; do not rebase-merge it. |

### Re-enabling Dependabot (human step)

1. Restore limits in `.github/dependabot.yml` to **2** per updates entry (root npm, `/functions` npm, Actions). Use **0** only while an ops reset is in effect.
2. Merge to `staging`, then promote to `main` before Dependabot will read the file. Wait for **one** weekly wave — do **not** open parallel manual dep PRs same day.
3. Dependabot PRs auto-merge when checks are green, majors included. A red major becomes a p3 migration issue. Never `@dependabot rebase` every open PR in one pass.

---

## Agent obligations

### On the same PR / release that adds or edits `dependabot.yml`

- [ ] `target-branch: staging` on **every** `updates` entry (repo default is `main`).
- [ ] `skip-version-bump` label on every entry.
- [ ] Document first-scan behavior in this file + `CHANGELOG.md`.
- [ ] Steady-state `open-pull-requests-limit` is **2** per entry (#967). Use `0` only for the first hour of a brand-new enablement or an ops reset, then restore 2.

### When Dependabot PRs appear

| PR type | Agent action |
|---------|----------------|
| Any Dependabot PR (`*-safe`, `actions-all`, security, major) | Leave it to auto-merge and the Monday sweep. Do not bump `package.json`. Do not push onto the branch. A push by you turns auto-merge off |
| Visitor-facing package | Confirm `ui-check` is on the PR. Patrick spot-checks staging before release. Do not remove the label to speed the merge |
| Major with red checks | Leave the PR open. Use the `agent-queue` `p3` issue the workflow opened. Do not merge the red PR |
| Stale/red group PR | If lockfile desync (EUSAGE): regenerate with `npm install` in the affected dir and push to the PR branch (#521 pattern). That push is from you, so auto-merge stays off until Dependabot pushes again. If ERESOLVE peer conflict: check upstream peer ranges before assuming it's fixable (#624 pattern). `firebase-admin` 14 is the known ERESOLVE; leave the ignore in place |

### Never

- `@dependabot rebase` on **all** open PRs at once (N× CI + Vercel).
- Leave enablement-wave PRs open “until green” without owner triage.
- Open Sprint train feature PRs in the same hour as Dependabot first-scan.

### Ops reset (clear slate)

If the PR queue becomes unmanageable:

```bash
# Close Dependabot backlog (branches preserved)
for pr in $(gh pr list --author app/dependabot --json number -q '.[].number'); do
  gh pr close "$pr" --comment "Ops reset — see docs/DEPENDABOT_OPERATIONS.md"
done
```

Set `open-pull-requests-limit: 0` in `dependabot.yml` until re-enable.

---

## Triage quick reference

| PR class | Merge? | Notes |
|----------|--------|-------|
| Any green Dependabot PR, including majors and Actions | Auto, squash, when `ci-gate` (and any other required check) is green | Vercel preview is skipped for `dependabot/*` |
| Visitor-facing package | Auto, and labeled `ui-check` | Spot-check staging before release |
| Major with red checks | **No.** Stays open | p3 `agent-queue` migration issue. See "Major upgrades" |
| Security update | Auto, as soon as checks are green | Not held for the Monday group |
| `firebase-admin` major | Ignored in `/functions` | Do not remove the ignore until `firebase-functions-test` allows admin 14 |

---

## Maintenance

Update this file when `dependabot.yml`, SemVer gate, or Vercel ignore logic changes.
