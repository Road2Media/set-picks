# House promos — Remote Config runbook

Phase 1 of epic #419 (#121). First-party banners only. This is the parameter contract a person uses in the Firebase console. It is not the Phase 2 ops panel, campaign store, or consent work (#420–#423).

Nothing in this repo turns the kill switch on. Do not change Remote Config from a pull request.

## What players see

One unit, on Standings, under the invite promo and above the board. Slot id `dashboard_standings_inline`.

- Banner only. No modal, interstitial, or sticky overlay.
- The logo tile is 56px (`h-14`).
- A filled unit uses the sponsored surface (`surface-sponsored`, `border-sponsored`, `content-sponsored`) so it does not blend into quiet standings cards. See `docs/design.md`.
- No creative, a failed load, or `ads_enabled=false` renders nothing and reserves no gap.
- The unit does not block picks, standings load, or Firestore listeners. Remote Config starts when Standings mounts the placement, not on the public splash.

`VITE_ENABLE_SPONSOR_SLOTS=true` shows the empty proportion shell in local and preview builds. It does not fill a creative and it is not the production control.

## Kill switch

| Parameter | Type | Default in the app | Meaning |
|-----------|------|--------------------|---------|
| `ads_enabled` | Boolean | `false` | `false` renders no unit and does not request the creative image. |

Leave this false until a creative is ready. Turning it off in the console is the way to clear the unit without a deploy. Clients pick up a new value on their next Remote Config fetch (about 12 hours in production, about 1 minute in local dev).

## Creative parameter

| Parameter | Type | Default in the app |
|-----------|------|--------------------|
| `dashboard_standings_inline` | String (JSON) | empty |

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

`body` is optional. The other fields are required.

| Field | Rule |
|-------|------|
| `creative_id` | Letters, numbers, `_`, `-`. Up to 64 characters. Sent to GA4. |
| `image_url` | `https` only. No `javascript:`, `data:`, or `http:`. |
| `alt_text`, `headline`, `cta_label` | Plain text. No `<` or `>`. |
| `destination_type` | `internal` or `external`. |
| `destination_url` | Internal: an allowlisted path (`/dashboard/profile`, `/dashboard/pools`, `/dashboard/standings`, `/how-it-works`, and the other routes in `validateAdCreative.js`). External: `https` URL, opened in a new tab with `rel="noopener noreferrer"`. |

A creative that fails those checks is dropped. The page stays up.

## Console steps

Project `set-picks`. Firebase console → Remote Config.

1. Add parameter `ads_enabled`, type Boolean, default `false`.
2. Add parameter `dashboard_standings_inline`, type String, default empty.
3. Publish a JSON creative only when the artwork and the destination are ready.
4. Set `ads_enabled` to `true` and publish.
5. To pull the unit, set `ads_enabled` back to `false` and publish. Do not wait for a deploy.

Conditions on app version or platform are fine. Do not target a premium flag. That field does not exist.

## GA4

Production hostnames only (`www.setlistpickem.com`, `setlistpickem.com`). Local and Vercel previews no-op, by the existing `ga4.js` gate.

| Event | When | Params |
|-------|------|--------|
| `ad_impression` | At least half the unit stays visible for 1 second. Once per mount. | `slot_id`, `creative_id` |
| `ad_click` | On click, before navigation. | `slot_id`, `creative_id`, `destination_type` (`internal` or `external`) |

## Placements that are not built

These would change navigation chrome or the picks flow. They are not slot ids in the app.

| Option | Where it would sit | Why it is not mounted |
|--------|--------------------|------------------------|
| Standings, in flow (shipped) | Under the invite promo | Existing #609 seam. Scrolls away. Does not cover the board. |
| Standings, sticky under the Views header | Fixed mobile chrome | Would grow the header or cover the top of the board while scrolling. |
| Picks inline | Above the Make Picks form | Shifts the pick card. |
| Profile, below the install card | Account preferences | New surface. The shell has no seam there. |
| Dashboard shell | Under the context bar on every tab | Would show on Picks and change the gameplay chrome. |
| Splash | Public home | Deferred for LCP. |

## Out of this runbook

- Google Ad Manager, AdSense, or any other ad script (#422).
- Consent, `ads.txt`, and privacy-policy updates (#421).
- An admin preview route, a Firestore campaign collection, or a War Room panel (#420).
- Premium or ad-free billing (#423).
