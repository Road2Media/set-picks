# PR QA Traps

Specific failure modes captured while running QA across perf epic #239
(PRs #246–#249). Each cost ≥10 minutes to diagnose the first time —
read this section before interpreting any ambiguous result.

## §1 Staging preview vs. per-PR preview

Two Vercel preview URL shapes exist:

- `set-picks-git-staging-<hash>.vercel.app` — reflects only what's
  merged to the `staging` branch.
- `set-picks-git-<branch-slug>-<hash>.vercel.app` — reflects the PR
  branch.

A user testing against the staging URL before merge will see code from
the *previous* PR and report phantom regressions. Always hand them the
per-PR URL. Pull it with:

```bash
gh pr view <N> --json comments -q '.comments[].body' \
  | grep -oE 'https://set-picks-git-[a-z0-9-]+\.vercel\.app' \
  | head -1
```

Prefer the URL whose slug contains the branch name.

## §2 The "JS" filter tab hides Firestore traffic

DevTools Network panel has filter tabs: All, Fetch/XHR, Doc, CSS, JS,
Font, Img, Media, Manifest, Socket, Wasm, Other.

Firestore uses Fetch/XHR. If the user says "I see no Firestore reads,"
80% of the time they have the JS tab clicked. Tell them to click
**All**.

## §3 `curl` and `fetch` against Vercel previews return 401

Deployment protection is enabled on all `set-picks-git-*.vercel.app`
URLs. The agent cannot hit preview URLs directly — any HTTP verification
(cache headers, JSON responses, asset fingerprints) must run through
the user's authenticated browser session.

Don't try `curl https://set-picks-git-*.vercel.app/...` as a shortcut.
It fails silently-enough to mislead.

## §4 `gh` GraphQL writes are sandbox-blocked

These commands return `Post "https://api.github.com/graphql": Forbidden`
in the default sandbox:

- `gh pr create`
- `gh pr comment`
- `gh pr review`
- `gh pr merge`
- `gh label list`
- `gh pr close`

REST-based `gh` reads work in the default sandbox:

- `gh pr view --json ...`
- `gh pr diff`
- `gh pr checks`
- `gh issue view`
- `gh issue list --json ...`

When you need a GraphQL write, add `required_permissions: ["all"]` to
the Shell call — do NOT try to avoid the permission by contorting the
command.

## §5 SPA Network-log persistence across soft nav

React Router soft navigation (`<Link>`, `navigate(...)`) does NOT clear
the Network tab. A user who screenshots after clicking through 4 pages
will see ALL requests from all 4 pages. If they report "100 requests on
this page," check the timeline waterfall — it's usually cumulative.

For before/after tests, tell them to:

1. Clear the log with the ⊘ button between scenes.
2. Do NOT hard-reload, which would defeat in-session caching.
3. Use "Preserve log: ON" so the log survives soft nav (which is
   separate from clearing it explicitly).

## §6 Firebase v10 WebChannel multiplexing

Every Firestore op — `getDoc`, `getDocs`, `onSnapshot`, batched writes,
transactions — uses the same WebChannel transport. Every op shows up as
a row like:

```
channel?VER=8&database=projects%2Fset-picks%2Fdatabases%2F(default)&...
```

You will NEVER see a row named
`/v1/projects/<p>/databases/(default)/documents/picks/<doc>`.

The discriminator is **size**:

| Row size | What it is |
|---|---|
| ~0.1 kB | WebChannel keep-alive / ack. Ignore for QA. |
| 1–5 kB | Small batch or listener heartbeat. Usually uninteresting. |
| >5 kB | A real read batch or listener snapshot. This is what you measure. |

For cache tests (§B in recipes.md), only multi-kB rows count as
"cache misses."

## §7 Rollup `useUserSeasonStats` circular-export warning

Non-blocking, expected, carried since #240. `npm run build` emits:

```
Export "useUserSeasonStats" of module "src/features/profile/model/useUserSeasonStats.js"
was reexported through module "src/features/profile/index.js" while both
modules are dependencies of each other...
```

Root cause: `features/profile` barrel is reached from both
`PublicProfilePage` and dashboard routes across the #240 lazy
boundaries. The "fix" Rollup recommends (deep-import) is blocked by
this repo's `no-restricted-imports` ESLint rule.

**Do not flag this as a regression.** Only chase it if a ticket
explicitly asks.

## §8 `npm test` exit code 134 (worker teardown)

Transient vitest worker-teardown flake. Symptoms:

```
Tests: <N> passed
Exit code: 134
```

Re-run `npm test` once. If it re-crashes with the same symptom,
investigate — there's a real problem. If the second run is clean, the
first was a flake.

## §9 Preview builds are production (no `import.meta.env.DEV`)

Anything gated behind `import.meta.env.DEV` — telemetry console
mirrors, debug panels, `console.info` hints — will NOT fire on the
preview URL. That's the production bundle.

Consequences:

- Don't tell the user "check the console for the telemetry line" on
  the preview URL. Tell them to run `npm run dev` locally, or use GA4
  DebugView.
- Don't claim "telemetry didn't fire" based on the preview URL alone.
  Preview is production; the console line is suppressed by design.

## §10 Follow-up issues are ordinary issue bodies

If during QA you have to file a follow-up issue (e.g. for a regression
that's scope-creep for this PR), write the body from the current code
and the acceptance criteria. Nothing rewrites that body on open.

## §11 `DashboardRoute` → `useSongCatalog` coupling (open follow-up)

When QA'ing a chunk-graph PR, don't be surprised that
`DashboardRoute-*.js` statically imports `useSongCatalog-*.js` (71 kB)
even though only `/dashboard/picks` and `/dashboard/admin` consume it.
This is a known pre-existing pessimization tracked for a future ticket
(decoupling via a dynamic import push-down in `DashboardRoute.jsx`).

**Don't flag it as a new regression** unless the current PR made the
coupling WORSE (e.g. a net-new reference from a previously-independent
chunk). `grep -l useSongCatalog- dist/assets/*.js` should return:
`AdminPage-*.js`, `DashboardRoute-*.js`, `PicksPage-*.js`. Anything
more, you've caught a regression.
