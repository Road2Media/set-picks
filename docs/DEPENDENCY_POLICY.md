# Dependency policy

Engineering rules for dependency updates. Factory source: [Road2Media/road2media#104](https://github.com/Road2Media/road2media/issues/104), agreed with Patrick on 2026-10-22. This repo adopts that standard in #1187.

The operations runbook (enablement, auto-merge workflow, Monday sweep, ops reset) stays in `docs/DEPENDABOT_OPERATIONS.md`. This file is the rule and the reason for it. The package list that receives `ui-check` lives in `scripts/lib/dependabotAutoMergePolicy.mjs`.

Production moves only when a release pull request merges. Dependabot targets `staging`.

## Semver

| Update | What it means here | How it lands |
| --- | --- | --- |
| Patch | Bug fix inside the current minor. Behavior can still change in ways a unit test misses. | Grouped with minors. Squash auto-merge into `staging` when required checks pass. |
| Minor | Compatible feature. Same watchout as a patch: tests do not prove the UI. | Same `*-safe` group as patches, split by production vs development. |
| Major | Breaking change the maintainer declared. One package per pull request so a break does not hold the week's patches. | Squash auto-merge when required checks pass. A failed major stays open and becomes agent work. |

`package.json` `version` stays put on these pull requests. The label is `skip-version-bump`.

## Build-time and shipped dependencies

A dependency is shipped when it runs in the visitor's browser or in a production Cloud Function. React, React DOM, React Router, Tailwind, PostCSS, Autoprefixer, Lucide, the Firebase client SDK, React Markdown, React Helmet, and TanStack Query are shipped. Their updates get `ui-check`.

A dependency is build-time when it only runs in CI, Vite, ESLint, or Vitest. Vite, Vitest, ESLint, and the Firebase **Admin** SDK are build-time or server-side. They do not get `ui-check`. A green `verify` still has to pass before they merge. `firebase-admin` is not visitor-facing.

`ui-check` does not block auto-merge. The release pull request lists those updates under **Staging spot-check** in `RELEASING.md`. Patrick looks at `staging` before he says ship or promote to prod. Dep-only diffs skip the Playwright suite, so the label is the signal to look.

## Coupled packages

Safe minor and patch updates are grouped (`root-production-safe`, `root-development-safe`, `functions-production-safe`, `functions-development-safe`, and `actions-all`). One breaking major stays out of those groups.

When a major fails and becomes migration work, packages that share a major move on one branch:

- `react` and `react-dom`
- ESLint and its plugins
- Vite, `@vitejs/plugin-react`, and Vitest

This repo does not ship Next.js or Framer Motion. The same rule applies if a later major introduces a pair that must move together. The migration branch supersedes the Dependabot pull request. Close the Dependabot pull request once that branch replaces it. Leave the red Dependabot pull request unmerged.

## Runtime pins

Node for Cloud Functions is `functions/package.json` `engines.node`, which is **24**. `@types/node` versions `>=25.0.0` are ignored on `/` and `/functions`. 25 tracks Current Node, one major above this LTS.

`firebase-admin` majors are ignored in `/functions`. Re-checked 2026-11-07: `firebase-functions-test@3.5.0` (latest) still peers `firebase-admin` `^8` through `^13` only. Admin 14 fails `npm ci` in `functions`. Remove that ignore when the test harness allows `^14`. Root `package.json` also depends on `firebase-admin` and is not in that ignore, so a root major can still open. Keep root and functions on admin 13 together. Do not merge an admin 14 bump while the peer range excludes it.

## Release size

`open-pull-requests-limit` is **2** per updates entry. That cap is the steady state. `0` is only for an ops reset.

A release pull request lists `ui-check` items and security updates so the visitor-facing slice is visible before promote. See `RELEASING.md`.

Falling more than one major behind on a package is debt. The migration issue targets the current major. A second open major of the same package yields to the newer pull request. Do not leave two majors of one package open, and do not batch-rebase the queue to catch up.

## `ui-check`

New Dependabot pull requests are labeled `dependencies`, `skip-version-bump`, and `allow-global`. Patrick authorized `allow-global` on 2026-11-06. Dependabot reads `.github/dependabot.yml` from `main`, so the label starts after the next promote.

The auto-merge workflow and the Monday sweep add `ui-check` when the pull request touches a visitor-facing package. The label list is the `VISITOR_FACING_PACKAGES` export plus `@tailwindcss/*` and `@firebase/*` except rules unit testing.

GitHub Actions updates edit workflow files. `scope-guard` still requires `needs-human` and `allow-global` on those pull requests. `allow-global` on the Dependabot config covers the global half at open. Actions stay on a human merge.

## Security updates

Security updates are not in the Monday groups. Every `*-safe` group sets `applies-to: version-updates`, so a security fix opens on its own and auto-merges when checks pass. `alert-lookup` stays off. It needs a personal access token, and this repo does not add one.

The release pull request lists security updates that landed in the release. When one should reach production before the next planned release, say so in that section. That is still a release pull request.

## Quarterly Node LTS check

`.github/workflows/runtime-quarterly-check.yml` opens one `agent-queue` `p3` reminder on 1 Jan, 1 Apr, 1 Jul, and 1 Oct at 15:00 UTC. The reminder covers the Node LTS this repo runs and the Vercel Node support schedule. The workflow does not change Node, Vercel, DNS, or repository settings. An upgrade is its own issue.

## Failing majors

A major whose required checks fail stays open. `.github/workflows/dependabot-auto-merge.yml` opens or reuses one issue labeled `agent-queue`, `p3`, `dependencies`, and `skip-prd`. The title is `chore(deps): migrate <pkg> major (Dependabot #N)`. The body links the pull request and includes `<!-- dependabot-major-migration pr:N -->`, which is how a later run reuses the issue. The queue does the migration on a branch that supersedes the Dependabot pull request.

A later green run can still auto-merge. Close the migration issue if that happens.

The Monday sweep (`.github/workflows/dependabot-scheduled-execution.yml`) is the backstop for a missed open event. It adds `skip-version-bump` and `ui-check`, enables squash auto-merge, and comments when a pull request has been red or conflicted for 7 days. It does not push or rebase. `rebase-strategy` is `disabled`.

## Cadence

npm on `/` and `/functions` is weekly, Monday. GitHub Actions is monthly. Both target `staging`. Rebases stay disabled.

## Human gate

Edits to `.github/workflows/**`, `vercel.json`, env files, and deleted tests need `needs-human`. Edits to `.github/**` need `allow-global`. `allow-global` does not waive `needs-human`. Agents do not enable auto-merge on a pull request that has `needs-human`.
