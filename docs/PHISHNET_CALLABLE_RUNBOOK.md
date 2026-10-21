# Phish.net callable runbook

Operational guide for **`getPhishnetSetlist`** (Firebase Gen2 callable → Phish.net v5). For key hygiene, env flags, and first-time setup, see **README.md** (“Phish.net API key”). This doc is the **ordered triage** path when something breaks.

**Related:** issue [#146](https://github.com/pat792/set-picks/issues/146), epic [#42](https://github.com/pat792/set-picks/issues/42).

---

## Quick reference

| Item | Location / value |
|------|------------------|
| Callable | `functions/index.js` → `exports.getPhishnetSetlist` |
| Region | `us-central1` — must match `PHISHNET_CALLABLE_REGION` in `src/features/admin-setlist-config/api/phishApiClient.js` |
| Secret | `PHISHNET_API_KEY` (Secret Manager; sync via `npm run secrets:sync-phishnet`) |
| Client flags | `VITE_SETLIST_API_SOURCE=phishnet`, `VITE_USE_CALLABLE_PHISHNET_SETLIST=true` |
| Admin gate | Same email as `useAdminSetlistForm` / `ADMIN_EMAIL_FOR_SETLIST_PROXY` in `functions/index.js` |
| Deploy callable | `npm run deploy:functions:phishnet` (root or `functions/`) |

---

## 1. Confirm you are testing the right thing

1. Use a **past** show date. Phish.net may return empty data for **future** dates; failures then look like parser/UI errors, not auth.
2. Confirm **build env**: `VITE_SETLIST_API_SOURCE=phishnet` and `VITE_USE_CALLABLE_PHISHNET_SETLIST=true`. If source is `phishnet` but the callable flag is off, the client shows a **configuration** error by design.

---

## 2. Isolate: Phish.net key vs Firebase vs browser

Run **before** digging into Cloud Run or client code:

```bash
npm run diagnose:phishnet
```

(Works from **repo root** or **`functions/`.)

| Result | Next step |
|--------|-----------|
| **Fails** | Fix or rotate the key at phish.net → update `.env` `PHISHNET_API_KEY` → `npm run secrets:sync-phishnet` → `npm run deploy:functions:phishnet`. |
| **Passes** | Key is valid for direct HTTP. Continue to section 3. |

---

## 3. Secret bound and function deployed

1. Secret exists and matches what you expect: `firebase functions:secrets:access PHISHNET_API_KEY` (or re-run sync from a trusted `.env`).
2. **Redeploy after any secret change** so the revision binds the new secret version: `npm run deploy:functions:phishnet`.
3. Stale deploy is a common cause of “it worked yesterday” — when in doubt, redeploy.

---

## 4. Server-side logs

```bash
firebase functions:log --only getPhishnetSetlist
```

Look for `HttpsError` paths vs unexpected throws. Callable maps many failures to **`failed-precondition`** or **`unavailable`** so the **client** can show a message (see section 6).

---

## 5. Browser: callable error shape

1. Sign in as the **designated admin** (must match the function’s email check).
2. Open DevTools → **Console**. On failure, dev builds log **`[phishApiClient] getPhishnetSetlist callable failed`** with `{ code, message, … }`.
3. Read **`code`** (`unauthenticated`, `permission-denied`, `invalid-argument`, `failed-precondition`, `unavailable`, etc.) — that narrows the layer.

---

## 6. Symptom → likely cause

| What you see | Likely cause | What to do |
|--------------|--------------|------------|
| **CORS** / preflight failure on `cloudfunctions.net` or Cloud Run URL | Gen2 callable behind Cloud Run without public invoker at edge | Ensure `invoker: "public"` on `getPhishnetSetlist` in `functions/index.js`, redeploy. If deploy cannot set IAM, grant **Cloud Run Invoker** for `allUsers` on the **`getphishnetsetlist`** service (README has `gcloud` example). |
| **`FirebaseError: internal`** (generic) | Often **CORS/IAM** (above) or **redacted** `internal` errors from older code paths | Fix CORS first; ensure function uses non-`internal` `HttpsError` codes for user-visible failures; redeploy latest `functions/index.js`. |
| **`unauthenticated`** | Not signed in to Firebase Auth | Sign in; retry. |
| **`permission-denied`** | Signed-in user is not the admin email | Use the gated admin account. |
| **`invalid-argument`** | Bad `showDate` | Must be `YYYY-MM-DD`. |
| **`failed-precondition`** | Missing secret, Phish.net logical error (`error` field in JSON), bad JSON, HTTP error body | Read **message** / logs; run `diagnose:phishnet` if key suspected. |
| **`unavailable`** | Network error calling Phish.net from the function | Transient or DNS/outbound issue; check logs and retry. |
| Setlist “error” despite HTTP 200 | Phish.net returns **`error: false`** for success; logic must not treat that as failure | Fixed in callable + client — ensure deployed revision includes success check for `false` / `0` / `"0"`. |
| Localhost blocked when App Check enforced elsewhere | This callable sets **`enforceAppCheck: false`**; if still blocked, check **Firebase Console → App Check** for your app | Register **debug token** for localhost if needed for other APIs; confirm you are not misreading a different function’s error. |

---

## 7. Ordered checklist (copy for incidents)

1. [ ] Past show date, correct `VITE_*` flags.
2. [ ] `npm run diagnose:phishnet` passes.
3. [ ] `npm run secrets:sync-phishnet` (if key changed) + `npm run deploy:functions:phishnet`.
4. [ ] `firebase functions:log --only getPhishnetSetlist`.
5. [ ] Browser console: admin user + callable `code` / logged payload.
6. [ ] If CORS / generic internal: Cloud Run invoker + redeploy (section 6).

---

## 8. Show calendar sync (issue #160)

| Item | Location / value |
|------|------------------|
| Firestore doc | `show_calendar/snapshot` (read by signed-in clients) |
| Scheduled job | `scheduledPhishnetShowCalendar` — **daily** 6:00 America/New_York (`0 6 * * *`); new tour dates can publish mid-month |
| Admin callable | `refreshPhishnetShowCalendar` (same admin email gate as `getPhishnetSetlist`) |
| Upstream | Phish.net v5 `shows/showyear/{year}.json?order_by=showdate` |
| Client | `src/features/show-calendar` → `ShowCalendarProvider` (dashboard route); falls back to `src/shared/data/showDates.js` if the doc is missing |

**Tour / optgroup labels:** See **[docs/SHOW_CALENDAR_TOUR_LABELS.md](SHOW_CALENDAR_TOUR_LABELS.md)** — priority is **`tour_overrides`** → **Phish.net `tour_name`** (when not NPT) → **previous snapshot** → **heuristics**. Seed example: **`scripts/seed/show_calendar_tour_overrides.json`**. **`reviewQueue`** lists **new** dates vs last snapshot. Official **phish.com/tours** names are **not** scraped; use overrides to match the band’s wording when needed.

Deploy with **`npm run deploy:functions:phishnet`**, which deploys: `getPhishnetSetlist`, `scheduledPhishnetShowCalendar`, `refreshPhishnetShowCalendar`, `refreshLiveScoresForShow`, `scheduledPhishnetSongCatalog`, `refreshPhishnetSongCatalog`, `scheduledPhishnetLiveSetlistPoll`, `setLiveSetlistAutomationState`, `pollLiveSetlistNow` (see **`package.json`** script `deploy:functions:phishnet`). **`gradePicksOnSetlistWrite`** is defined in the same `functions/index.js` but is **not** in that list — redeploy it separately (`firebase deploy --only functions:gradePicksOnSetlistWrite`) or use **`firebase deploy --only functions`**. After first deploy, run **`refreshPhishnetShowCalendar`** once as admin (or wait for the schedule) so Firestore is populated.

## 9. Files to touch when changing behavior

- **Callable, secret, invoker, Phish.net URL:** `functions/index.js`
- **Live setlist scheduled automation (window, calendar gate, cadence):** `functions/phishnetLiveSetlistAutomation.js`
- **Show calendar fetch + grouping:** `functions/phishnetShowCalendar.js`
- **Client region + callable wiring + error extraction:** `src/features/admin-setlist-config/api/phishApiClient.js`
- **Local key smoke test (no Firebase):** `scripts/diagnose-phishnet-local.mjs`
- **Secret sync:** `scripts/sync-phishnet-secret.mjs`

---

## 10. Live-night automation (issues #164, #180)

| Item | Location / value |
|------|------------------|
| Scheduled poller | `scheduledPhishnetLiveSetlistPoll` (`functions/index.js`) |
| Active window | **4:00 PM–4:00 AM** in the show's venue timezone (calendar `timeZone`, default `America/Los_Angeles`). The cron timezone is `America/New_York`. If no show is inside its local window, the job makes **no** Phish.net calls. |
| Cron wake | Every **2** minutes (`*/2 * * * *`, `America/New_York`). Actual spacing vs Phish.net is **90–150 seconds** per show date via `live_setlist_automation/{showDate}.nextPollAt` after each successful fetch (`changed`, `no-change`, or `no-rows`), including Force poll. |
| Calendar (scheduled only) | **`show_calendar/snapshot.showDates`** — scheduled polling **only** considers dates in this set (strict). Missing/empty/unreadable snapshot → scheduled path skips (**no** Phish.net). |
| Target dates (scheduled) | `scheduledCandidateShowDates` in `functions/phishnetLiveSetlistAutomation.js`: venue-local **today** when that show is inside the window; venue-local **yesterday** only from local midnight until 4:00 AM, and only if that date is still on the calendar. **Not** “compare two setlists” — each date is still diffed only against its own last saved payload/signature. |
| Admin / force poll | `pollLiveSetlistNow` stays **unrestricted**: default still uses ET today + yesterday (`candidateShowDates`) with **no** calendar gate — recovery when the calendar is stale, you’re outside the ET window, or scheduled strict mode would skip. Optional explicit `showDate` unchanged. |
| Pause/resume callable | `setLiveSetlistAutomationState` |
| Manual recovery callable | `pollLiveSetlistNow` (forces one poll + one score recompute). A success clears `failureCount`, `lastError`, and any stale `nextPollAt`, then resumes the 90–150s cadence. |
| Player banner callable | `setLiveSetlistServiceStatus` — publish or clear `public_service_status/live-setlist-{showDate}` |
| Per-show state doc | `live_setlist_automation/{showDate}` (admin read). Player copy is the separate sanitized doc. |

**Upstream failures (#644):** Backoff stays exponential. Inside the venue-local 4:00 PM–4:00 AM window the cap is a jittered **3–5 minutes**, so a live show is probed again within 5 minutes. Outside that window the cap stays **30 minutes**. The `*/2` scheduler still skips until `nextPollAt`.

Three consecutive failures **in the live window** send one super-admin inbox message (`live-setlist-ops`) and one transactional email. A second tick in the same incident does not send again. If the incident is still open 30 minutes after `outageStartedAt`, one escalation is sent. The first successful upstream response after an alert sends one recovery note (downtime, last failure count, whether the setlist changed, picks refreshed when Force poll recomputed them). These alerts do not use player notification prefs or the daily email cap.

The same third failure publishes `public_service_status/live-setlist-{showDate}` with `messageKey: phishnet_stalled`. Standings for that date shows the approved delay sentence. A successful poll clears an automatic banner. A War Room pin stays up unless **Clear automatically when Phish.net recovers** was checked, or an admin clears it.

**Rate limit triage (Phish.net `error: 4`):** Watch Cloud Logging for `live setlist poll failed` and Phish.net logical errors. Failures stamp `nextPollAt` with the capped backoff above. If `error: 4` appears often, widen spacing (code: `randomScheduledPollDelayMs` / cron) or pause automation for the date until traffic cools. See [Phish.net errors](https://docs.phish.net/errors) and [API terms](https://api.phish.net/).

**Admin UI vs global show picker:** The dashboard “Select Show” list only includes dates from `show_calendar`. War Room uses **War Room show date** (`<input type="date">`) so you can load or poll **any** `YYYY-MM-DD` that exists in Firestore / Phish.net (e.g. Mexico) even when that date is missing from the global picker.

**`isScored: false` on automated writes:** Expected for live ingestion — the doc is not “finalize graded.” **Finalize and rollup** still sets graded profile state separately.

### Firestore rules (admin UI)

Clients read `live_setlist_automation/{showDate}` for pause/backoff UI. **`firestore.rules`** must allow that read for the designated admin email; deploy after changes:

```bash
firebase deploy --only firestore:rules
```

Without this, the admin console shows **Missing or insufficient permissions** on load.

### CORS / “No Access-Control-Allow-Origin” on new Gen2 callables

`pollLiveSetlistNow`, `setLiveSetlistAutomationState`, and `setLiveSetlistServiceStatus` each get their own **Cloud Run** service name (lowercase). If the browser reports a **CORS** failure on `…cloudfunctions.net/pollLiveSetlistNow`, treat it like **`getPhishnetSetlist`** (README §CORS): redeploy with `invoker: "public"` in `functions/index.js`, then if needed grant **`roles/run.invoker`** for **`allUsers`** on the **`polllivesetlistnow`**, **`setlivesetlistautomationstate`**, and **`setlivesetlistservicestatus`** services in `us-central1`, same as `getphishnetsetlist`.

### Live-night SOP

1. Keep automation **enabled** for active show date in admin panel.
2. Monitor function logs for `live setlist poll cycle` and per-date result (`changed`, `no-change`, `paused`, `backoff`).
3. If API turbulence occurs, backoff is stamped in `live_setlist_automation/{showDate}.nextPollAt` (3–5 minutes while the show is in the local window, otherwise up to 30). War Room health reads **Backing off**, and after three live-window failures super-admins get one inbox item and one email.
4. For incident recovery (stale score or missed update), run **Force poll + score refresh** from admin panel or call `pollLiveSetlistNow`. That is not the same as **Save Official Setlist**. A successful Force poll clears the stale backoff so the scheduler does not wait out the old deadline.
5. Players on that show's Standings see the delay banner while `public_service_status` is `degraded`. Clear a manual pin from War Room, or let recovery clear an automatic banner.

### Rollback

1. Pause automation with `setLiveSetlistAutomationState(showDate, false)`.
2. Use existing manual admin flow (**Fetch from API** + **Save Official Setlist**) for the date.
3. Resume automation after incident confirmation.
