---
name: cloud-dev
description: Starter skill for Cloud agents working on this codebase. Covers environment setup, dev server, auth, feature-flag-style config, the full CI verify matrix, Firestore rules tests, Cloud Functions tests, QA runners, and common testing workflows organized by codebase area. Use when starting any implementation task, debugging session, or when you need to know how to run, build, or test this project.
---

# Cloud Agent Dev & Test Skill

Quick-reference for Cloud agents. Assumes a fresh VM with Node 20+ and
npm available.

## 1 — Bootstrap

```bash
npm ci                         # root deps (Vite, Vitest, ESLint, Playwright, etc.)
cd functions && npm ci && cd .. # Cloud Functions deps (firebase-admin, firebase-functions)
```

Playwright's Chromium binary is needed by `qa:cache` and `qa:chunks`.
If the runners complain about a missing browser:

```bash
npx playwright install chromium
```

### Environment files

| File | Purpose | Gitignored? |
|------|---------|-------------|
| `.env` | Local dev overrides (GA4, FCM VAPID key, setlist API source). Copy from `.env.example`. | Yes |
| `.env.qa.local` | QA runner fixtures (test UID, App Check debug token, test account). Copy from `.env.qa.example`. | Yes |
| `.env.staging` / `.env.production` | Vite mode files for `build:staging` / `build`. Checked in. | No |

For most implementation work, **no `.env` file is required** — the app
starts fine without one (GA4 and FCM are optional locally). If you need
to run the QA Playwright runners (`qa:cache`, `qa:chunks`), you need
`.env.qa.local` with real values (see §5).

## 2 — Dev server (Vite SPA)

```bash
npm run dev          # http://localhost:5173  (strictPort: true)
```

The app is a **Vite + React 18 SPA** with React Router. It talks to
**production Firebase** (Auth, Firestore, App Check) — there is no
local emulator wiring for the web app. You can browse the landing page
and auth flows against the real backend.

### App Check debug token (localhost)

Firebase App Check blocks Firestore reads from unrecognized origins.
For `localhost:5173`, add the debug token from `docs/TESTING.md`
(`38422efd-029f-45b4-b028-7cf7fcaeeffc`) to the Firebase Console
App Check debug-token allowlist, **or** set a custom
`QA_APPCHECK_DEBUG_TOKEN` UUID and register it.

### Auth / logging in

The app uses **Firebase Auth** (email/password + Google popup).
There is no emulator-backed auth — sign-in hits the real Firebase
project. For testing:

- **Existing accounts:** Use a known test email/password (see
  `docs/TESTING.md` for the reset protocol).
- **New-user flow:** Create a throwaway account via the sign-up modal,
  then delete it from the Firebase Console afterward (Auth → Users +
  Firestore → `users` collection).

Cloud agents **cannot** complete Google OAuth popups or interact with
the Firebase Console. For headless sign-in during QA, the Playwright
runners in `scripts/qa/` sign in via the `/login` auth entry
using `QA_TEST_EMAIL` / `QA_TEST_PASSWORD`.

### Feature flags / config switches

There is **no remote feature-flag service** (no LaunchDarkly, etc.).
Runtime behavior is controlled by **Vite env vars**:

| Env var | Effect |
|---------|--------|
| `VITE_SETLIST_API_SOURCE` | Setlist data source; see `.env.example` for allowed values |
| `VITE_USE_CALLABLE_*_SETLIST` | `true` → route setlist fetches through a Firebase Callable |
| `VITE_SONG_CATALOG_URL` | Override CDN URL for song catalog JSON |
| `VITE_GA_MEASUREMENT_ID` | GA4 measurement ID; leave unset locally to avoid polluting analytics |
| `VITE_FCM_VAPID_KEY` | FCM web-push VAPID key; optional for local dev |

To "toggle a feature," set or unset these in `.env` and restart the dev
server.

## 3 — CI verify matrix (run before every push)

These four commands must all pass — they form the blocking `verify` job
in `.github/workflows/ci.yml`:

```bash
npm run lint                    # ESLint flat config, FSD import boundaries
npm test                        # Vitest (src/**/*.test.js)
npm run verify:dashboard-meta   # Dashboard route ↔ meta consistency
npm run verify:dashboard-ui     # Banned legacy Tailwind token scan
npm run test:shipped-issue-close # Promote close-issue collector (#1149, #1174)
```

`test:shipped-issue-close` is part of the `verify` job (2026-10-22).

`ci-gate` always reports (#1148, 2026-10-22). `build`, `functions`, and `rules` still skip when their paths did not change. The gate fails only when one of those jobs, or `verify`, failed. Dependabot policy tests are `npm run test:dependabot-auto-merge`.

`npm test` exit code **134** is a known Vitest worker-teardown flake —
re-run once before flagging.

### When to run `verify:theme-contract`

```bash
npm run verify:theme-contract   # Banned raw bg-slate-*/border-slate-* in shell/scoring files
```

Run this when touching `src/features/scoring/ui`, `src/app/layout/`, or
any file listed in `scripts/verify-theme-contract.mjs`.

## 4 — Testing by codebase area

### 4.1 Frontend unit tests (Vitest)

```bash
npm test                  # all src/**/*.test.js
npm run test:watch        # interactive watch mode
npx vitest run <pattern>  # run a subset, e.g. npx vitest run scoring
```

- Config is in `vite.config.js` → `test` block (`environment: 'node'`).
- No setup file or global mocks — tests are self-contained.
- Test files live beside their source: `src/features/*/model/*.test.js`,
  `src/shared/utils/*.test.js`, etc.

### 4.2 Cloud Functions tests

```bash
cd functions && npm test && cd ..
```

Uses Node's built-in `node --test` runner over an explicit file list in
`functions/package.json`. Tests live at `functions/*.test.js`.

### 4.3 Firestore rules tests

```bash
npm run test:rules
```

Requires **`firebase-tools`** (install globally: `npm i -g firebase-tools`)
and **Java** (the Firestore emulator is a Java process on port 8080).
Runs `firebase emulators:exec --only firestore` then
`node --test firestore.rules.test.cjs`.

Only needed when the PR touches `firestore.rules`.

### 4.4 QA Playwright runners

These run a production build through headless Chromium. Require
`.env.qa.local` (see `.env.qa.example`).

```bash
npm run build             # must produce dist/ first
npm run qa:chunks         # §A chunk-load + SPA nav verification
npm run qa:cache          # §B Firestore read cache (signs in via splash)
npm run qa:preview-headers # §C cache-control headers on deployed preview (needs QA_PREVIEW_BASE_URL)
```

If `.env.qa.local` is missing the runners exit immediately with a
pointer to the README — not a test failure. If a runner exits non-zero
with env present, treat it as a real regression.

### 4.5 Build & chunk graph

```bash
npm run build
ls -la dist/assets/*.js | awk '{printf "%10d  %s\n",$5,$NF}' | sort -nr | head -20
```

Use this to verify lazy-loading, code splitting, and `manualChunks`
behavior after touching imports or route structure. See the PR-QA skill
(`pr-qa/SKILL.md` §2.2–2.3) for what to look for.

### 4.6 Lint only

```bash
npm run lint
```

ESLint 9 flat config in `eslint.config.js`. Enforces FSD import
boundaries (`import/no-restricted-paths`), blocks direct Firebase
imports from pages/features, and enforces barrel imports between
features.

## 5 — Dashboard route changes

When adding or modifying `/dashboard/*` routes:

1. Update `src/app/layout/model/dashboardPageMeta.js`.
2. Update `isActive` logic in `src/app/layout/DashboardLayout.jsx` if
   the new route is a child of an existing tab.
3. Add a test case in `scripts/verify-dashboard-meta.mjs`.
4. Run `npm run verify:dashboard-meta`.
5. Consult `docs/DASHBOARD_IA.md` for canonical vocabulary.

## 6 — Architecture quick reference

Strict reduced FSD: `pages` → `features` → `shared` (+ `app` for
shell). Full rules in `.cursorrules`. Key points for agents:

- **Pages** compose feature components; no direct Firebase calls.
- **Features** own `api/` (IO), `model/` (hooks/state), `ui/`
  (presentational). Public surface is `features/<domain>/index.js`.
- **Shared** is domain-agnostic only.
- Cross-feature imports go through public barrels, never deep paths.
- Path alias: `@/` → `src/` (configured in `vite.config.js`).

## 7 — Cloud Functions local dev

```bash
cd functions
npm run serve             # firebase emulators:start --only functions
npm run shell             # firebase functions:shell (REPL)
```

Functions use `firebase-admin` + `firebase-functions` v7. Deploy a
subset with the `deploy:functions:*` script in `package.json`.

### Release gate + comms deploy (agents)

| Command | When |
|---------|------|
| `npm run release:gate` | Before tag/release; mirrors CI SemVer check |
| `npm run release:gate:full` | Gate + full verify matrix |
| `npm run release:publish -- --confirm` | Tag + GitHub Release (**user must request**) |
| `npm run comms:deploy:validate` | After editing comms exports or `commsDeployManifest.js` |
| `npm run comms:deploy:list` | Inspect dynamic deploy targets (6+N adapters) |
| `npm run comms:deploy -- --confirm --group eventAdapters` | Deploy adapter cron/Firestore exports only |

Manifest source of truth: `functions/commsDeployManifest.js`. Full workflow: `.cursor/skills/comms-architect/SKILL.md` § Release + deploy tooling.

Scripts live in root `package.json`; **`functions/package.json` forwards the same names** so `cd functions && npm run comms:deploy:list` works.

## 8 — Common gotchas

- **No Auth emulator for the web app.** The Vite SPA always talks to
  real Firebase Auth. You cannot sign in without a real account.
- **App Check blocks unauthenticated Firestore reads** from unknown
  origins. Register a debug token for localhost (§2).
- **`npm test` exit 134** is a Vitest flake. Re-run once.
- **Vercel previews return 401 to curl.** Agents cannot verify deployed
  previews without user help. Use `npm run build && npm run qa:chunks`
  (localhost) instead.
- **Base branch for PRs is `staging`**, not `main`.
- **`[SKIP-PRD]`** must be the first line of agent-authored GitHub issue
  bodies to prevent the Gemini PM workflow from overwriting them.

## 9 — Keeping this skill current

Update this file whenever you discover:

- A new env var, secret, or config switch that affects local dev.
- A testing trick (e.g. a new QA runner, a mock pattern, a useful
  `vitest` flag) that would save future agents time.
- A new gotcha or failure mode during agent testing.
- Changes to the CI matrix or verification scripts.

**How to update:**

1. Edit this file (`/.cursor/skills/cloud-dev/SKILL.md`).
2. Keep sections numbered and concise — agents scan, not read.
3. Add the date and a one-line summary at the bottom of the relevant
   section so reviewers can see what changed and why.
4. If the discovery is PR-QA specific (browser recipes, chunk-graph
   traps), update `pr-qa/SKILL.md`, `recipes.md`, or `traps.md`
   instead.
