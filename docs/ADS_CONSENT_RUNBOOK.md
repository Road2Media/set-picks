# Advertising consent

Phase 3 of epic #419 (#421). This is the consent contract for a future third-party ad script. House promos stay on Firebase Remote Config. Their operator steps are `docs/ADS_REMOTE_CONFIG_RUNBOOK.md`.

No third-party ad script ships in this phase. Google Ad Manager, AdSense, and billing stay in #422 and #423.

## Decision

The consent script is **Google Funding Choices** (Privacy & messaging in Ad Manager or AdSense). It is the IAB TCF message that pairs with the Phase 4 candidate, Google Ad Manager. Cookiebot and Osano need their own accounts and would add a tracker before any ad network exists. They are not wired up.

Funding Choices needs an AdSense or Ad Manager account, a published message, and a site id. Patrick creates those. This repository does not. Until both build-time values below are set, the script tag is not created.

| Variable | Required | This build |
|----------|----------|------------|
| `VITE_CMP_PROVIDER` | No | Unset. The only accepted value is `google-funding-choices`. Any other value is treated as off. |
| `VITE_CMP_SITE_ID` | No | Unset. An AdSense `pub-` id (`pub-` plus 8 to 20 digits) or an Ad Manager network code (8 to 20 digits). A full URL is rejected. |

Both have to be present and valid. One without the other stays off. They are read at build time. Setting them is a Vercel environment change plus a rebuild. A pull request cannot set them.

When both are valid, the app shell appends one async script after paint:

`https://fundingchoicesmessages.google.com/i/<site id>?ers=1`

The element id is `set-picks-cmp`. A second mount does not add another tag. The marketing document and the login document do not mount it. The loader returns before it touches the document when the config is off.

The current Content-Security-Policy is report-only and does not list `fundingchoicesmessages.google.com`. With the env unset, that does not matter, because the tag is never created. If the env is turned on before the header change in `docs/ADS_CSP_SPIKE.md`, the browser will report the script and, while the policy stays report-only, still load it. Do not turn the env on until that spike's header change is in the same release as the script you mean to run. This phase does not edit `vercel.json`.

## What players can do today

Account → Preferences includes **Ad preferences** (`/dashboard/profile/account#ad-preferences`). The same link is on the privacy and terms pages. The section is the reopen control. There is no partner window, because no partner script is loaded.

- **Keep third-party ads off.** Default. Stored as `denied` once the player selects it. An advertising script cannot load.
- **Allow third-party ads later.** Stored as `granted` on this browser. Nothing loads from that choice while the CMP config is off.

The record is `localStorage` key `set-picks:ad-consent`, version 1, shape `{ "v": 1, "advertising": "granted" | "denied", "updatedAt": "<ISO timestamp>" }`. It stays on the device. A missing key, a bad JSON value, or a different `v` is `unknown`. `unknown` is not a grant.

`useAdConsent()` in `src/features/ads/model/useAdConsent.js` exposes `choice`, `cmpEnabled`, `advertisingAllowed`, `setAdvertisingChoice`, and `openPartnerPreferences`.

`canLoadThirdPartyAdScript(consent)` is the gate a Phase 4 provider calls before it inserts a tag. It returns true only when `advertisingAllowed` and `cmpEnabled` are both true. House promos do not call it. `AdPlacement` does not call it.

## When the partner signal counts

`advertisingAllowed` is computed in `resolveAdConsent`:

| CMP configured | Stored choice | TCF allows advertising | Advertising script |
|----------------|---------------|------------------------|--------------------|
| No | any | any | Blocked |
| Yes | `denied` | yes or no | Blocked |
| Yes | `unknown` or `granted` | no, or no callback yet | Blocked |
| Yes | `unknown` or `granted` | yes | Allowed |

The player off switch wins over the partner. A saved allow does not win over a partner denial.

TCF is read from `window.__tcfapi` only after the CMP config is on. The hook listens for `tcloaded` and `useractioncomplete`. Purpose 1 (storage and access) has to be granted, plus at least one of purpose 2, 3, or 4 (ad selection or ad profiles). `gdprApplies: false` is not an allow. `cmpuishown` is the banner, not a decision. A missing callback stays blocked. This build does not look up the player's region.

`openPartnerPreferences()` calls `googlefc.showRevocationMessage` when that function exists. Otherwise it reports that the partner window is unavailable. The button is rendered only when the CMP config is on.

## What this phase does not change

| Signal | Category | Behavior |
|--------|----------|----------|
| Firebase Auth and Firestore | Strictly necessary | Unchanged. The consent module does not import them. The shell effect does not await them. |
| Google Analytics 4 (`src/shared/lib/ga4.js`) | Analytics | Unchanged. Production hostnames only (`www.setlistpickem.com`, `setlistpickem.com`). Ad preferences do not turn it off. |
| House promo Remote Config | First-party content | Unchanged. `ads_enabled` is still the kill switch. A house promo is an image and a link we operate. It is not an advertising cookie. |
| Future third-party ad script | Advertising | Blocked. No tag is in the bundle. The gate above is what Phase 4 has to call. |
| Funding Choices | Consent | Off. Needs the two variables and Patrick's account. |

App Check is unchanged.

## ads.txt

`public/ads.txt` is served at `/ads.txt`. Vite copies `public/` into the build, and Vercel serves that file ahead of the catch-all rewrite, so no `vercel.json` change is required for the file to resolve. `robots.txt` already allows `/`.

The file has comments only. A comment-only ads.txt authorizes no sellers. That matches the product: there is no programmatic inventory.

`app-ads.txt` is not published. It is for a store app. This product is a website. A PWA uses `ads.txt`.

Seller lines wait on Phase 4. Do not invent a `pub-` id or a `google.com, …, DIRECT, …` record. When a real publisher id exists, Patrick adds one data record in the same change that turns the network on, then republishes. The IAB shape is:

```text
<ad system domain>, <publisher id>, DIRECT|RESELLER, <certification authority id>
```

Google's certification authority id is `f08c47fec0942fa0`. That id is public. It is not a seller line by itself, and it is not in `public/ads.txt`.

Who maintains the file: Patrick. The next edit belongs with the Phase 4 pull request (#422), after the Ad Manager or AdSense account exists.

## Commercial posture

The live game uses Phish.net. Phish.net's terms allow advertising on a free site. Epic #419 records that check (2026-10-14). The site stays free. This phase does not add a paid tier.

`docs/MULTI_BAND_COLLECTIONS_STRATEGY.md` flags setlist.fm as non-commercial only. The current product does not call setlist.fm. That limit applies if a future band is added through setlist.fm. It does not apply to this Phish game, and this phase does not add a data partner for personalized ads. Personalized ads are not live.

## What Patrick sets up before the CMP can load

1. Open or create the AdSense or Ad Manager account for `www.setlistpickem.com`. This repo does not have that account.
2. In Privacy & messaging, create the message you mean to show and publish it. Copy the site id from the install snippet. That is the `pub-…` value or the numeric id inside `fundingchoicesmessages.google.com/i/<id>`. Paste the id only, not the URL.
3. In Vercel, set `VITE_CMP_PROVIDER` to `google-funding-choices` and `VITE_CMP_SITE_ID` to that id for the environment you mean. Rebuild. Leave both unset until you want the script.
4. Ship the `vercel.json` header change from `docs/ADS_CSP_SPIKE.md` in the same release, or the script is only a report-only finding until CSP is enforced, and it is blocked after that.
5. Leave `public/ads.txt` without a seller line until the same account has a publisher id you are ready to authorize (#422).
6. Confirm in a private window that the tag is absent while the variables are unset, and that Account → Preferences still shows Ad preferences.

Do not change Remote Config, Firestore, or GA4 as part of that setup. House promos keep the kill switch in the Remote Config runbook.
