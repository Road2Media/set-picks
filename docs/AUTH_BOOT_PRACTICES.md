# Auth / Firebase boot practices

Standing rules for marketing, the **auth door** (`/login`), and the app SPA. Learned from Safari hotfix (#850), hard-ready Google (#858), redirect (#859), hop train (#860 / #880 / #881), and the 2026-08-05 recalibration: **HTML-first auth door** is the target — not another CSR hop tier.

**Roadmap / architecture:** `docs/AUTH_SEAMLESS_PATH.md` (**§5 authoritative path** — Phase 2 HTML-first `/login` shipped in v1.54.0).  
**Related:** `docs/OUTBOUND_AUTH_HANDOFF.md` · `docs/API.md` (`/login`). Code today: `login.html` / `loginMain.jsx`, `ensureFirebase.js`, `warmLoginAuthSurface.js`, `prefetchLoginIntent.js`.

---

## Rules

1. **Marketing `/` stays Firebase-free on cold first paint.** Marketing entry (`index.html` → `marketingMain`). Auth CTAs hard-navigate to `/login`. Do not put `AuthProvider` / `initializeApp` on the marketing critical path. Download-only prefetch of auth-door assets after idle is optional polish (**Phase 3** in path doc) — never execute Auth on marketing first paint.

1b. **Public `/tour-stats*` is marketing too (#853 / #869).** Paint chrome from the marketing entry. Prefer same-origin `/tour-stats-data/*.json` then Firestore REST — **do not** kick App Check from `PublicTourStatsPage`. Load App Check + Firestore SDK only as a last-resort fallback inside `fetchPublicTourStats*`. Do not put tour-stats on `app.html` / `AuthProvider`.

1c. **`/privacy` and `/terms` are an HTML-first legal door (#916).** Serve zero-JS shells with readable chrome + full policy body in the first HTML (`dist/privacy|terms/index.html`). No marketing CSR, no AuthProvider, no Firebase. Do not park legal on `app.html` / spa-boot. Soft routes may remain on the app SPA for in-app Profile links. Marketing footer uses hard `<a href>`.

2. **Auth door `/login`: form in first HTML; auth-only hydrate (Phase 2 / #892).**  
   - **Today (v1.54.0):** `/login` boots `login.html` with **real form controls** in the first document; `loginMain.jsx` hydrates Auth + form wiring (not `app-*.js` / react-query). Suspense fallback keeps form chrome (anti-#881 blank hang). Session hint and Google redirect return stay eager. Success → hard-navigate to `/setup` or `/dashboard`.  
   - Do **not** reintroduce a skeleton-only / empty-`#root` CSR door as the prod strategy.
   - **Neutral first focus (#909, #1050):** do not autofocus email/password on cold open (Safari Keychain / Face ID steals method choice). Credential fields start `readOnly` until a real user gesture; pre-gesture autofocus is blurred and parked on a non-editable target (no blinking cursor). A pointer, touch, or key gesture unlocks the field before focus and cancels those blur timers (0 / 50 / 150 / 400ms). Do not blur a credential field after that gesture — iOS will not open the keyboard if the first tap is stolen or if `readOnly` is still set when the touch starts.

2b. **Google CTA must not be enabled until Auth surface is ready (#858).** Disable Continue with Google (brief “Preparing sign-in…” OK) until Auth + click-path modules are ready. Ready click path: `signInWithPopup` / redirect with **no** `await ensureAuthReady()` or dynamic-import on the hot path.

3. **After auth chrome paints: warm Auth immediately** on `/login` (not only `requestIdleCallback`). Prefer `warmPath: 'intent' | 'speculative' | 'immediate'` as today. Prefetch post-auth app chunks only as non-blocking polish — they must not block form paint.

4. **Never await App Check before `signInWithPopup` / email Auth CTAs.** Use `ensureAuthReady()` + fire-and-forget Check on fallback paths. First enabled tap must open the account picker or start redirect.

5. **Await App Check only before Firestore SDK reads/writes.** Profile/consent and other SDK paths go through `whenFirebaseReady` / `ensureAppCheckNow`. Public `/tour-stats*` must **not** await App Check on the CDN/REST happy path (#869).

6. **Safari / iOS / in-app prefer redirect (#859).** Desktop Chromium/Firefox keep popup; `auth/popup-blocked` → one-shot redirect. On return, **always** call `getRedirectResult` after Auth is ready — do not require sessionStorage intent (Safari may drop the stash; #893).

7. **WebKit private is the auth-door merge gate.** `scripts/qa/*` is Chromium-only. Auth-door / gesture / boot changes need a human WebKit private check on marketing → `/login` (or closest available WebKit private). Do not claim Safari verified from `qa:*` alone.

---

## Anti-patterns

| Do not | Why |
|--------|-----|
| `await ensureAppCheckNow()` before `signInWithPopup` | Breaks Safari first-tap (#850) |
| Enable Google while Auth/click modules still downloading | First-tap race (#858) |
| Another CSR hop epic as the auth strategy | Path doc §5 — door construction, not preload tiers |
| Skeleton-only `/login` HTML as “done” for the auth door | Product door requires form in first HTML (Phase 2) |
| `initializeApp` / AuthProvider on marketing as a hop fix | Violates rule 1 |
| Kick App Check on marketing `/tour-stats` | Safari data-gate (#869) — CDN/REST first |
| Claim “verified on Safari” from `qa:cache` / `qa:chunks` alone | Harness cannot run WebKit |
| Ship auth-door boot changes without WebKit private AC | #881 hang class of failure |

---

## Quick verify

```bash
# Phase 0 / current: /login form becomes interactive (no indefinite skeleton)
# Google: Preparing… then enables; first tap → redirect (Safari) or popup (desktop Chromium)
# Network: App Check must not gate the Google OAuth request
# Marketing / — no Firebase execute on cold first paint
# /tour-stats — no App Check kick; CDN JSON / REST for aggregates (#869)
# Phase 2: View source / first document for /login includes form fields
```
