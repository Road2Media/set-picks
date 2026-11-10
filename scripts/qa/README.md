# `scripts/qa/` — agent-runnable browser QA recipes

Codified versions of the browser-side recipes documented in
[`.cursor/skills/pr-qa/recipes.md`](../../.cursor/skills/pr-qa/recipes.md).
The agent can run these directly without the human-in-the-loop screenshot
hand-off described in `.cursor/skills/pr-qa/SKILL.md` §3.

Pilot: [#251](https://github.com/pat792/set-picks/issues/251). CI wiring:
[#347](https://github.com/pat792/set-picks/issues/347), preview headers
[#348](https://github.com/pat792/set-picks/issues/348), auth for `qa:cache`
[#349](https://github.com/pat792/set-picks/issues/349).

## Setup (one time)

```bash
cp .env.qa.example .env.qa.local
# Edit .env.qa.local — see table below.
```

**Cloud Agents:** secrets are injected as env vars but runners load
`.env.qa.local`. Bootstrap automatically:

```bash
npm run qa:materialize-env   # writes .env.qa.local from QA_TEST_* + VITE_FIREBASE_*
npm run qa:auth-scenarios    # auth telemetry + routing (uses dev server / QA_TEST_* only)
npm run qa:cache             # or qa:chunks / qa:google-signup
```

Set `QA_DEV_ORIGIN=http://localhost:5173` to reuse a running `npm run dev` session.

`.env.qa.local` is gitignored. The npm scripts use Node
`--env-file-if-exists=.env.qa.local`.

### Environment variables

| Variable | Required by | Purpose |
|----------|-------------|---------|
| `QA_PUBLIC_PROFILE_UID` | `qa:chunks`, `qa:cache` | Firebase uid for `/user/<uid>` navigation. |
| `QA_APPCHECK_DEBUG_TOKEN` | `qa:cache` (strongly recommended `qa:chunks`) | Registered App Check **debug UUID** (Firebase Console → App Check → Manage debug tokens). |
| `QA_TEST_EMAIL` / `QA_TEST_PASSWORD` | `qa:cache` only | Dedicated test account; **`qa:cache` signs in** via splash `/?login=true` because Firestore rules require `signedIn()` for profile reads ([#349](https://github.com/pat792/set-picks/issues/349)). |
| `QA_PREVIEW_BASE_URL` | `qa:preview-headers` | Deployed origin, e.g. `https://….vercel.app` (no trailing slash). If unset, that runner **exits 0 SKIP**. |
| `QA_VERCEL_PROTECTION_BYPASS` | `qa:preview-headers` (when previews are protected) | Vercel automation bypass; sent as `x-vercel-protection-bypass`. |
| `QA_GOOGLE_TEST_EMAIL` / `QA_GOOGLE_TEST_PASSWORD` | `qa:google-signup` OAuth phase only | Dedicated Google account **not** registered in Firebase. Gating phase runs without these. |

### App Check note

Do **not** rely on `FIREBASE_APPCHECK_DEBUG_TOKEN=true` in automation — each run
generates a new UUID until registered. Use a **fixed** string in
`QA_APPCHECK_DEBUG_TOKEN`.

### App Check (`qa:cache` only)

`npm run qa:chunks` does not talk to Firestore. `npm run qa:cache` does, and
the production build uses App Check with the ReCAPTCHA Enterprise provider —
headless Chromium cannot pass that without a **debug token**.

1. Generate a UUID (any v4).
2. Firebase Console → **App Check** → your **Web** app → **Manage debug
   tokens** → add that UUID.
3. Put the same string in `.env.qa.local` as **`QA_APPCHECK_DEBUG_TOKEN`**.

If this variable is missing or not registered, the runner used to hang on
“Total points” while Firestore logged `403` / offline errors in the browser
console.

## Available runners

| Script | npm task | Recipe |
|--------|----------|--------|
| `chunk-split.mjs` | `npm run qa:chunks` | §A chunk-load |
| `firestore-cache.mjs` | `npm run qa:cache` | §B Firestore read cache |
| `preview-cache-headers.mjs` | `npm run qa:preview-headers` | §C cache-control on **deployed** preview |
| `auth-scenarios.mjs` | `npm run qa:auth-scenarios` | Auth/routing matrix; UR-B2 already-member + UR-B3 disposable new-user join |
| `picks-tertiary-viewport.mjs` | `npm run qa:picks-tertiary` | Picks tertiary labels at 320 / 375 / 390 (#1258). Needs `QA_TEST_EMAIL` / `QA_TEST_PASSWORD`. |
| `google-new-user-signup.mjs` | `npm run qa:google-signup` | Google new-user sign-up gating + optional OAuth |

Playwright runners (`qa:chunks`, `qa:cache`, `qa:google-signup`) spawn `vite preview`
on a throwaway port (production build). `qa:preview-headers` uses `fetch` only — no Playwright.

### Google new-user sign-up (`qa:google-signup`)

Two phases:

1. **Gating (always)** — Create account modal disables Google until Terms/Privacy
   checkbox is checked; Sign in modal does not require the checkbox.
2. **OAuth (optional)** — When `QA_GOOGLE_TEST_EMAIL` / `QA_GOOGLE_TEST_PASSWORD`
   are set, completes Google popup on the **Create account** modal and asserts
   navigation to `/setup`.

**Not covered:** new users who tap Google on the **Sign in** modal — that path is
intentionally blocked (PR #406) with copy directing them to Create account. Pool
invite (`/join/:code`) opens **Create account** so new Google joiners see the
legal checkbox (#577). `/login` opens **Sign in** (password reset / QA /
returning deep links); legacy `/?login=true` redirects there (#830).

GA4 funnel readout: `npm run ga4:auth-funnel` (needs `GA4_ACCESS_TOKEN` or
`gcloud` with `analytics.readonly`). See `docs/AUTH_TELEMETRY_RUNBOOK.md`.

## CI (GitHub Actions)

Workflow **`.github/workflows/ci.yml`** job **`qa-runners`** runs after **`verify`**:

- Requires repository **Actions secrets** (all four must be **non-empty**):
  `QA_PUBLIC_PROFILE_UID`, `QA_APPCHECK_DEBUG_TOKEN`, `QA_TEST_EMAIL`,
  `QA_TEST_PASSWORD`. Add under **Settings → Secrets and variables → Actions**
  on this repository. If any are missing, the job fails fast with an
  actionable error (same values as a working `.env.qa.local` on your laptop).
- Skips **fork** pull requests (secrets are unavailable to those workflows).
- The workflow **writes a short-lived `.env.qa.local`** from those secrets so
  `npm run qa:*` matches local `node --env-file-if-exists=…` behavior.

Optional job **`qa-preview-headers`** runs when repository **Variable**
`QA_PREVIEW_BASE_URL` is set; optional secret **`QA_VERCEL_PROTECTION_BYPASS`**.

## Adding a new runner

1. Self-contained lifecycle; tear down servers on exit.
2. Deterministic waits (network idle / DOM), not arbitrary `setTimeout`.
3. One concern per script.
4. Failures cite `recipes.md` §X.
5. Fixtures via `.env.qa.example` — never commit real UIDs/passwords.
6. Wire `npm run qa:<name>` with `--env-file-if-exists=.env.qa.local` where env is used.

## Out of scope

- **Telemetry runner** (§E) — vitest on emitters is enough for now.
- **Firebase Auth emulator** — optional future alternative to real test accounts.
