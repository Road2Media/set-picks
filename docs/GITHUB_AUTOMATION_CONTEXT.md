# GitHub / Gemini automation context (Set Picks)

**Purpose:** Single source of truth injected into **`.github/workflows/gemini-pm.yml`** and **`scripts/groom-backlog.js`** so generated PRDs match this repo’s layout. Keep this file concise; full Cursor agent rules live in **`.cursorrules`**.

---

## When NOT to rewrite an issue

- **GitHub Actions:** Workflows run from the **default branch**’s `.github/workflows/` copy. If `[SKIP-PRD]` handling was added on another branch, merge to **default** before expecting skips to work on newly opened issues.
- **Body:** If the issue body (after leading whitespace) starts with **`[SKIP-PRD]`**, automation must **not** replace the body (Cursor agent–authored specs). The Action refetches the issue via the REST API and treats the **first non-empty line** as `[SKIP-PRD]` (after stripping a UTF-8 BOM if present).
- **Comms Optimize schedule (#778):** `.github/workflows/comms-optimize-schedule.yml` posts `[SKIP-PRD]` **comments** on epic #573 (kickoff prompts only — not issue-body rewrites). Same skip-prd discipline; agents never merge/deploy from that workflow.
- **SEO GSC weekly pack (#932 / epic #926):** `.github/workflows/seo-gsc-weekly-schedule.yml` posts a `[SKIP-PRD]` **SEO Optimize pack** comment on #926 (last-7d GSC registry queries + top new queries + GA4 organic landings for `/tour-stats*` and `/phish-setlist-prediction-game`). Script: `scripts/seo/gsc-weekly-snapshot.mjs`. **Does not** merge, deploy, or open PRs. Posts only when live GSC credentials are present; otherwise SKIP (fork-safe). Secrets: see playbook §4 + table below. Scored tune loop (draft PR to `staging` only when justified): **`docs/SEO_OPTIMIZE_AUTONOMY.md`** (#934). No weekly Action opens PRs.
- **Labels:** Do not run auto-PRD / do not groom if the issue has any of:
  - **`skip-prd`** — no GitHub Action PRD rewrite on open (use with `[SKIP-PRD]` for belt-and-suspenders).
  - **`cursor-authored`** — treat as human/agent final copy; skip Action and groom rewrites.
  - **`skip-groom`** — skip **backlog groom** only (script `groom-backlog.js`).
  - **`AI-PRD`** — already groomed; groom script skips by convention.

---

## Stack

- **Frontend:** React (Vite), Tailwind, React Router.
- **PWA / home screen performance (spike):** `docs/PWA_HOME_SCREEN_PERFORMANCE.md` — precache vs FCM service worker, measurement, deploy freshness.
- **Public landing SEO:** `src/shared/config/seo.js` + `seoRoutes.js` (prerender registry), `og-home-html.mjs` + `middleware.js` (social scrapers only on `/` — not Googlebot/bingbot), post-build `scripts/prerender-seo.mjs` (tour-stats SEO auto-expand #959 from `public_tour_stats/_index`; sitemap `<lastmod>` from `lastShowDate` #930; finished-tour wrap HTML + `/tour-stats-share/{slug}.jpg` #1140), `src/features/landing/ui/LandingSeo.jsx` (Helmet + JSON-LD), `public/llms.txt`, `public/robots.txt`, `npm run verify:seo-strings` / `verify:og-home` / `verify:seo-prerender`, `public/branding/og-card-1200x630.jpg` (regenerate via `npm run generate:og-card` after changing splash SVGs; bump `OG_IMAGE_VERSION` in `seo.js` / `og-home-html.mjs`). Ops + GSC baseline: **`docs/SEO_GEO_PLAYBOOK.md`** (epic #657 / #664; Child D #930 / E0 #931 / E1 #932 / E3 #934 / auto-expand #959 / epic #926). Query registry: `docs/seo/query-registry.json`. Weekly facts packs: `npm run seo:gsc-weekly-snapshot`. Scored loop: **`docs/SEO_OPTIMIZE_AUTONOMY.md`**. Public profiles `/user/:userId` are **`noindex,follow`** (#661).
- **Backend / data:** Firebase Auth, Firestore, App Check; **Firebase Cloud Functions** live under repo root **`functions/`** (e.g. `functions/index.js`), not `firebase/functions/`. Auth / App Check boot sequencing (idle-warm Auth; never await App Check before `signInWithPopup`): **`docs/AUTH_BOOT_PRACTICES.md`** (#850). Cold-open train: **`docs/RELEASE_TRAIN_COLD_OPEN.md`**; outbound link classes: **`docs/OUTBOUND_AUTH_HANDOFF.md`**. Password reset mail is **`requestPasswordResetEmail`** (Resend link on `www.setlistpickem.com`, #1049). Do not fix that host with Customize action URL, Firebase Hosting, or `VITE_FIREBASE_AUTH_DOMAIN`. Verification and email-change templates stay on Firebase.
- **Official setlists (Firestore):** `official_setlists/{showDate}` field semantics, scoring, save vs finalize — **`docs/OFFICIAL_SETLISTS_SCHEMA.md`**.
- **Pool admin callables:** `deletePoolWithCleanup` (issue #138) handles server-side pool delete + member cleanup via Admin SDK — **`docs/POOL_DELETE_RUNBOOK.md`**. Owner-auth + activity check mirror `src/features/pools/api/poolFirestore.js`.
- **Rules:** `firestore.rules` (referenced from `firebase.json`).

Do **not** propose new non-Firebase backends. Avoid unnecessary npm packages.

---

## Design system

- **Tokens, typography, surfaces, components:** **`docs/design.md`**.
- **Brand wordmark (SVG) storage and code contract:** **`docs/design.md`** §7 *Brand wordmark & asset storage* — files under **`public/branding/`** (served as **`/branding/…`**), canonical imports from **`src/shared/config/branding.js`**, surfaces include splash hero/header and dashboard chrome. PRDs that change the logo or bar layout should name these paths and avoid hardcoded asset URLs in feature code.

---

## Reduced FSD layout (strict)

| Layer | Path | Responsibility |
|--------|------|----------------|
| **Pages** | `src/pages/` | Routes, URL params, compose feature UI and feature hooks only. **No** direct Firestore/Firebase calls. |
| **Features** | `src/features/<domain>/` | Business capability: **`api/`** IO, **`model/`** hooks/orchestration, **`ui/`** presentational (no direct DB). |
| **Shared** | `src/shared/` | Domain-agnostic UI kit, utils, hooks, constants. **Imports only from `shared`.** |
| **App shell** | `src/app/` | Layout, dashboard routing composition (e.g. `DashboardLayout.jsx`, `dashboardPageMeta.js`). |

**Public API per feature:** `src/features/<domain>/index.js` — pages and other features import from here, not deep paths like `features/foo/model/bar.js`.

**Anti-patterns for “Proposed file changes”:**

- Do **not** place new feature UI in a generic **`src/components/`** tree for product features; use **`src/features/<domain>/ui/`**.
- Do **not** invent **`PoolAdmin.jsx` at repo root** or **`src/components/Pool*`** for new work unless migrating legacy explicitly called out in the issue.

---

## Import boundaries (summary)

- `pages` → `features`, `shared` only.
- `features` → same feature internals, `shared` only; cross-feature → other feature’s **root `index.js`** or move logic to `shared`.
- `shared` → `shared` only.
- Never import `pages` from features or shared.

---

## Dashboard routes

- Adding or renaming **`/dashboard/*`**: update **`src/app/layout/model/dashboardPageMeta.js`**, nav / **`isActive`** in **`src/app/layout/DashboardLayout.jsx`**, extend **`scripts/verify-dashboard-meta.mjs`**, run **`npm run verify:dashboard-meta`**.
- Dashboard shell / token drift in scoring, pools, and picks UI: **`docs/THEME_CONTRACT.md`**, **`npm run verify:dashboard-ui`** (CI).
- Vocabulary and IA: **`docs/DASHBOARD_IA.md`**.

---

## PR QA codified runners (#251, #347–#349)

- **Playbook:** **`.cursor/skills/pr-qa/SKILL.md`** §2.6, **`recipes.md`** §A–§C.
- **Scripts:** **`scripts/qa/`** — `qa:chunks`, `qa:cache` (Playwright + `vite preview`), `qa:preview-headers` (fetch against **`QA_PREVIEW_BASE_URL`** for §C). Local env: **`.env.qa.example`** → **`.env.qa.local`** (gitignored).
- **`qa:cache`** needs **`QA_APPCHECK_DEBUG_TOKEN`**, **`QA_TEST_EMAIL` / `QA_TEST_PASSWORD`** (splash sign-in; Firestore rules require auth), plus **`QA_PUBLIC_PROFILE_UID`**. See **`scripts/qa/README.md`**.
- **CI:** **`.github/workflows/ci.yml`** — job **`qa-runners`** (secrets: `QA_PUBLIC_PROFILE_UID`, `QA_APPCHECK_DEBUG_TOKEN`, `QA_TEST_EMAIL`, `QA_TEST_PASSWORD`); optional **`qa-preview-headers`** when repo **Variable** `QA_PREVIEW_BASE_URL` is set (secret **`QA_VERCEL_PROTECTION_BYPASS`** optional).
- **SEO GSC weekly pack secrets (#932):** Actions secret **`GSC_SERVICE_ACCOUNT_JSON`** (Search Console API SA JSON, or WIF ADC). Optional variables **`GSC_SITE_URL`** (default `https://www.setlistpickem.com/`) and **`GA4_PROPERTY_ID`** (default `527619709`, same Optimize property as `crew/scripts/ga4_snapshot.py`). Human must grant the SA (or WIF principal) Search Console access on the www property; optional GA4 Viewer for organic landings. **Never commit** SA JSON. Human SA steps: **`docs/SEO_GEO_PLAYBOOK.md`** §4. Without the secret the workflow SKIP-exits 0 (do not post fixtures to #926).
- **Playbook:** **`.cursor/skills/pr-qa/SKILL.md`** §2.6, **`recipes.md`** §A/§B “Preferred” paths.
- **Scripts:** **`scripts/qa/`** (`npm run qa:cache`, `npm run qa:chunks`); local env from **`.env.qa.example`** → **`.env.qa.local`** (gitignored). `qa:cache` needs **`QA_APPCHECK_DEBUG_TOKEN`** (UUID registered in Firebase App Check) plus **`QA_PUBLIC_PROFILE_UID`**. Headless Playwright + `vite preview`, not Vercel preview URLs.
- **Autonomous E2E follow-ups (post-#251):** [#347](https://github.com/pat792/set-picks/issues/347) (CI + same runners + secrets), [#348](https://github.com/pat792/set-picks/issues/348) (Vercel preview / §C / bypass), [#349](https://github.com/pat792/set-picks/issues/349) (auth-gated / emulators vs test harness). Third-party constraints are spelled out in each issue body.

---

## PRD “Proposed file changes” guidance

Prefer paths such as:

- `src/pages/<area>/<Page>.jsx`
- `src/features/<domain>/api/*.js`
- `src/features/<domain>/model/*.js`
- `src/features/<domain>/ui/*.jsx`
- `src/shared/ui/...`, `src/shared/lib/...`
- `functions/index.js`, `firestore.rules`, `firebase.json`

Name **existing** domains when known (e.g. `pools`, `picks`, `scoring`, `auth`, `profile`, `admin`); do not guess filenames that contradict FSD.

---

## Release issue close (#1149 / #1174)

- **Workflow:** `.github/workflows/close-shipped-issues.yml` on `release: published` (and `workflow_dispatch` for a dry run). It closes issues named with `Closes` / `Fixes` / `Resolves` on the staging PRs inside the promote. `Part of`, plain mentions, pull request numbers, closed issues, and the `keep-open` label stay open.
- Active only once the workflow file is on the default branch (`main`). It does not merge, deploy, or edit branch protection.

## Dependabot (active, #504 / #744 / #967)

- **Runbook:** **`docs/DEPENDABOT_OPERATIONS.md`** — enablement-wave root cause, T0 auto-merge, ops-reset, re-enable checklist.
- Config is `.github/dependabot.yml` on the **default branch** (`main`). Every entry has `target-branch: staging`. `open-pull-requests-limit` is **2** per entry. **0** is only for an ops reset.
- `*-safe` groups are minor/patch only. `.github/workflows/dependabot-auto-merge.yml` enables squash auto-merge for those groups after the workflow is on `main`. `.github/workflows/dependabot-scheduled-execution.yml` (#1052) runs Mondays at 18:00 UTC from `main`, enables auto-merge if that event was missed, and comments when a `*-safe` PR has been red or conflicted for 7 days. It does not push to the PR branch. Majors and `actions-all` are not auto-merged.
- **First enable dumps PRs immediately** (not weekly schedule). Ship `target-branch: staging` on day one or Dependabot opens against `main`.

---

## Maintenance

When architecture or automation behavior changes, update **this file** and keep **`.cursorrules`** and **`docs/DASHBOARD_IA.md`** aligned. If **`public/branding/`** or **`src/shared/config/branding.js`** changes materially, refresh **`docs/design.md`** §7 so automation and humans share the same contract.
