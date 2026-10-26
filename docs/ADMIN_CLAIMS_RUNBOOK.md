# Admin claim runbook

Operational guide for granting, revoking, and auditing the `admin: true` Firebase Auth custom claim used by Set Picks.

Introduced in issue #139 PR A as the preferred admin signal, with a transitional `pat@road2media.com` email fallback. **PR B (this milestone) tightened Firestore rules to require the claim and removed the email fallback everywhere** — from `resolveIsAdmin` (client), from `resolveAdminCallerRole` / `resolveSetAdminClaimCallerRole` (functions), from `assertAdminClaim` (formerly `assertAdminEmail` / `assertAdminClaimOrEmail`), and from `firestore.rules`. The claim is now the single source of truth.

---

## 1. Related functions

Both live in `functions/index.js`:

| Function | Type | Purpose |
|---------|------|---------|
| `setAdminClaim` | HTTPS callable | Grant or revoke `admin: true` on a target Auth user |
| `rollupScoresForShow` | HTTPS callable | Server-side replacement for `adminRollupApi.js`; gated by the `admin: true` claim |

Every other admin-only callable (`refreshLiveScoresForShow`, `setLiveSetlistAutomationState`, `pollLiveSetlistNow`, `getPhishnetSetlist`, `refreshPhishnetShowCalendar`, `refreshPhishnetSongCatalog`) is gated on the same `assertAdminClaim(request)` helper.

`setAdminClaim` authorization:

- Caller must be signed in.
- Caller must be a **super-admin** (UID listed in `SUPER_ADMIN_UIDS` env var — bootstrap / break-glass path) **or** already hold `admin: true`.
- Callers can set the claim on themselves (bootstrap) or on another uid (delegation).

---

## 2. One-time bootstrap (first admin)

The first time you roll this out — or after an accidental revocation that removes the last admin — no one has the claim. Seed the first admin via `SUPER_ADMIN_UIDS`.

### 2a. Set `SUPER_ADMIN_UIDS`

Find the bootstrap admin's Firebase Auth uid (Firebase console → Authentication → Users, or `firebase auth:export` → pick the row). Then set the env var on the deployed `setAdminClaim` function.

For Cloud Functions Gen 2 (v2) on Firebase, environment variables are set via `.env.<project>` files at `functions/` root, or via `firebase functions:config:set` (v1 API) / `--set-env-vars` on deploy. The simplest approach used elsewhere in this repo is a `functions/.env.<project>` file (git-ignored):

```bash
# functions/.env.setlistpickem (or whatever alias you use)
SUPER_ADMIN_UIDS=abc123xyz,defgh456
```

Then redeploy:

```bash
firebase deploy --only functions:setAdminClaim --project <alias>
```

> **PR B note:** the legacy email shortcut (previously let `pat@road2media.com` skip this env-var step) is gone. `SUPER_ADMIN_UIDS` is now the only bootstrap path — don't forget to populate it before deploying PR B to a new project.

### 2b. Self-grant the claim (preferred: in-app UI)

As the super-admin, sign into the app and navigate to `/admin`. If your account does **not** yet hold the `admin: true` claim, the `AdminClaimBootstrap` card (amber) renders above the "Locking the official setlist" warning with a single button:

**Grant admin claim to myself**

Click it. The UI:
1. Invokes `setAdminClaim({ admin: true })` against your own uid.
2. Force-refreshes the ID token (`getIdTokenResult(true)`) so the new claim is visible to the client without re-login.
3. Flips the card to green: "Admin claim active on your account."

`useAuth().isAdmin` now resolves via the claim.

> **Note:** An earlier version of this runbook documented a devtools `import()` snippet for bootstrap. That snippet worked against source paths (`/src/shared/lib/firebase.js`) that **don't exist** in the Vite production bundle on Vercel, so it's not viable in deployed environments. The in-app button replaces it. If you're working against the local dev server and want to script the call, see §4 (Admin SDK).

### 2c. Verify

The green "Admin claim active" pill on `/admin` is sufficient — it's rendered by reading the live ID token's `claims.admin`. If the page still shows the amber bootstrap card after clicking, see the Troubleshooting section below.

---

## 3. Grant the claim to another admin

Once you hold `admin: true`, you can delegate to other users:

```js
const fn = httpsCallable(getFunctions(app, 'us-central1'), 'setAdminClaim');
await fn({ admin: true, targetUid: '<other-user-uid>' });
```

The target user must refresh their ID token (`getIdTokenResult(true)`) or sign out/in before their client sees the new claim.

---

## 4. Revoke the claim

```js
await fn({ admin: false, targetUid: '<uid>' });
```

Revocations remove the `admin` key from custom claims entirely.

> **Break-glass:** If the last admin is revoked accidentally, a user listed in `SUPER_ADMIN_UIDS` can still call `setAdminClaim`. If `SUPER_ADMIN_UIDS` is empty, re-bootstrap from a machine with Admin SDK credentials using `setCustomUserClaims(uid, { admin: true })` directly.

---

## 5. Audit current claims

From a machine with the Firebase Admin SDK and appropriate service-account credentials:

```js
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const all = [];
let next;
do {
  const page = await admin.auth().listUsers(1000, next);
  for (const u of page.users) {
    if (u.customClaims?.admin === true) all.push({ uid: u.uid, email: u.email });
  }
  next = page.pageToken;
} while (next);
console.log(all);
```

Cloud Logging also records every `setAdminClaim` call with caller uid, target uid, grant/revoke, and whether the caller was acting as a super-admin. Filter by `jsonPayload.message="setAdminClaim"`.

---

## 6. Safety notes

- `setAdminClaim` only manipulates Auth custom claims; it never touches `picks`, `users`, or `official_setlists`.
- A token refresh is required for client-side `isAdmin` to flip. The app's `useAuth` subscribes to `onIdTokenChanged` so this propagates automatically after `getIdTokenResult(true)` without re-login.
- Firestore rules require the claim for writes to `picks` (admin-override only; owners write their own), `users` (admin-override only; owners write their own), `official_setlists` (admin-only write), `live_setlist_automation` (admin-only read, server-only write), and `rollup_audit` (admin-only read, server-only write). See `firestore.rules`.
- Admin SDK writes from scheduled / callable Cloud Functions (`gradePicksOnSetlistWrite`, `recomputeLiveScoresForShow`, `rollupScoresForShow`, `pollLiveSetlistNow`, show-calendar sync) bypass rules entirely, so server-side grading and automation are unaffected by the tightened rules.

---

## 7. PR B deployment checklist

PR B tightens Firestore rules and drops the legacy email fallback. Before merging to `main`:

1. **Grant the claim to every current admin** (via the in-app bootstrap UI on staging, or `setAdminClaim` from an existing admin). Double-check in Firebase console → Authentication → Users → "Custom claims" that every required admin has `admin: true`.
2. **Populate `SUPER_ADMIN_UIDS`** on the `setAdminClaim` function so the break-glass path exists if the last admin revokes themselves. Redeploy `setAdminClaim` if this changed.
3. **Staging QA** (see §8 checklist below).
4. Deploy rules **after** functions: `firebase deploy --only functions && firebase deploy --only firestore:rules`. Rolling out rules before the new functions means Admin-SDK writes still work but client-side admin UI breaks for the email-only holder.
5. **Rollback plan:** if anything misbehaves, revert with `firebase deploy --only firestore:rules` after checking out the pre-PR-B `firestore.rules` file (`git show HEAD~1:firestore.rules > /tmp/r.rules && firebase deploy --only firestore:rules --project <alias>` after replacing). Callable code can roll back via `firebase deploy --only functions --project <alias>` from the pre-PR-B commit.

---

## 8. PR B staging QA checklist

Most of the rule-level rows below are now **automated** via the Firestore emulator test suite at `firestore.rules.test.cjs` (`npm run test:rules`; also runs in CI on every push/PR). Those rows are marked *(auto)*. The remaining rows still need a quick manual pass on staging because they exercise the full Auth + Cloud Functions + UI integration, not just rules.

| Surface | Who | Expected | Coverage |
|---|---|---|---|
| Sign up → create profile | New user (no claim) | `users/{uid}` created (self-write rule) | *(auto)* for rule, manual for full Auth flow |
| Submit picks | Any signed-in user | `picks/{date_uid}` created/updated (userId matches auth.uid) | *(auto)* |
| Attempt to edit another user's pick | Non-admin | Rejected by rules | *(auto)* |
| Attempt to edit another user's users doc | Non-admin | Rejected by rules | *(auto)* |
| Attempt to write `official_setlists` | Non-admin | Rejected by rules | *(auto)* |
| Attempt to read `live_setlist_automation/{showDate}` | Non-admin | Rejected by rules | *(auto)* |
| Global standings | Any signed-in user | Loads (reads `users` + `picks`) | *(auto)* rules; manual UI |
| Pool details + member profiles | Any signed-in user | Loads (reads `users`) | *(auto)* rules; manual UI |
| Public profile by handle | Any signed-in user | Loads (reads `users`) | *(auto)* rules; manual UI |
| Admin setlist save | Admin (claim) | `official_setlists/{showDate}` write succeeds | *(auto)* rules; **manual** UI button |
| Admin Finalize and rollup | Admin (claim) | `rollupScoresForShow` callable succeeds; `rollup_audit/{showDate}` timestamp advances | **manual** (callable + UI integration) |
| Live-scoring trigger | N/A (Admin SDK) | `gradePicksOnSetlistWrite` still runs on setlist write | **manual** (scheduled / real webhook) |
| Live setlist automation UI | Admin (claim) | Reads `live_setlist_automation/{showDate}` pause/backoff metadata | *(auto)* rules; manual UI |

Also confirm: an admin who already grants themselves the claim via the `AdminClaimBootstrap` card in PR A sees the green "Admin claim active" pill and all admin surfaces continue to work after the rules tighten (no email fallback regression).

---

## 9. Rollup audit collection

Each successful `rollupScoresForShow` invocation writes a record to `rollup_audit/{showDate}` with:

| Field | Type | Meaning |
|-------|------|---------|
| `lastRolledUpAt` | serverTimestamp | When the rollup committed. Updated on every run. |
| `processedPicks` | number | Picks regraded in this run. |
| `skippedPicks` | number | Picks skipped (missing `userId`). |
| `totalPicks` | number | Total matching `picks` docs for this `showDate`. |
| `callerUid` | string \| null | Firebase UID of the admin who triggered it. |
| `showDate` | string | `YYYY-MM-DD`. Same as the document id (**v1.90.0 / #298**). |
| `tourKey` | string \| null | Tour label written into `seasonStats`, or null when the calendar snapshot did not list the date. |
| `tourKeyMissing` | boolean | `true` when this rollup skipped per-tour `seasonStats`. `false` after a later rollup resolves the key. Clearing it does not repair counters that were skipped on the first grade. |

This is a **Firestore-visible "when did the last rollup run"** signal, separate from per-pick `gradedAt` which only stamps the first grade. Useful for PM-level sanity-checking after idempotent re-runs (where pick `score` and `gradedAt` may not visibly change even though the batch committed).

**Tour-key drift (#298):** War Room shows a badge when any `rollup_audit` doc has `tourKeyMissing: true`. That is the operator view — no log query required. The badge is empty until Cloud Functions that write the field are deployed and a rollup runs. Historical misses (for example a show graded before it was on `showDatesByTour`) stay invisible until that show is rolled up again. Repair the short `seasonStats.{tour}.shows` with `node scripts/backfillSeasonAggregates.js` from `functions/` after the calendar lists the date. Re-finalize alone will not add the skipped show.

**Legacy `users.stats`:** `node scripts/cleanupLegacyUserStats.js` (dry-run) then `--apply` deletes only that field. Do not treat a dry-run as done.

PR B rules: admin-only read, no client writes. The Admin SDK bypasses rules on the write path.

---

## 10. Troubleshooting

### `setCustomUserClaims failed … (auth/insufficient-permission): Credential implementation provided to initializeApp() via the "credential" property has insufficient permission to access the requested resource.`

**Cause:** The Cloud Functions runtime service account lacks `roles/firebaseauth.admin`. This is a **fresh-project** / **first-time-deploy** symptom — Gen-2 Cloud Functions run as `<project-number>-compute@developer.gserviceaccount.com`, which gets `roles/editor` by default but not always the Firebase Auth management role needed to read users or set custom claims.

**Fix:** Grant the role once per project. Either run `scripts/grant-functions-auth-admin.sh <project-id>` (preferred) or the raw gcloud command:

```bash
PROJECT_ID=set-picks
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"
```

IAM changes propagate to the running function within ~30–60s. No redeploy needed. Retry the **Grant admin claim to myself** button.

### `No Auth user for uid=…` or generic `Lookup failed …`

The v1 PR A code masked every `admin.auth().getUser` failure as a misleading "No Auth user" error. If you see that exact message, your deployed function is pre-fix — redeploy from a branch that includes the error-surface fix (PR #197). The current code logs the real firebase-admin error code (`auth/insufficient-permission`, etc.) via `logger.warn("setAdminClaim.getUser failed", ...)` — filter Cloud Logging on that message to diagnose.

### Finalize and rollup "succeeded" but Firestore looks unchanged

Expected when re-running Finalize on an already-graded show: `gradedAt` is only stamped on the first grade (`isFirstGrade` check in `rollupScoresForShow`), and scores/user totals don't visibly change if the computation is deterministic and the inputs haven't changed. Check `rollup_audit/{showDate}.lastRolledUpAt` (§9) for a current timestamp, or filter Cloud Logging for `jsonPayload.message="rollupScoresForShow"`.

### `permission-denied: Only an admin can perform this action.` from a callable that used to work

PR B expectation. The calling user no longer has the `admin: true` claim. Either (a) grant the claim via `setAdminClaim`, or (b) if the account was relying on the legacy email fallback, self-grant via the `AdminClaimBootstrap` card on `/admin`.

### `FirebaseError: Missing or insufficient permissions.` on a client write that used to work

PR B expectation if the caller is not the document owner. Check:
- `picks` writes: incoming payload must carry `userId == auth.uid`; on update, the existing doc's `userId` must already match.
- `users` writes: path `userId` segment must equal `auth.uid`.
- `official_setlists` / `live_setlist_automation` / `rollup_audit` writes from the client are always rejected (admin claim required, or server-only).

If a legitimate admin flow hits this, confirm the admin holds the claim (§2c) and that `useAuth().isAdmin` shows `true` in React DevTools before writing.
