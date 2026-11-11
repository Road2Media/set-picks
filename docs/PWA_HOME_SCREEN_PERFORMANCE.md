# PWA / home screen launch performance

**Status:** Spike complete — [GitHub issue #383](https://github.com/pat792/set-picks/issues/383).
Implemented in `feat/383-pwa-home-screen-spike`.

---

## Problem statement

Users who add Setlist Pick 'Em to the **home screen** sometimes see **long perceived load** compared to keeping a **Safari tab** warm. Recent feature growth may increase JS payload and main-thread work; root causes should be measured before optimizing.

---

## Spike findings (June 2026)

### 1. `/assets/*` cache headers — confirmed ✅

`vercel.json` already sets `Cache-Control: public, max-age=31536000, immutable` on `/assets/*`.
Vite content-hashes every output file under `/assets/`, so the CDN and browser cache these files
indefinitely until the hash changes. **No action needed here.**

Key additional observations from `vercel.json`:
- `index.html` and all HTML routes → `max-age=0, must-revalidate` (correct — ensures shell freshness)
- `/firebase-messaging-sw.js` → `max-age=0, must-revalidate` (correct — SW must never be stale-cached)

### 2. Service worker strategy decision

**Decision: single composed service worker (FCM + Workbox precache) in a future sprint.**

Rationale:
- Today there is exactly one service worker registered at scope `/`: `public/firebase-messaging-sw.js`.
  A second SW at the same scope would replace it, breaking FCM background push.
- The clean path is to merge Workbox precache logic into the existing FCM worker. `vite-plugin-pwa`
  supports an `injectManifest` mode where you supply a custom SW file — the plugin injects the
  precache manifest and you import the Workbox runtime helpers. This keeps FCM messaging intact.
- Scope separation (two workers at different scopes) is technically possible but fragile; FCM
  requires scope `/` for the VAPID subscription, so the messaging worker must stay at root.

### 3. Update UX — implemented in this spike ✅

**Files changed:**

| File | Change |
|------|--------|
| `public/firebase-messaging-sw.js` | Added `message` event handler that calls `self.skipWaiting()` when it receives `{ type: 'SKIP_WAITING' }` |
| `src/shared/lib/useServiceWorkerUpdate.js` | New hook: watches `updatefound` / `statechange` on the SW registration; exposes `{ updateAvailable, applyUpdate }` |
| `src/shared/ui/UpdateAvailableBanner.jsx` | New component: sticky bottom banner with a "Reload" button |
| `src/app/layout/RootAppShell.jsx` | Wired `useServiceWorkerUpdate` + rendered `UpdateAvailableBanner` |

**How it works:**

1. `useServiceWorkerUpdate` calls `navigator.serviceWorker.getRegistration('/')` on mount.
2. It listens for `updatefound` events; when a new installing worker transitions to `installed`
   while there is already a controller (i.e. a second deployment), it sets `updateAvailable = true`.
3. It also handles the case where the page was already open during a deploy (checks `registration.waiting` immediately).
4. `UpdateAvailableBanner` renders a non-intrusive sticky toast at the bottom of the screen.
5. Tapping "Reload" posts `{ type: 'SKIP_WAITING' }` to the waiting worker, listens for
   `controllerchange`, then calls `window.location.reload()`.

This pattern is compatible with FCM: the same worker that handles background push now also
handles the skip-waiting protocol, with no interference.

---

## Current architecture (relevant bits)

| Piece | Behavior |
|-------|----------|
| **Shell** | Vite SPA: `index.html` + hashed chunks under `/assets/*`. |
| **Hosting** | Vercel (preview/production); `/assets/*` has `immutable` headers. |
| **Service worker** | `public/firebase-messaging-sw.js` — registered from `registerMessagingServiceWorker()` at scope `/`. Handles FCM background push **and** (as of this spike) `SKIP_WAITING` messages. |
| **Precache** | **Not yet implemented.** Planned for the follow-up Workbox sprint (see next steps). |

---

## Hypotheses (validate with profiling)

1. **Network:** First navigation downloads HTML + many JS chunks (and fonts/CSS).
2. **Execution:** Firebase init, App Check (`firebaseAppCheck.js`), React hydration, and dashboard route chunks compete on the main thread.
3. **No offline shell cache:** Without precaching, repeat opens still depend on network RTT and cache freshness. ← **Highest priority follow-up.**

---

## Next steps / follow-up issues to create

### Issue: Precache app shell with Workbox via vite-plugin-pwa

**Goal:** Cache `index.html` + critical JS/CSS chunks in the FCM service worker so repeat home-screen
opens are instant even on a slow or offline connection.

**Approach:**
- Add `vite-plugin-pwa` in `injectManifest` mode.
- Extend `public/firebase-messaging-sw.js` (or a merged entry) to import Workbox precache helpers
  and the injected manifest.
- Register `clientsClaim()` + keep the existing `SKIP_WAITING` handler.
- Validate FCM push is unaffected by running the push token flow in staging.

**Acceptance criteria:**
- `workbox-precaching` caches `index.html` and top hashed chunks on first install.
- FCM background push still works (integration test or manual smoke test).
- Lighthouse repeat-visit LCP improves vs baseline on throttled mobile profile.

### Issue: Baseline Lighthouse metrics (regression gate)

Capture and commit Lighthouse scores for the production URL under a throttled mobile profile
before the Workbox precache sprint so any regression is detectable in CI.

---

## Out of scope / constraints

- **Periodic Background Sync** is **not** reliable on iOS Safari for arbitrary "refresh app" logic — do not depend on it for correctness.
- Avoid adding backends beyond Firebase unless product explicitly requires it.

---

## Related code

- `src/shared/lib/firebaseMessaging.js` — SW registration
- `src/shared/lib/useServiceWorkerUpdate.js` — update detection hook (new)
- `src/shared/ui/UpdateAvailableBanner.jsx` — reload prompt (new)
- `src/app/layout/RootAppShell.jsx` — app shell (wired)
- `public/firebase-messaging-sw.js` — messaging + skip-waiting worker
- `vite.config.js` — build / chunks
- `vercel.json` — headers
