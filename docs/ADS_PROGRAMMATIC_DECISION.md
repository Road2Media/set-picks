# Programmatic ads — provider decision

Phase 4 of epic #419 (#422). Read 2026-11-10.

This is the spike. The client proof of concept is default-off. It does not authorize a seller, it does not change `vercel.json`, and it does not load a third-party script in the default build.

## Recommendation

Use **EthicalAds** for the first programmatic placement. Leave it off until Patrick has a publisher account and applies the header, env, and policy changes below.

Do not integrate Google Ad Manager (GPT) or AdSense in this app until a later review accepts their content-security policy. Carbon and BuySellAds are the same kind of decision as EthicalAds and are not a second script.

## Comparison

| | Google Ad Manager (GPT) | Google AdSense | EthicalAds | Carbon | BuySellAds |
| --- | --- | --- | --- | --- | --- |
| Audience | Broad. Best fit for a fan site if the policy fit. | Broad. Less control than Ad Manager. | Developer tools. A weak fit for a Phish picks game. | Developer tools. | Direct sales. Mixed sites. |
| What we would control | Auctions, floors, house and programmatic in one slot. | A display unit, or Auto ads, which place themselves. | One image placement. Paid campaigns only in this client. | One script tag and a publisher id. | A sales package. Not reviewed as a script. |
| Content Security Policy | Not an allowlist. Google's supported policy is a per-response nonce, `'unsafe-inline'`, `'unsafe-eval'`, `'strict-dynamic'`, and `https:`. | The same strict policy as GPT. | Two stable hosts. No `'unsafe-eval'`. No nonce. | A small host list. Not pasted here. | A small host list. Not pasted here. |
| How this repo serves headers | Static strings in `vercel.json`. A new nonce on every response is a different architecture. | Same. | Append two hosts to the existing report-only strings. | Would be a later review. | Would be a later review. |
| Consent we already ship | Funding Choices is the CMP this gate already knows. | Same account family. | The script still waits on `canLoadThirdPartyAdScript()`. EthicalAds does not read TCF. The gate stays closed anyway. | Same gate. | Same gate. |
| `ads.txt` | A `google.com` seller line plus certification id `f08c47fec0942fa0`. | Same. | Copy the line from the EthicalAds dashboard after the account exists. | Their dashboard. | Their dashboard. |
| Account | Patrick. Not in this repo. | Patrick. | Patrick applies at [ethicalads.io](https://www.ethicalads.io/publishers/). | Patrick. | Patrick. |

Sources, read 2026-11-10:

- [GPT and a Content Security Policy](https://developers.google.com/publisher-tag/guides/content-security-policy). Domain allowlists are not a supported GPT integration. The supported policy includes `'unsafe-eval'` and `'strict-dynamic'`.
- [AdSense and a Content Security Policy](https://support.google.com/adsense/answer/16283098). Same strict policy.
- [EthicalAds client](https://ethical-ad-client.readthedocs.io/en/stable/). Script `https://media.ethicalads.io/media/client/ethicalads.min.js`. Placement attributes include `data-ea-publisher`, `data-ea-type`, and `data-ea-manual`.
- EthicalAds publisher prospectus: one ad on the page, publisher keeps 70% of ad revenue, show a fallback when they have no paid ad. [Prospectus PDF](https://www.ethicalads.io/prospectus/ethicalads-publisher-prospectus.pdf).

## Why EthicalAds is the first script

1. **The header we have can name it.** GPT and AdSense want a nonce that changes on every response, plus `'unsafe-eval'` and `'strict-dynamic'`. This app's policy is a static report-only allowlist, and `docs/SECURITY_HEADERS.md` keeps `'unsafe-eval'` off. `'strict-dynamic'` would trust later scripts loaded by an allowed script. A Vite build on Vercel cannot stamp a new nonce onto every bundle script from `vercel.json`. Adopting GPT is a security project, not a header edit.
2. **The proof of concept can ship dark.** With `VITE_PROGRAMMATIC_ADS_PROVIDER` and `VITE_ETHICALADS_PUBLISHER` unset, the loader returns before it creates a tag and before it imports the provider module. No request goes to `media.ethicalads.io` or `server.ethicalads.io`.
3. **The audience mismatch is real.** EthicalAds sells to developers. Setlist Pick'em players are here for a Phish game. Fill and revenue may be near zero. That is a reason to measure one slot, not a reason to turn on GPT's policy. Carbon is the same audience. BuySellAds needs a sales relationship this spike did not review.
4. **One ad on the page.** Their publisher rules ask for a single ad, and for a fallback when they have nothing paid. This client shows the house promo when Remote Config has a creative, and it asks EthicalAds only when that unit is empty. It uses an inline image placement (`data-ea-type="image"`, their `horizontal` class). It does not use StickyBox or FixedFooter. It asks for `paid` campaigns only, so an EthicalAds house ad is not treated as a fill.

Their rules also prefer the ad above the fold. This slot sits under the invite promo on Standings, and on a phone that can be below the fold. We are not moving it into the header or onto Picks. Confirm that with EthicalAds before the account goes live, or accept lower viewability.

## Why the others stay off

- **Google Ad Manager** is the better long-term network if we want fan-site fill and floors. Revisit it only with an explicit decision to leave the static allowlist, a plan for per-response nonces, and Patrick's network code. Not this change.
- **AdSense Auto ads** would insert placements the slot registry does not list. A manual AdSense unit has the same CSP problem as GPT and less control.
- **Carbon** is the fallback snippet in the EthicalAds docs (`cdn.carbonads.com`). It is another developer network. It is not loaded.
- **BuySellAds** is a direct-sold network. No host list is approved here.

AdMob stays out. This is a website, not a native app.

## What would change the recommendation

A few weeks of production data with the flags on, showing paid impressions near zero, is the signal to revisit Ad Manager. Until then the CSP cost is higher than the likely revenue. A static `vercel.json` header still cannot satisfy Google's nonce policy.

## Proof of concept in this repo

Slot id `programmatic_standings_inline`, on Standings, under the house unit `dashboard_standings_inline`. Picks, Profile, the dashboard shell, and the splash do not mount it.

The placement renders nothing unless every line below is true:

| Gate | Off means |
| --- | --- |
| `VITE_PROGRAMMATIC_ADS_PROVIDER` is exactly `ethicalads` | No script. Any other value is off. |
| `VITE_ETHICALADS_PUBLISHER` is one lowercase slug (`setlist-pickem` shape). A URL, a dot, or a space is rejected. | No script. The slug is a `data-ea-publisher` attribute. It is not part of the script URL. |
| `canLoadThirdPartyAdScript()` is true | No script. The CMP env and the TCF advertising signal both have to allow it, and a player "off" wins. House promos do not use this gate. |
| Remote Config `ads_enabled` is true | No script. The existing kill switch covers this slot. |
| Remote Config `programmatic_ads_enabled` is true | No script. Turning on a house promo does not turn this on. In-app default is false. |
| The house slot has no valid creative | The house unit shows. EthicalAds is not requested. |

When those pass, Standings dynamically imports `src/features/ads/api/ethicalAdsProvider.js` and appends:

`https://media.ethicalads.io/media/client/ethicalads.min.js`

The div is `data-ea-manual="true"`. The client does not request an ad until `ethicalads.load()`. `ethicalads.wait` decides the outcome:

- One or more placements: GA4 `ad_programmatic_fill`, then the usual half-visible-for-1-second impression.
- An empty list, a script error, a missing `ethicalads` global, or 8 seconds with no fill: the seam collapses. Nothing is reserved. The house unit, if any, is already the fallback.

`AdPlacement`'s props are unchanged. Pages still pass `slotId`. The programmatic component is a second component on the same page.

The provider module is its own chunk. The default Standings load does not request that chunk. The EthicalAds URL is not in the house placement file.

Clearing a house creative does not start EthicalAds until the next Standings load. Publishing either kill switch to false, while the EthicalAds unit is already up, drops the div and removes the script tag. A request already in flight can finish. The next decision does not call `ethicalads.load()`.

## Revenue and analytics validation

No revenue forecast. The check is whether the numbers exist and whether they agree, not whether they clear a target.

### GA4

Production hostnames only (`www.setlistpickem.com` and `setlistpickem.com`). Local, staging, and preview builds do not send these events. That is the existing `src/shared/lib/ga4.js` gate.

House events stay as they are: `ad_impression` and `ad_click` with `slot_id`, `creative_id`, and `destination_type` on the click. They do not gain a `provider` param.

Programmatic events, after a paid fill:

| Event | When | Params |
| --- | --- | --- |
| `ad_programmatic_fill` | `ethicalads.wait` returns at least one placement | `slot_id` (`programmatic_standings_inline`), `provider` (`ethicalads`) |
| `ad_impression` | Half the unit stays visible for 1 second, once per mount, and only after that fill | `slot_id`, `creative_id` (`ethicalads`), `provider` (`ethicalads`) |
| `ad_click` | A click on the unit after a fill, before navigation | `slot_id`, `creative_id` (`ethicalads`), `destination_type` (`external`), `provider` (`ethicalads`) |

In GA4 Admin, register event-scoped custom dimensions for `slot_id`, `creative_id`, `destination_type`, and `provider` if they are not already dimensions. An unregistered param is still collected. It is awkward to report on. Mark `ad_programmatic_fill` as a conversion only if we decide the fill itself is the business event. Impressions and clicks are the comparable counts.

Exploration: event count by event name, page path `/dashboard/standings`, breakdown `provider`. Do not put a player id, email, or handle on these events.

### EthicalAds reporting

In the publisher dashboard, turn on placement reporting and use element id `programmatic_standings_inline`. Record paid impressions, clicks, and revenue. Ignore their house campaigns. This client does not request them (`data-ea-campaign-types="paid"`).

### Weekly reconciliation, after production is actually on

For the first four weeks, write one row:

| Week | EthicalAds paid impressions | EthicalAds clicks | EthicalAds revenue | GA4 `ad_programmatic_fill` | GA4 programmatic `ad_impression` | GA4 programmatic `ad_click` |
| --- | --- | --- | --- | --- | --- | --- |

Read the gaps this way:

- GA4 is silent off production, so a staging test will not show up in GA4. Compare staging in the EthicalAds dashboard and the browser network log.
- A player who has not passed the consent gate never requests an ad. EthicalAds will not count them. That is not missing revenue.
- An ad blocker that stops the script drops both sides. An ad blocker that stops GA4 and not the script makes EthicalAds higher. Do not file that as a bug by itself.
- A week where the house creative is published should show **zero** EthicalAds requests. The waterfall is doing that on purpose.
- A large EthicalAds impression count with a near-zero GA4 fill count on production, with consent on and no house creative, is the tracking bug to investigate.

### Pass conditions

This pull request, before any account exists:

- A production or preview load with the env unset shows no request to `media.ethicalads.io`, `server.ethicalads.io`, `doubleclick.net`, `googlesyndication.com`, `carbonads.com`, or `buysellads.com`.
- Standings looks the same as before. The new slot renders nothing and reserves no gap.

The later turn-on, which is Patrick's:

- Staging, flags on, consent allowed, no house creative: either a paid image under the invite promo, or an empty seam when EthicalAds has no paid ad.
- Consent denied, or either Remote Config flag false: no EthicalAds request, even if the env is set.
- House creative published: the house unit shows, and EthicalAds is not requested.
- After four production weeks, the table above is filled in. Near-zero paid fill is a reason to stop or to reopen the Ad Manager CSP question. It is not a reason to widen the header.

## Operator setup

Patrick does this. A pull request cannot.

1. Apply for an EthicalAds publisher account for `www.setlistpickem.com`. Copy the publisher slug and the `ads.txt` line from their dashboard. Confirm the above-the-fold rule with them before going live.
2. Add the CSP hosts in `docs/ADS_CSP_SPIKE.md` to all three report-only policies in `vercel.json`. Leave the header report-only. Do not add GPT or AdSense hosts in that edit.
3. Set `VITE_PROGRAMMATIC_ADS_PROVIDER` to `ethicalads` and `VITE_ETHICALADS_PUBLISHER` to that slug in the Vercel environment you mean, then rebuild. Leave both unset until you want the script. Do not put them in a committed env file.
4. Set `VITE_CMP_PROVIDER` and `VITE_CMP_SITE_ID` in that same environment. The EthicalAds script waits on the Funding Choices gate even though EthicalAds does not use TCF. See `docs/ADS_CONSENT_RUNBOOK.md`.
5. In Firebase Remote Config, add Boolean `programmatic_ads_enabled`, default false. Publish it true only on the condition you mean, and only together with `ads_enabled` true. Steps are in `docs/ADS_REMOTE_CONFIG_RUNBOOK.md`. Do not publish either default as true.
6. In the same change that sets the production env, name EthicalAds in the privacy policy and the terms, and add the one `ads.txt` seller line from their dashboard. The policy already says we name the partner before a third-party advertising script loads. `public/ads.txt` stays comments-only until that slug exists.
7. Smoke a private window: flags off means no script tag and no request. Flags on and consent allowed means one request to `media.ethicalads.io`. Then run the `ads_enabled` kill switch and confirm the seam clears.

## Not in this change

- `vercel.json`, GitHub workflows, Vercel project settings, and env files.
- A real `ads.txt` seller line. No publisher slug exists yet.
- Google Ad Manager, AdSense, Carbon, BuySellAds, Prebid, or AdMob.
- A new placement on Picks, Profile, the shell, or the splash.
- A privacy-policy edit. The default build still does not load a third-party advertising script.
