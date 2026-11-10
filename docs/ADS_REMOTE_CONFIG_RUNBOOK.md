# House promos — Remote Config runbook

Phase 2 of epic #419 (#420). First-party banners only. This is the operator contract for Firebase Remote Config: parameters, creative schema, staging and production publish steps, the kill switch, and rollback.

Nothing in this repo turns the kill switch on. Do not change Remote Config from a pull request. Patrick sets the values in the Firebase console by hand. There is no checked-in template.

The slot registry in `src/features/ads/config/adSlots.js` is the source of truth for allowed slot ids. The creative guard in `src/features/ads/model/validateAdCreative.js` is the source of truth for what JSON will render. This runbook matches both. A unit test fails if they drift.

## What players see

One unit, on Standings, under the invite promo and above the board. Slot id `dashboard_standings_inline`.

- Variant `banner`. No modal, interstitial, or sticky overlay.
- Surface `dashboard-standings`.
- The logo tile is 56px by 56px (`h-14`). The card uses the `L1` floor (`min-h-23`, `md:min-h-25`) only while a creative is showing.
- A filled unit uses the sponsored surface (`surface-sponsored`, `border-sponsored`, `content-sponsored`) and a Sponsored eyebrow. See `docs/design.md`.
- No creative, a failed load, or `ads_enabled` false renders nothing and reserves no gap. The image is not requested.
- The unit does not block picks, standings load, or Firestore listeners. Remote Config starts when Standings mounts the placement, not on the public splash, and not on other dashboard tabs.

`VITE_ENABLE_SPONSOR_SLOTS=true` shows the empty proportion shell in local and preview builds. It does not fill a creative and it is not the production control.

## Parameters

Project `set-picks`. One Firebase project serves local dev, Vercel staging, and production. A published **default** value applies to every channel that does not match a condition.

| Parameter | Type | In-app default | Console default until launch |
|-----------|------|----------------|------------------------------|
| `ads_enabled` | Boolean | false | false |
| `dashboard_standings_inline` | String (JSON) | empty | empty |

The in-app default is `defaultConfig` (the modular equivalent of `setDefaults`). A missing parameter, a failed fetch, or JSON that does not parse is treated as off. The page stays up.

Leave both console defaults false and empty. Put live values on a channel condition, not on the default, until you mean every host.

## Creative schema

One JSON object. Extra fields are ignored. They are not rendered. There is no HTML.

| Field | Required | Limit | Rule |
|-------|----------|-------|------|
| `creative_id` | yes | 64 | Letters, numbers, `_`, `-`. Must start with a letter or number. Sent to GA4. |
| `image_url` | yes | 2048 | `https` only. No username or password in the URL. No `javascript:`, `data:`, or `http:`. |
| `alt_text` | yes | 140 | Plain text. No `<` or `>`. |
| `headline` | yes | 80 | Plain text. No `<` or `>`. |
| `body` | no | 140 | Plain text. No `<` or `>`. Omit it or use an empty string. |
| `cta_label` | yes | 32 | Plain text. No `<` or `>`. |
| `destination_type` | yes | | `internal` or `external`. |
| `destination_url` | yes | 2048 | See the allowlist below. |

```json
{
  "type": "object",
  "additionalProperties": true,
  "required": [
    "creative_id",
    "image_url",
    "alt_text",
    "headline",
    "cta_label",
    "destination_url",
    "destination_type"
  ],
  "properties": {
    "creative_id": { "type": "string", "maxLength": 64 },
    "image_url": { "type": "string", "maxLength": 2048 },
    "alt_text": { "type": "string", "maxLength": 140 },
    "headline": { "type": "string", "maxLength": 80 },
    "body": { "type": "string", "maxLength": 140 },
    "cta_label": { "type": "string", "maxLength": 32 },
    "destination_url": { "type": "string", "maxLength": 2048 },
    "destination_type": { "enum": ["internal", "external"] }
  }
}
```

`additionalProperties` is loose on purpose. The app ignores unknown keys. It does not reject them.

### Internal destinations

`destination_type` `internal` opens an allowlisted path in the app. A query string and a hash are allowed. The path itself must be one of these exact paths:

- `/dashboard`
- `/dashboard/picks`
- `/dashboard/picks/lab`
- `/dashboard/picks/scorecard`
- `/dashboard/rewind`
- `/dashboard/phish-iq`
- `/dashboard/pools`
- `/dashboard/pools/create`
- `/dashboard/pools/join`
- `/dashboard/standings`
- `/dashboard/profile`
- `/dashboard/profile/notifications`
- `/dashboard/profile/account`
- `/dashboard/stats`
- `/dashboard/stats/personal`
- `/dashboard/stats/global`
- `/dashboard/stats/band`
- `/dashboard/stats/night`
- `/how-it-works`
- `/how-scoring-works`
- `/how-scoring-changed`
- `/about`
- `/phish-iq`
- `/phish-setlist-prediction-game`
- `/tour-stats`
- `/phish-at-msg`

Or a longer path under one of these prefixes:

- `/dashboard/pool/`
- `/tour-stats/`
- `/phish-at-msg/`
- `/rewind/`

`/login`, `/dashboard/admin`, a protocol-relative URL (`//example.com`), and a path with `..` are rejected. The unit renders nothing.

### External destinations

`destination_type` `external` must be an `https` URL with no username or password. It opens in a new tab with `rel="noopener noreferrer"`.

Image hosts are not allowlisted beyond `https`. Use a host you control. The tile is 56px by 56px with `object-contain`. A wide image letterboxes. The app requests the image only after the creative passes these checks and `ads_enabled` is true.

## Example creatives

Internal, install prompt:

```json
{
  "creative_id": "install_pwa_v1",
  "image_url": "https://www.setlistpickem.com/branding/splash-vinyl-mark.webp",
  "alt_text": "Setlist Pick'em mark",
  "headline": "Faster picks on show night",
  "body": "Add the app to your home screen.",
  "cta_label": "Install",
  "destination_url": "/dashboard/profile/account",
  "destination_type": "internal"
}
```

External, https only:

```json
{
  "creative_id": "house_notes_v1",
  "image_url": "https://www.setlistpickem.com/branding/splash-vinyl-mark.webp",
  "alt_text": "Setlist Pick'em mark",
  "headline": "How scoring works",
  "cta_label": "Read",
  "destination_url": "https://www.setlistpickem.com/how-scoring-works",
  "destination_type": "external"
}
```

Do not publish a creative that fails the guard. These render nothing:

- `image_url` of `javascript:...`, `data:...`, or `http://...`
- `destination_url` of `/login` or `https://example.com` with `destination_type` `internal`
- `headline` that contains `<` or `>`
- a string that is not JSON

## Channels

The client sets custom signal `release_channel` before it fetches:

| Signal value | When |
|--------------|------|
| `development` | `npm run dev` (Vite dev), even if you open it on a production hostname |
| `production` | `www.setlistpickem.com` and `setlistpickem.com` in a production build |
| `staging` | Every other host. That includes the staging alias `https://set-picks-git-staging-pat-4867s-projects.vercel.app` and pull-request previews on `*.vercel.app` |

A condition for `staging` does not match localhost, and it does not match production. A condition for `production` does not match staging. Comparisons are case-sensitive. The condition expression for staging is `app.customSignal['release_channel'].exactlyMatches(['staging'])`. Use `production` or `development` in that same expression for the other channels.

The default value matches any client whose signal does not hit a condition. That includes a browser still on the previous bundle, which does not send `release_channel`. Keep the default off. A production condition does nothing on www until this version is promoted. Staging picks the signal up when this branch is on the staging alias.

Verify each channel in its own private window. A browser that just fetched on staging can reuse that result on production for up to 60 seconds.

## Publish on staging

1. Firebase console → project `set-picks` → Remote Config.
2. Confirm the default `ads_enabled` is false and the default `dashboard_standings_inline` is empty.
3. Add the parameters if they are not there yet. Type Boolean and String. Do not publish a creative in the default value.
4. Create a condition named `Staging channel`. Type **Custom signal**. Signal name `release_channel`. Operator **exactly matches**. Value `staging`.
5. On `dashboard_standings_inline`, add a conditional value for `Staging channel`. Paste one example object. Save the previous JSON somewhere you can paste back.
6. On `ads_enabled`, add a conditional value for `Staging channel` set to true. Do this in the same publish as the creative. Do not publish true against an empty string.
7. Publish.
8. Private window → `https://set-picks-git-staging-pat-4867s-projects.vercel.app/dashboard/standings`. Sign in. The Sponsored unit is under the invite promo. Open the destination. Production stays empty.

Local dev will not show this conditional value. It sends `development`. Add a `Development channel` condition the same way only if you need the unit on localhost. Do not put that JSON in the default value.

## Publish on production

Do this after the staging check looks right.

1. Create a condition named `Production channel`. Custom signal `release_channel` exactly matches `production`.
2. Put the same creative on `dashboard_standings_inline` for that condition, and set that condition's `ads_enabled` to true.
3. Leave the default values false and empty so an unclassified host still renders nothing.
4. Publish.
5. Private window → `https://www.setlistpickem.com/dashboard/standings`. Sign in. Confirm the unit, the Sponsored label, and one click.

Do not target a premium flag. That field does not exist. Conditions on app version are fine. Percent rollout is fine if you want a smaller production slice. The kill switch below still has to be able to set every true value to false.

## Kill switch

Clearing the unit takes under 5 minutes and does not need a deploy.

1. Note the time.
2. Remote Config → set `ads_enabled` to false on the **default** value and on **every** condition (`Staging channel`, `Production channel`, and any other). A single condition left true keeps the unit on for that channel.
3. Publish. Leave the creative JSON in place so you can turn the same unit back on.
4. Open tab: a Standings tab that is already showing the unit clears it without a reload, usually within a few seconds. The Sponsored card, the image, and the gap are gone. The client drops the live connection once the unit is empty.
5. Fresh session: private window on the same host, sign in, open Standings. The seam is empty on the first load.
6. Warm cache: if a normal reload still shows the unit, wait until 60 seconds after that browser's last fetch, then reload once. Do not reload in a loop.
7. Stop when the open tab and a fresh session are both empty. That is inside the 5 minute budget.

## Rollback

Use the kill switch first when the creative is wrong, broken, or should not be on screen.

- **Turn it back on later.** Paste is not required. Set `ads_enabled` true only on the condition you mean, then Publish. Players pick it up the same way they picked up the off switch.
- **Swap the creative.** Replace the conditional JSON with the previous object you saved, then Publish. Use a new `creative_id` when the campaign is actually new, so GA4 can split the two.
- **Undo a whole publish.** Remote Config change history → roll back to the last version you trust. Rollback restores every parameter in that version, not only the promo. Use it when the publish changed more than this unit.

There is no Firestore campaign collection and no admin preview query. One JSON parameter per slot is the store. A bad value fails closed: the unit disappears, the board does not.

## Fetch interval

The production minimum fetch interval is 60 seconds. Local dev is 60 seconds too. That interval is a floor, not a poll.

- Standings mounts the placement once per full page load. That is the only fetch.
- Moving between Picks, Pools, Standings, Stats, and Account does not fetch again.
- A second load inside 60 seconds reuses the last result.
- While `ads_enabled` is false, the JSON is empty, or the JSON is invalid, the client does not open a live update connection.
- While a creative is on screen, the client listens for a publish. That is how an open tab clears without a reload. The listener stops when the unit is gone.

## Publish checklist

Run this before you Publish a creative.

- [ ] The JSON parses as one object.
- [ ] `creative_id` is within 64 characters and is new when the campaign is new.
- [ ] `image_url` is `https`, opens in a browser, and has no username or password. The artwork is a square mark. The tile is 56px by 56px.
- [ ] `alt_text` (140), `headline` (80), `body` (140, optional), and `cta_label` (32) are plain text. No `<` or `>`.
- [ ] `destination_type` is `internal` or `external`.
- [ ] An internal destination is on the allowlist above. An external destination is `https` and you opened it.
- [ ] The value is on the `staging` or `production` condition you mean. The default stays empty unless you intend every channel.
- [ ] `ads_enabled` for that condition is published true in the same publish as a finished creative, not against an empty string.
- [ ] You saved the previous JSON.
- [ ] After publish, a private window on that channel shows the unit.
- [ ] Once, on staging, before the first production publish: run the kill switch and confirm the empty seam within 5 minutes. Then turn that condition back on if the staging check should stay up.

## GA4

Production hostnames only (`www.setlistpickem.com`, `setlistpickem.com`). Local and Vercel previews no-op, by the existing `ga4.js` gate. Staging can show the unit and still send no GA4 events.

| Event | When | Params |
|-------|------|--------|
| `ad_impression` | At least half the unit stays visible for 1 second. Once per mount. | `slot_id`, `creative_id` |
| `ad_click` | On click, before navigation. | `slot_id`, `creative_id`, `destination_type` (`internal` or `external`) |

## Placements that are not built

These would change navigation chrome or the picks flow. They are not slot ids. Do not add Remote Config parameters for them.

| Option | Where it would sit | Why it is not mounted |
|--------|--------------------|------------------------|
| Standings, in flow (shipped) | Under the invite promo | Existing seam. Scrolls away. Does not cover the board. |
| Standings, sticky under the Views header | Fixed mobile chrome | Would grow the header or cover the top of the board while scrolling. |
| Picks inline | Above the Make Picks form | Shifts the pick card. |
| Profile, below the install card | Account preferences | New surface. The shell has no seam there. |
| Dashboard shell | Under the context bar on every tab | Would show on Picks and change the gameplay chrome. |
| Splash | Public home | Deferred for LCP. |

## Out of this runbook

- Google Ad Manager, AdSense, or any other ad script (#422).
- Consent, `ads.txt`, and the privacy-policy update. Those live in `docs/ADS_CONSENT_RUNBOOK.md` (#421). This runbook still does not gate house promos on that choice.
- A Firestore `ad_campaigns` collection or an admin `?adPreview=` route. One Remote Config JSON value per slot is enough for the mounted unit.
- Premium or ad-free billing (#423).
