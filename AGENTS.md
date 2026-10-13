# Agents

## Cursor Cloud specific instructions

### Environment

- **Node.js 24** is needed for Cloud Functions (`engines.node: "24"`). `nvm install 24` provides it. Caveat: a daemon-managed `node` at `/exec-daemon/node` (Node 22) sits ahead of `nvm` on `PATH`, so a bare `node` is v22. For Functions work prepend the nvm bin first: `export PATH="$HOME/.nvm/versions/node/v24.17.0/bin:$PATH"`. Root web app (Vite 4 / Vitest) runs fine on Node 22 too; only deploy/Functions strictly want 24.
- **Package manager:** npm (lockfile: `package-lock.json`). Three install targets, each with its own lockfile: root (`/workspace`), `functions/`, and `emails/`. The Cloud update script runs `npm ci` in all three.
- **Node for functions:** `cd functions && npm test` runs fine under the VM-default Node 22, but deploy (`engines.node: "24"`) wants Node 24 — see the version caveat below.
- **Playwright browser:** the Chromium binary is **not** preinstalled. Anything that drives a real browser (`npm run qa:cache`, `npm run qa:chunks`, ad-hoc Playwright scripts) needs `npx playwright install chromium` first, or it fails with a missing-executable error.
- **`.env`** is gitignored. Copy `.env.example` to `.env` for local dev. The `VITE_FIREBASE_*` config plus `QA_TEST_EMAIL` / `QA_TEST_PASSWORD` are injected as Cloud Agent secrets (env vars) and Vite picks them up automatically — you do not need to add them to `.env`.
- **QA Playwright runners** (`qa:cache`, `qa:chunks`, `qa:google-signup`) read **`.env.qa.local`**, not bare process env. On Cloud Agents, run **`npm run qa:materialize-env`** first — it writes `.env.qa.local` from injected secrets (resolves `QA_PUBLIC_PROFILE_UID` from `QA_TEST_EMAIL`, defaults `QA_APPCHECK_DEBUG_TOKEN` to the registered debug UUID `38422efd-029f-45b4-b028-7cf7fcaeeffc`). See `scripts/qa/README.md`.
- **Cloud Agent secret inventory (Settings → Cloud Agents → Secrets for this repo):**

  | Secret | Used by | Notes |
  |--------|---------|-------|
  | `QA_TEST_EMAIL` / `QA_TEST_PASSWORD` | `qa:cache`, dev sign-in | **Email/password returning user** — not Google OAuth |
  | `QA_PUBLIC_PROFILE_UID` | `qa:cache`, `qa:chunks` | Optional on cloud agents; auto-resolved by `qa:materialize-env` |
  | `QA_APPCHECK_DEBUG_TOKEN` | all Playwright QA | Optional; defaults to registered localhost UUID |
  | `QA_GOOGLE_TEST_EMAIL` / `QA_GOOGLE_TEST_PASSWORD` | `qa:google-signup` OAuth phase | Dedicated Google account **not** in Firebase; add to enable new-user Google E2E |
  | `VITE_FIREBASE_*` | app + materialize script | Already injected |
  | `GCP_CLIENT_EMAIL` / `GCP_PRIVATE_KEY` | admin Firestore, `runCommsTrigger`, morning-rankings replay | Same values as the GitHub Actions secrets. Without them an agent can sign in as the QA user and cannot mint an admin token, replay a comms send, or deploy functions. |
  | `GITHUB_PAT` | `workflow_dispatch` | Fine-grained. Default `gh` uses the Cursor GitHub App token, which cannot start workflows. For Actions, run `GH_TOKEN="$GITHUB_PAT"`. The PAT must have repository **Actions: Read and write** or dispatch returns 403 `Resource not accessible by personal access token`. |

New secrets apply to the next agent boot. A running agent does not see them.

### Running the application

- **Dev server:** `npm run dev` — Vite on `http://localhost:5173` (`strictPort: true`; free that port or it will fail).
- The app connects to the **remote Firebase project** (Firestore, Auth, Storage). There is no local emulator-first workflow for the SPA.
- **App Check works out-of-the-box on the localhost dev server — no IndexedDB seeding needed.** `src/shared/lib/firebaseAppCheck.js` now sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN` to the **pre-registered** UUID `38422efd-029f-45b4-b028-7cf7fcaeeffc` (not `true`) whenever `import.meta.env.DEV`, so signed-in flows (sign-in, picks, pools) succeed on `http://localhost:5173` with no extra setup. (Verified: signed in with the QA account and locked in picks against prod Firestore straight from `npm run dev`.)
- **Production/`vite preview` builds strip that DEV branch**, so headless Playwright against a preview must inject the token itself before the bundle runs (`self.FIREBASE_APPCHECK_DEBUG_TOKEN = '38422efd-...'` via `context.addInitScript`, as `scripts/qa/_lib/qaBrowserInit.mjs` does — set `QA_APPCHECK_DEBUG_TOKEN` to the registered UUID for the QA runners).
- **Browser automation gotcha:** once signed in, Firestore keeps a long-lived WebChannel open, so `page.goto(url, { waitUntil: 'networkidle' })` / `waitForLoadState('networkidle')` **after** login never settles and times out. Wait on concrete elements/text instead.
- **Test account:** sign in with `QA_TEST_EMAIL` / `QA_TEST_PASSWORD` (injected secrets) instead of creating throwaway accounts you cannot delete (the cleanup protocol in `docs/TESTING.md` needs Firebase Console access).
- **Firebase Storage `song-catalog.json` returns 402 (Payment Required)** on the current project (billing state). This is non-blocking: the song-search autocomplete falls back to the bundled static catalog, and Firestore (the actual game data) is unaffected. Ignore 402s from `firebasestorage.googleapis.com`; only worry about non-200s from `firestore.googleapis.com`.

### Lint / Test / Build (CI matrix)

Standard commands are in `package.json` scripts.

CI is now risk-weighted:
- Baseline checks run on all PRs/pushes (`verify` + Vercel).
- `functions`, `rules`, and `qa-runners` are conditional based on changed paths/risk.
- Nightly scheduled CI runs the full matrix as a backstop.

Core local commands:

| Check | Command |
|-------|---------|
| Lint | `npm run lint` |
| Unit tests (frontend) | `npm test` |
| Verify dashboard meta | `npm run verify:dashboard-meta` |
| Verify dashboard UI tokens | `npm run verify:dashboard-ui` |
| Functions unit tests | `cd functions && npm test` |
| Firestore rules tests | `npm run test:rules` |
| QA runners | `npm run qa:chunks && npm run qa:cache` |
| Build | `npm run build` |

> **Functions tests need the email artifact first.** `cd functions && npm test` includes `marketingCommsTemplates.test.js`, which `require`s `functions/emails/renderSummerTour2026Launch.cjs` — a **gitignored** esbuild bundle. Run `npm run emails:build` once (needs `emails/` deps, which the update script installs) before the functions suite, or that test fails with `Cannot find module './emails/renderSummerTour2026Launch.cjs'`.

### Dependabot / npm audit (#414)

- **Runbook:** **`docs/DEPENDABOT_OPERATIONS.md`** — first-enable timeline, ops-reset procedure, re-enable steps. Read before touching `dependabot.yml` or triaging dep PRs.
- **Dependabot** (`.github/dependabot.yml`) — **active** (re-enabled 2026-07-05, reworked 2026-07-28 #744): weekly npm groups contain **minor/patch only** (`*-safe` groups); **majors arrive as individual PRs** and require dedicated migration work (never merge on green alone — see `docs/DEPENDABOT_OPERATIONS.md` "Major upgrades"). Monthly Actions group; base `staging`; auto `skip-version-bump`; CI exempts `dependabot/*` and runs a `build` job on any dep/lockfile diff. Agents must **not** bump `package.json` on Dependabot PRs. `firebase-admin` majors ignored in `/functions` until `firebase-functions-test` supports admin 14.
- **Vercel:** `ignoreCommand` → `scripts/vercel-should-build.sh` skips previews for Actions/functions-only dep PRs.
- **CI `npm audit`** on the `verify` job is **informational** (`continue-on-error: true`). It does not block merge.
- **Triage:** Critical/high in **production** deps → fix or upgrade in a normal PR. Dev-only / low noise → defer or group into a maintenance PR. Do not mass-upgrade without running `npm test` and `cd functions && npm test`.

### Firestore indexes (#413)

- Composite indexes live in `firestore.indexes.json` (wired from `firebase.json`). Refresh from prod:
  `firebase firestore:indexes --project set-picks > firestore.indexes.json`
- Empty `indexes: []` is valid when production has no composites (single-field indexes are automatic). Add composites here when a new query requires them (Console link or CLI), then deploy with `firebase deploy --only firestore:indexes`.

### PR workflow notes

- **Base branch is `staging`**, not `main` (per `.cursorrules` §10).
- Branch naming: `feat/<issue#>-<kebab-slug>`.
- Firestore rules tests (`npm run test:rules`) require the Firebase emulator and are not part of the regular CI matrix for the web app.

### Gotchas

- The Vite build emits Rollup circular-dependency warnings for barrel re-exports. These are known and non-blocking.
- `sharp` (devDependency) may fail to install on some architectures; it is only used by `scripts/generate-og-card.mjs` and is not required for dev/test/build.
- Firebase Cloud Functions require Node 24 — if you see `engines` mismatch errors in `functions/`, ensure `nvm use 24`.
