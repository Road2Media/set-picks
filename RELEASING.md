# Releasing

Setlist Pick'em promotes `staging` to `main` only when Patrick says **ship** or **promote to prod**. That sentence is the promote. Agents do not merge a release pull request, tag, or publish a GitHub Release before it.

This is the same rule as foco-pets and road2media, adapted to the checks this repo already runs (`verify` in `.github/workflows/ci.yml`, plus the Vercel check). Product CI (Playwright, Functions, Firestore rules) stays. Feature pull requests still bump `package.json` and edit `CHANGELOG.md`. This repo does not use `changes/*.md` fragments.

## CI stages

1. **Pull request gate.** Every pull request to `staging` or `main` runs `verify`, `scope-guard`, and `label-integrity`. Vercel still reports its own check. `functions`, `rules`, and `qa-runners` stay path-gated inside `verify`'s workflow.
2. **Push to `staging`.** `verify` already runs on that push. It is not a required check. `staging-smoke` runs against the staging branch alias. `scope-guard` and `label-integrity` stay pull-request-only because they read labels.
3. **Release pull request.** The `staging` → `main` pull request runs the same pull-request checks again, including Vercel.
4. **Production smoke.** `production-smoke` runs after the GitHub Release is published.

Do not add the staging push run as a required status check. Branch protection is a human step. This repository does not change it from a pull request.

## Agent queue labels

| Label | Meaning |
| --- | --- |
| `agent-queue` | Ready for a cloud agent to pick up. Pair it with `p1`, `p2`, or `p3`. |
| `p1` / `p2` / `p3` | Priority. `p1` is first. |
| `needs-human` | A person merges this. Agents do not enable auto-merge. Workflow files, `vercel.json`, env files, and deleted tests require it. `allow-global` does not waive it. |
| `allow-global` | The diff touches `.github/**`, a `package-lock.json`, or `vercel.json`. |
| `auto-merge-ok` | Safe to auto-merge after the required checks pass. Do not put this on a pull request that has `needs-human` unless a human repo admin adds it afterwards. |
| `blocked` | A person is working this by hand. The cloud queue skips it. |
| `ui-check` | A dependency update may change what visitors see. It can still auto-merge to `staging`. The release pull request lists these under Staging spot-check. Patrick looks at `staging` before the release. |
| `skip-version-bump` | No `package.json` version change. Used for CI, docs, and script-only pull requests. Dependabot pull requests use it too. |
| `keep-open` | Do not auto-close this issue when a release ships a closing keyword. |

`label-integrity` fails when `needs-human` and `auto-merge-ok` are both present, unless a human admin applied `auto-merge-ok` after `needs-human`. A bot login never counts as that admin.

Two CI failures on the same pull request: stop, comment with the failure, and leave `needs-human`. Do not keep pushing fixes past that.

## Scope guard

`scope-guard` compares the pull request diff to its labels.

- `.github/workflows/**`, `vercel.json`, env files (not `*.example`), and a deleted `*.test.js` / `*.test.mjs` file require `needs-human`.
- `.github/**`, any `package-lock.json`, and `vercel.json` require `allow-global`.
- A `dependabot/*` branch may change lockfiles without `allow-global`, so package updates still auto-merge when `verify` is green. A Dependabot pull request that edits a workflow still needs `needs-human` and `allow-global`. Actions updates stay human.
- `package.json` and `CHANGELOG.md` are not global on this repo. The SemVer gate in `verify` still requires a version bump on feature pull requests unless `skip-version-bump` is set.

## Release pull request

Open a pull request from `staging` to `main` titled `Release X.Y.Z`. The body states the version bump, the changelog section, and this rule: Patrick says "ship" or "promote to prod" before it merges. It also includes the release-ready note below.

## Release-ready note

The release pull request lists what Patrick spot-checks on `staging` before he says ship or promote to prod. Dependency updates in these lists already merged when their checks passed. Listing them does not block the release.

### Staging spot-check

List every pull request merged to `staging` since the previous release that carries `ui-check`. Each line has the pull request number, the package names, and the version change. These are the updates that can change what visitors see (UI, animation, styling, and component libraries, including React, React DOM, React Router, Tailwind, and the Firebase client SDK).

If none merged in this release, write `None in this release.`

### Security updates

List security updates that auto-merged to `staging` in this release. When one should reach production before the next planned release, say that in this section. That is still a release pull request. Production moves from this pull request, after Patrick says ship or promote to prod.

If none merged in this release, write `None in this release.`

Agents do not merge that pull request on their own. When Patrick says **ship** or **promote to prod**, merge it. Publishing happens from `main` after that merge. Do not tag from `staging` or from a feature branch.

## Publish

`.github/workflows/release-publish.yml` runs on a push to `main`. It checks out with the job token and `persist-credentials: false`, then runs:

```bash
npm run release:publish -- --confirm
```

That command is idempotent.

- If the GitHub Release for `package.json`'s version already exists, it exits 0 and does not create another tag.
- If the tag is missing, it creates an annotated tag `vX.Y.Z` on `HEAD`, pushes it, and opens the GitHub Release from the matching `CHANGELOG.md` section.
- If the tag already points at `HEAD` but the Release does not exist, it creates the Release only.
- If the tag exists and points at a different commit, it exits non-zero and does not move the tag.

The same command is the fallback when the workflow has not published yet:

```bash
git checkout main && git pull origin main
npm run release:publish -- --confirm
```

A second run does not create another tag.

### `SYNC_BOT_TOKEN`

This is the same Actions secret name foco-pets and road2media use. This pull request does not create the token and does not set a value.

`release-publish` uses it only when it is set:

- Tag push and `gh release create` use `SYNC_BOT_TOKEN` instead of the default workflow token. A release created by the workflow token does not start other workflows, so `close-shipped-issues` would not run.
- `scripts/release-sync-staging.mjs` pushes `release-sync/vX.Y.Z` and opens the staging sync pull request with that token. Checkout stays on the job token with `persist-credentials: false`, so git does not send a second `Authorization` header.

When the secret is unset, the publish step warns and uses the workflow token. The sync step skips. Add the secret, then re-run **release-publish** only if that version is not already published. If the tag was already created by the workflow token, dispatch **Close shipped issues** for that tag instead of moving the tag.

The token needs to push tags, create a Release, and open a pull request. Do not print it.

After a published release, `.github/workflows/close-shipped-issues.yml` closes issues referenced with `Closes` / `Fixes` / `Resolves` on the staging pull requests in that promote. `Part of` and `keep-open` stay open.

## Smoke

| Workflow | When | URL |
| --- | --- | --- |
| `staging-smoke` | Push to `staging`, or a manual run | `https://set-picks-git-staging-pat-4867s-projects.vercel.app` (`SMOKE_BASE_URL` overrides) |
| `production-smoke` | `release: published`, or a manual run | `https://www.setlistpickem.com` |

There is no staging custom domain. `www.setlistpickem.com` is production.

Both smokes request `/` and `/login`, then sign in with the existing `QA_TEST_EMAIL`, `QA_TEST_PASSWORD`, and `QA_APPCHECK_DEBUG_TOKEN` secrets and expect `/dashboard`. They do not add new login secrets.

Staging previews (`set-picks-git-*.vercel.app`) use Vercel Deployment Protection, so anonymous requests are sent to Vercel SSO. `staging-smoke` maps `VERCEL_AUTOMATION_BYPASS_SECRET` to `SMOKE_PROTECTION_BYPASS`. `smokeHeaders()` sends `x-vercel-protection-bypass` only when that value is set, and sends no bypass header when it is empty. Production does not use the bypass secret. Copy the value from the Vercel project's Protection Bypass for Automation setting. Do not commit it.

## Rollback

Roll back with Vercel's instant rollback, or revert the release pull request, then run `production-smoke`. Do not move or delete an existing `vX.Y.Z` tag. Ship a new version instead.

## Human steps after the guardrail pull request merges

These stay human. Agents do not perform them.

1. Add the Actions secret `SYNC_BOT_TOKEN` (contents: push tags and create Releases; pull requests: open the staging sync).
2. Add `VERCEL_AUTOMATION_BYPASS_SECRET` so `staging-smoke` can pass Deployment Protection. Until then, `staging-smoke` fails closed on the SSO redirect.
3. After `scope-guard` and `label-integrity` have reported on a pull request, require those check names on `staging` and `main`. Leave `verify` and `Vercel` required. Do not require the staging push run.
