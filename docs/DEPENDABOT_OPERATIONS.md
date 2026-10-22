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

## Current policy (reworked 2026-07-28, #744)

| Setting | Value | Why |
|---------|-------|-----|
| Groups | **minor/patch only** (`*-safe` groups) | One breaking major must never block a week of safe updates (July 2026 wave: #518/#519/#624 sat open ~3 weeks) |
| Majors | **Individual PRs**, one dependency each | Each major gets its own migration + QA; see "Major upgrades" below |
| `firebase-admin` majors in `/functions` | **Ignored** | `firebase-functions-test@3.5.0` (latest as of 2026-09-24) still peers `firebase-admin` `^8`–`^13` only; admin 14 fails `npm ci` with ERESOLVE (#624, #799). `firebase-functions@7.4.0` now peers admin `^14`, but do not ship admin 14 until the test harness catches up. Remove the ignore when `firebase-functions-test` allows `firebase-admin ^14`. |
| CI `build` job | Runs on any PR touching `package.json` / `package-lock.json` / build config | `verify` doesn't run the production build and qa-runners skip lockfile-only diffs, so Tailwind-4-class breaks were only visible on Vercel (#519) |
| `open-pull-requests-limit` | **2** per updates entry (root npm, `/functions` npm, Actions) (#967) | Was **5/5/3** after the 2026-07-05 re-enable. 2 matches the two `*-safe` groups per npm directory. **0** is only for an ops reset |
| T0 auto-merge | `*-safe` minor/patch groups only (#967) | `.github/workflows/dependabot-auto-merge.yml` enables squash auto-merge. Majors and `actions-all` are never enabled |
| Monday sweep | 18:00 UTC Mondays (#1052) | Enables squash auto-merge on a `*-safe` PR the event workflow missed. Adds `skip-version-bump` when that label is missing. Comments when the PR has been red or conflicted for 7 days. Does not push or rebase |
| CI concurrency | `cancel-in-progress` on `.github/workflows/ci.yml` (#967) | A newer push or PR update cancels the older run. The nightly schedule uses its own concurrency group |
| SemVer gate | Skips `dependabot/*` + `skip-version-bump` label | Deps PRs never bump `package.json` |
| Vercel | `ignoreCommand` → `scripts/vercel-should-build.sh` | No SPA preview for Actions/functions-only bumps |

### Merge policy by PR class

| PR class | Policy |
|----------|--------|
| `*-safe` group (minor/patch) | **T0.** Squash auto-merge once required checks are green (`verify`, `build` when the dep path filter runs, `functions` when that job runs, Vercel). The Monday sweep is the backstop when the open event was missed |
| Actions group (`actions-all`) | Not auto-merged. It can contain major Action bumps. Merge on green `verify` only after a human looks |
| Individual **major** PR | **Never auto-merge, and never merge on green alone.** Open a dedicated migration issue/PR, apply `ci/qa` (and `ci/full` for toolchain), follow "Major upgrades" below |

### T0 auto-merge (#967)

`.github/workflows/dependabot-auto-merge.yml` enables GitHub's native squash auto-merge. The repository already allows auto-merge and allows squash only (merge commits and rebase are off). The workflow does not change those settings.

What it merges:

- Author and actor are `dependabot[bot]`.
- Base branch is `staging`.
- `dependabot/fetch-metadata` succeeds, so every commit on the PR is Dependabot's. If that lookup fails on a `*-safe` branch, auto-merge stays off and the workflow comments.
- The dependency group name ends in `-safe`, and the highest bump is `semver-minor` or `semver-patch`.
- A title that says `from X to Y` with a different major is rejected even when the group name looks safe.

What it does not merge:

- Individual majors (`firebase-admin`, `svix`, `@firebase/rules-unit-testing`, and the rest of the "Major upgrades" list).
- `actions-all`, including when every bump in that group happens to be a patch.
- Any push by a person other than Dependabot. That push disables auto-merge until Dependabot pushes again.

Checks still gate the land. Enabling auto-merge does not skip `verify`, `build`, `functions`, or Vercel. A red check leaves the PR open.

Alerts are failure-only:

- The workflow comments when it cannot enable auto-merge, or when a non-Dependabot actor updates the branch.
- A later CI failure on a T0 PR updates one comment (`<!-- dependabot-t0-ci-failure -->`). A green CI run does not open a new comment.
- Success does not page anyone. A green enable run does not open a comment. The Monday sweep (#1052) comments only when a `*-safe` PR has been red or conflicted for 7 days.

Where the files live:

- `pull_request_target` runs the workflow from the **default branch** (`main`). Merging this to `staging` does not start auto-merge. It starts after the promote to `main`.
- Dependabot reads `.github/dependabot.yml` from `main` as well. The limit of 2 and the workflow turn on together at that promote.
- CI `concurrency` is in the workflow that runs for the PR merge commit, so it applies to `staging` as soon as that `ci.yml` is on `staging`.
- The Monday sweep workflow is also read from `main`. `schedule` does not run the copy on `staging`.

Do not `@dependabot rebase` the whole queue to wake existing PRs up. Dependabot's own rebase (the default `rebase-strategy: auto`) sends `synchronize` and the workflow enables auto-merge then. This change does not close or merge PRs that are already open.

Troubleshooting:

| Symptom | What to do |
|---------|------------|
| T0 PR is green and still open | Confirm the workflow file is on `main`. Confirm the PR is a `*-safe` group and not a major. Read the `Dependabot auto-merge` run. |
| Comment says `metadata-unavailable` | A commit on the branch is not from Dependabot, or `dependabot/fetch-metadata` failed. Do not force-merge. Wait for Dependabot's next push or close the PR. |
| Comment says CI failed | Fix the red job, or leave the PR. Auto-merge will not land it. `functions` red still blocks a `/functions` group. |
| Auto-merge API error about the merge method | The repo is squash-only. The workflow requests `SQUASH`. Do not switch the workflow to `MERGE`. |
| Too few new Dependabot PRs | Expected while two PRs are already open for that entry. The limit is 2. Existing PRs count. Do not raise the limit to clear a backlog; merge or close the open ones first, one at a time. |

### Scheduled execution (#1052)

`.github/workflows/dependabot-scheduled-execution.yml` runs Mondays at 18:00 UTC, after Dependabot's Monday scan (default 05:00 UTC when `dependabot.yml` sets no `time`), and on `workflow_dispatch`.

For each open Dependabot pull request into `staging` whose group is `*-safe` and whose commits are all from `dependabot[bot]`:

- Add `skip-version-bump` when the label is missing. The sweep does not change `package.json`.
- Enable squash auto-merge when it is off. GitHub still waits for `verify`, for `build` and `functions` when those jobs run, and for Vercel, and for the branch to be up to date with `staging`. The sweep does not call the merge API itself.
- Comment when `verify`, `build`, `functions`, or a Vercel check has been failing for 7 days, or the pull request is conflicted and the newest commit is at least 7 days old. One comment, updated in place (`<!-- dependabot-t0-stuck-7d -->`). A later sweep rewrites that comment once the PR is green and mergeable. It does not open a separate success comment.

GitHub does not record when a pull request became conflicted. The sweep uses the newest commit time, which is the last Dependabot update. A dirty PR whose head is at least 7 days old has gone through a Monday scan without a successful rebase.

The sweep leaves the branch alone. A commit created by this workflow would be from `github-actions[bot]`. `dependabot/fetch-metadata` fails on that commit, and `.github/workflows/dependabot-auto-merge.yml` turns auto-merge off. Catching a behind-`staging` branch up stays with Dependabot's default rebase (`rebase-strategy` is unset, which means `auto`). That rebase is a Dependabot push, so the event workflow runs as `dependabot[bot]`.

The sweep does not rebase the queue, does not enable auto-merge for majors or `actions-all`, and does not run until the workflow file is on `main`.

`workflow_dispatch` input `dry_run` plans without labeling, enabling, or commenting.

| Symptom | What to do |
|---------|------------|
| Monday sweep did not enable a green T0 PR | Confirm this workflow file is on `main`. Read the run log. `commits-unverified` means the commit list was empty. `non-dependabot-commit` means a human or Actions commit is on the branch; auto-merge stays off |
| Stuck comment on a conflicted PR | Dependabot could not rebase onto `staging`. Resolve the conflict or close the PR. The sweep will not force-push |
| PR is behind `staging` with auto-merge enabled and still open | Expected until Dependabot rebases. `staging` requires the branch to be up to date. Leave the branch to that rebase |

### Major upgrades (dedicated migration work)

Green CI is *necessary but not sufficient* for majors — dep-only diffs skip the
Playwright behavioral suite. Treat each as a feature PR:

1. Branch `feat/<issue#>-<dep>-<major>`; apply the bump, run codemods/migration guides.
2. Label `ci/qa` (forces qa-runners) and `ci/full` for build-toolchain deps.
3. Browser-verify on the Vercel preview per `.cursor/skills/pr-qa/SKILL.md`.

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
3. `*-safe` groups auto-merge when checks are green. Majors stay on the migration flow. Never batch-merge `#492`-class toolchain bombs, and never `@dependabot rebase` every open PR in one pass.

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
| `dependabot/github_actions/*` | Not auto-merged. Triage together; merge only if `verify` green; never bump version |
| `*-safe` npm groups (minor/patch) | Leave them to T0 auto-merge and the Monday sweep. Do not bump `package.json`. Do not push onto the branch. If the failure comment or the 7-day stuck comment is up, report that; do not merge around a red `functions` or `build` job |
| Individual **major** PR | Do NOT auto-merge and do NOT merge on green; route through "Major upgrades" above |
| Stale/red group PR | If lockfile desync (EUSAGE): regenerate with `npm install` in the affected dir and push to the PR branch (#521 pattern). If ERESOLVE peer conflict: check upstream peer ranges before assuming it's fixable (#624 pattern) |

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
| Actions only (#486-class) | Human, when `verify` is green | Not T0. CI-only; Vercel skip |
| `*-safe` groups (minor/patch) | Auto, when required checks are green | Squash. No extra QA |
| Individual majors | **No — migration flow** | See "Major upgrades"; `ci/qa` label mandatory |
| Functions prod safe group | Auto, when `functions` is green | A red `functions` job blocks the land |
| Functions dev safe group | Auto, when checks are green | Test-only dep, still T0 |

---

## Maintenance

Update this file when `dependabot.yml`, SemVer gate, or Vercel ignore logic changes.
