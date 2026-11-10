# In-app advertising — epic source of truth

Companion to GitHub epic (ads program) and issue #121 (Phase 1: first-party promo units).

## Program goal

Monetize Setlist Pick 'Em via **non-intrusive, contextual placements** while preserving gameplay UX. Legal copy already reserves ads and future premium (`docs/TERMS_OF_SERVICE.md`, `docs/PRIVACY_POLICY.md`).

## Phased delivery

| Phase | Scope | Ad source | Primary issue |
|-------|--------|-----------|----------------|
| **1** | Static/house promo banners | Firebase Remote Config JSON per slot | #121 |
| **2** | Slot registry, admin preview, kill switch | RC + optional Firestore `ad_campaigns` | [#420](https://github.com/pat792/set-picks/issues/420) |
| **3** | Consent / CMP, ads.txt, CSP, measurement | IAB TCF + partner SDK | [#421](https://github.com/pat792/set-picks/issues/421) |
| **4** | Programmatic third-party fill | Google Ad Manager / AdSense (web) or similar | [#422](https://github.com/pat792/set-picks/issues/422) |
| **5** | Ad-free premium (optional) | Product + billing (Stripe, etc.) | [#423](https://github.com/pat792/set-picks/issues/423) |

Phase 1 deliberately **does not** integrate third-party ad networks.

## Repo alignment (2026)

- **Stack:** Vite + React (`.jsx` / `.js` only), Tailwind, React Router, Firebase Auth/Firestore/App Check, Cloud Functions under `functions/`.
- **Analytics:** `react-ga4` via `src/shared/lib/ga4.js` — production hostnames only (`www.setlistpickem.com`, `setlistpickem.com`). Not Firebase Analytics SDK.
- **Firebase entry:** `src/shared/lib/firebase.js` (auth + Firestore only today). Remote Config is a **new** lazy init module.
- **FSD:** New capability → `src/features/ads/` (`api/`, `model/`, `ui/`, `index.js`). Pages compose; no `src/components/` for product UI.
- **Routes:** Public splash `src/pages/landing/SplashPage.jsx`; authenticated shell `src/app/layout/DashboardLayout.jsx` with Picks, Pools, Standings, Profile (`docs/DASHBOARD_IA.md`). No `SetlistDetailsPage`.
- **Premium:** Not implemented. Targeting uses auth state, `isAdmin`, route, show lock status — not subscription tier.

## Ad service integration matrix (later phases)

| Provider | Web fit | Notes |
|----------|---------|-------|
| **Firebase Remote Config** | Phase 1 | House promos, A/B, kill switch; no fill rate |
| **Google Ad Manager (GPT)** | Phase 4 | Standard web programmatic; needs CMP, `ads.txt`, CSP allowlist |
| **Google AdSense** | Phase 4 alt | Simpler, less control; same privacy/CSP requirements |
| **Carbon / EthicalAds / BuySellAds** | Phase 4 alt | Dev/community audiences; fewer trackers |
| **Firebase AdMob** | N/A for SPA | Mobile native only |

**Not in scope for web V1:** AdMob, prebid without legal/CMP review, storing creatives only in git.

## Technical requirements (cross-cutting)

1. **Provider abstraction** — `AdProvider` interface: `loadSlot(slotId, context) → AdCreative | null`. Implementations: `remoteConfigAdProvider`, later `gamAdProvider`.
2. **Slot registry** — `src/features/ads/config/adSlots.js` documents allowed `slotId`, surfaces, max dimensions.
3. **Context** — `route`, `surface` (splash \| dashboard-picks \| …), `authState`, optional `showDate` / lock status from existing hooks.
4. **Telemetry** — `ga4Event('ad_impression' \| 'ad_click', { slot_id, creative_id, destination_type })` per `src/shared/lib/ga4.js` conventions.
5. **Safety** — Render `alt`, `href`, `img[src]` only; validate URLs (https + internal path allowlist); no `dangerouslySetInnerHTML`.
6. **Performance** — Lazy-init Remote Config; defer fetch until dashboard mount or first `AdPlacement`; no blocking splash LCP.
7. **Privacy** — Phase 3+: CMP before personalized ads; document in privacy policy; align with future IDFA/GAID language already in policy.
8. **Commercial posture** — `docs/MULTI_BAND_COLLECTIONS_STRATEGY.md` flags setlist.fm API as non-commercial; confirm before expanding data partners under monetization.

## Initial placement candidates (Phase 1)

Mounted:

- **Standings, in flow, under the invite promo** (`dashboard_standings_inline`). This is the #609 seam. It scrolls away. It does not stick and it does not cover the board.

Not mounted. Each one would change navigation chrome or the picks flow:

- Picks, inline above the form (`dashboard_picks_inline`).
- Profile, below the install card.
- Dashboard shell, under the context bar on every tab.
- Standings mobile, sticky under the fixed Views header (would grow the fixed chrome or cover the board).
- Splash: **defer** until LCP/SEO impact assessed.

## Child issues

| Phase | Issue |
|-------|-------|
| 1 | [#121](https://github.com/pat792/set-picks/issues/121) — Remote Config + `AdPlacement` + GA4 |
| 2 | [#420](https://github.com/pat792/set-picks/issues/420) — Ops, kill switch, runbook |
| 3 | [#421](https://github.com/pat792/set-picks/issues/421) — CMP + policy + ads.txt |
| 4 | [#422](https://github.com/pat792/set-picks/issues/422) — Programmatic spike + integration |
| 5 | [#423](https://github.com/pat792/set-picks/issues/423) — Ad-free premium |

**Epic:** [#419](https://github.com/pat792/set-picks/issues/419)
