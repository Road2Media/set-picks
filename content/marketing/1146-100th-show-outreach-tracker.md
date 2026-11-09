# Outreach tracker: the 100th show at MSG (#1146)

**Status:** Draft. Nothing in this file has been sent, posted, or submitted.
**Date:** 2026-11-09
**Issue:** [#1146](https://github.com/Road2Media/set-picks/issues/1146)
**Parent:** [#1137](https://github.com/Road2Media/set-picks/issues/1137)
**Related:** [#974](https://github.com/Road2Media/set-picks/issues/974) (owned social, separate from this window), [#930](https://github.com/Road2Media/set-picks/issues/930) (off-site UTM conventions)
**Window:** December 1-20, 2026. One window. Do not start early, and do not extend it from this doc.
**Kit:** [`1146-100th-show-media-kit.md`](./1146-100th-show-media-kit.md)

## Do not send yet

On 2026-11-09, `https://www.setlistpickem.com/phish-at-msg`, `/embed/stats`, and `/tour-stats/2026-2027-nye-run` returned HTTP 200 with the homepage title and a canonical of `https://www.setlistpickem.com/`. They are not the Garden page, the embed, or the New Year's run page on production yet.

`https://www.setlistpickem.com/tour-stats/msg` did return the Garden page (title "Phish at MSG: 96 Shows by the Numbers | Setlist Pick'Em"). That path is the legacy route. On this branch it permanently redirects to `/phish-at-msg`.

Repo routes, already on `staging`:

| Offer | Route | Code |
| --- | --- | --- |
| Phish at MSG | `/phish-at-msg` | `src/pages/marketing/MsgGardenStatsPage.jsx`. Legacy `/tour-stats/msg` redirects here (`vercel.json`). |
| Embed card | `/embed/stats` | `src/app/App.jsx` (`StatsEmbedPage`). `/embed` redirects here. Copy embed sits on the Garden page (`StatsEmbedShareRow` in `MsgGardenStatsView.jsx`). |
| Predict the 100th | `/tour-stats/2026-2027-nye-run` | Button label on the page: "Create a NYE pool". It opens `/dashboard/pools/create` with the name `NYE Run`. |

Send the canonical URLs only after production serves those three pages. A link sent today lands on the homepage.

## What this window is

Value exchange only. Offer the MSG page, the embed card, and a pool for the run that ends on the 100th show (January 2, 2027). No paid links, no paid reads, no ad-sales forms.

Earned links get logged in the table below, then checked in Google Search Console in January 2027. Property: `sc-domain:setlistpickem.com`, Links report. Compare that report to the Link earned column. The epic checkpoint is January 15, 2027. This doc does not run that check.

## Rules for every message

- **Needs owner approval.** Each template below is a draft. Do not send, post, or submit it until the owner approves that specific message.
- Aggregates only. Never paste a night's setlist, a song-by-song recap, or Phish.net prose. Cite Phish.net when a Garden number is in the message. Credit line: "Data courtesy of Phish.net / The Mockingbird Foundation."
- Player-facing words use **slot** (the slot you called). Do not say chair.
- The embed is our game card: the tour leader and their points, or a link card with no numbers. It does not carry song titles, gaps, bustouts, play counts, or venue counts. Do not offer a widget of Phish.net data. The open questions for the Foundation (embed permission for their data, a paid tier) stay on #1137 and are not part of this pitch.
- Re-read `/phish-at-msg` before a send. Highlights in the kit come from the committed snapshot (`checkedOn` 2026-10-22). A later refresh can change a count.

## Status values

`needs owner approval` (draft exists, not sent), `approved to send` (owner said yes for that row), `sent` (human logs the date), `declined`, `no reply`, `skipped`.

Link earned stays `none` until a person pastes the live URL of the page that linked to us.

## UTM

Follow `docs/SEO_GEO_PLAYBOOK.md` §6. This window keeps `utm_campaign=seo_geo` (the same campaign as the other MSG shares on #1137). `utm_source` is the property name when §6 does not already list it. `utm_medium` stays inside the allowed set: `social` for Reddit and Discord, `referral` for a link on a site or in show notes. If the only click will be from the pitch email itself, change that one link's medium to `email` before sending.

`utm_content`:

| Asset | Content slug | Path |
| --- | --- | --- |
| MSG page | `phish-at-msg` | `/phish-at-msg` |
| Embed, prose link | `embed-stats` | `/embed/stats` |
| 100th page and pool | `predict-100th` | `/tour-stats/2026-2027-nye-run` and `/dashboard/pools/create?name=NYE+Run` |

The iframe `src` stays clean. The credit link inside the frame is already tagged by the app (`utm_source=embed` and `utm_campaign=seo_geo`, no medium). Do not add a second campaign onto that credit URL.

On-site, the NYE button uses a different set (`utm_source=tour-stats`, `utm_medium=cta`, `utm_content=nye-pool`). Off-site links in this tracker do not copy that set.

## Tracker

| Target | Verified URL | Contact | Offer | Status | Link earned |
| --- | --- | --- | --- | --- | --- |
| Phish.net / Mockingbird Foundation | https://phish.net/ | https://phish.net/contact and https://mbird.org/contact-us/ | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| Phish.in | https://phish.in/ | to verify | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| r/phish | https://www.reddit.com/r/phish/ | Reply only. Full rules: to verify | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| Phantasy Tour forums | https://www.phantasytour.com/ | Phish forum URL: to verify | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| Helping Friendly Podcast | https://www.osirispod.com/podcasts/helping-friendly-podcast/ | to verify | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| Undermine | https://www.osirispod.com/podcasts/undermine/ | to verify | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| After Midnight | https://www.osirispod.com/podcasts/after-midnight-phishs-big-cypress-festival/ | to verify | Same offer. Weak fit (Big Cypress series). Skip unless the owner wants it. | needs owner approval | none |
| Relix | https://relix.com/ | https://relix.com/about (`support@relix.com` for assistance). Do not use `advertising@relix.com`. Editorial desk: to verify | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| JamBase | https://www.jambase.com/ | https://www.jambase.com/contact (General Inquiries). Do not use Ad Sales. | MSG page, embed card, predict-the-100th pool | needs owner approval | none |
| Phishcord (Discord) | https://discord.com/invite/dcA56cA | Channel rules and mods: to verify. Do not DM. | MSG page, embed card, predict-the-100th pool | needs owner approval | none |

## Paste links

Replace nothing. If production still serves the homepage shell, do not paste these.

### Phish.net / Mockingbird (`utm_source=phish-net`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### Phish.in (`utm_source=phish-in`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### r/phish (`utm_source=reddit`, `utm_medium=social`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th

### Phantasy Tour (`utm_source=phantasy-tour`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### Helping Friendly Podcast (`utm_source=helping-friendly`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### Undermine (`utm_source=undermine`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### After Midnight (`utm_source=after-midnight`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### Relix (`utm_source=relix`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### JamBase (`utm_source=jambase`, `utm_medium=referral`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

### Phishcord (`utm_source=discord`, `utm_medium=social`)

- https://www.setlistpickem.com/phish-at-msg?utm_source=discord&utm_medium=social&utm_campaign=seo_geo&utm_content=phish-at-msg
- https://www.setlistpickem.com/embed/stats?utm_source=discord&utm_medium=social&utm_campaign=seo_geo&utm_content=embed-stats
- https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=discord&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th
- https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=discord&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th

Iframe for a fan page (no extra query on `src`):

```html
<iframe src="https://www.setlistpickem.com/embed/stats" title="Setlist Pick 'Em standings" width="360" height="240" style="border:0;max-width:100%" loading="lazy"></iframe>
```

Credit inside that frame: `https://www.setlistpickem.com/?utm_source=embed&utm_campaign=seo_geo`

## Templates

Each template **needs owner approval.** Do not send, post, or submit it.

### Phish.net / Mockingbird Foundation

**Needs owner approval.** Do not send, post, or submit this message.

Use the contact form at https://phish.net/contact or the foundation contact page at https://mbird.org/contact-us/. If neither form has a category for a fan project, do not send. Do not email the Foundation's general counsel, and do not attach the open API questions from #1137.

> Setlist Pick'Em is a free Phish prediction game. Before a show, a player locks six slots (set 1 opener and closer, set 2 opener and closer, encore, wildcard). The slot you called scores more than the same song in a different slot.
>
> We already credit Phish.net on the site. For the Garden's 100th show (January 2, 2027), we published an aggregate page: how often songs have been played at MSG, what opens the night, and the New Year's Eve counts. No night's setlist. Data courtesy of Phish.net / The Mockingbird Foundation.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> The four-night run, and a pool a group can open for those shows (the product name on the form is NYE Run):
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> If a fan page wants a card from us, this frame shows our tour leader (or a link card with no numbers). It does not republish Phish.net stats.
>
> https://www.setlistpickem.com/embed/stats?utm_source=phish-net&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
>
> No payment. If a mention is useful for your readers, the links above are the ones to use. Contact: support@setlistpickem.com.

### Phish.in

**Needs owner approval.** Do not send, post, or submit this message.

Contact is **to verify.** Do not send until a real contact path is confirmed. Do not ask Phish.in to host a setlist archive for us.

> Setlist Pick'Em is a free Phish prediction game: six slots locked before the show, and the slot you called scores more than the same song in the wrong slot. For January 2, 2027 (the 100th show at Madison Square Garden) we have an aggregate Garden page, a page for the four-night run, and a pool friends can open. Data courtesy of Phish.net / The Mockingbird Foundation. No night's setlist.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> A site that wants our standings card (not Phish.net numbers) can use:
>
> https://www.setlistpickem.com/embed/stats?utm_source=phish-in&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
>
> No payment. Contact: support@setlistpickem.com.

### r/phish

**Needs owner approval.** Do not send, post, or submit this message.

Reply only, in a thread that is already about the Garden run or the 100th. Do not start a promo thread. Read the current sub rules the same day. A fetch of the community page on 2026-11-09 showed rules on politics, face-value tickets, not being an asshole, and drug posts, plus a setlist bot and the four MSG dates. Rule numbers in that fetch skipped from 2 to 4, so this is not the full list. Full rules: **to verify** before any reply. Do not paste a setlist. Let the sub's own bot do that.

> If you're looking at the Garden run: this is an aggregate page for Phish at MSG (most-played songs, openers, New Year's Eve counts). No night's setlist. Data courtesy of Phish.net.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> January 2 is the 100th show there. Setlist Pick'Em is a free game: six slots, and the slot you called scores more than the same song in a different slot. The run page and a pool you can open with friends (form name NYE Run):
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th
>
> If you run a fan page, the standings card (our leader, not Phish.net stats) is https://www.setlistpickem.com/embed/stats?utm_source=reddit&utm_medium=social&utm_campaign=seo_geo&utm_content=embed-stats

### Phantasy Tour forums

**Needs owner approval.** Do not send, post, or submit this message.

The homepage is verified. The Phish forum URL is **to verify** (`/phish` returned 404 on 2026-11-09). Find the board the same day, read its rules, and post only where a link is allowed. Do not paste a setlist.

> Aggregate page for Phish at MSG (most-played, openers, New Year's Eve counts). No night's setlist. Data courtesy of Phish.net.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> January 2, 2027 is the 100th Garden show. Setlist Pick'Em: six slots before the show, and the slot you called scores more than the same song in the wrong slot. Run page and a pool (form name NYE Run):
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> Standings card for a fan page (not Phish.net numbers): https://www.setlistpickem.com/embed/stats?utm_source=phantasy-tour&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats

### Helping Friendly Podcast

**Needs owner approval.** Do not send, post, or submit this message.

Contact is **to verify.** The Osiris contact page returned HTTP 500 on 2026-11-09. Do not use Osiris advertising or "Work With Us."

> For show notes, if you mention the Garden run: Setlist Pick'Em is a free prediction game (six slots, and the slot you called scores more than the same song in a different slot). The aggregate MSG page has no night's setlist. Data courtesy of Phish.net / The Mockingbird Foundation. January 2, 2027 is the 100th show at the Garden. There is a page for the four nights and a pool friends can open. No payment.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> Standings card, if a page wants it: https://www.setlistpickem.com/embed/stats?utm_source=helping-friendly&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
>
> Contact: support@setlistpickem.com.

### Undermine

**Needs owner approval.** Do not send, post, or submit this message.

Contact is **to verify.** Do not use the advertising path.

> Same offer as the Helping Friendly note, for Undermine show notes only if a 100th-show mention fits the episode. Six slots. The slot you called scores more than the same song in the wrong slot. No night's setlist. Data courtesy of Phish.net / The Mockingbird Foundation. No payment.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/embed/stats?utm_source=undermine&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
>
> Contact: support@setlistpickem.com.

### After Midnight

**Needs owner approval.** Do not send, post, or submit this message.

Skip this one unless the owner wants it. The show is about Big Cypress, not the 2026-27 Garden run. Contact is **to verify.** Do not use the advertising path.

> Only if a note about later Garden shows belongs on this series: January 2, 2027 is Phish's 100th show at MSG. Aggregate page (no night's setlist), run page, and a pool. Data courtesy of Phish.net. No payment.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> Standings card, if a page wants it: https://www.setlistpickem.com/embed/stats?utm_source=after-midnight&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats

### Relix

**Needs owner approval.** Do not send, post, or submit this message.

Do not write `advertising@relix.com`. The about page's assistance address is `support@relix.com`. A named editorial desk is **to verify** before this goes to a person.

> Setlist Pick'Em is a free Phish prediction game. Players lock six slots before the show. The slot you called scores more than the same song in a different slot.
>
> For the 100th show at Madison Square Garden (January 2, 2027), the public page is aggregates only: songs played most at the Garden, openers, New Year's Eve counts. No night's setlist. Data courtesy of Phish.net / The Mockingbird Foundation.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> The four-night run, and a pool readers can open with friends (form name NYE Run):
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> A standings card for a fan page (our tour leader, not a Phish.net data widget):
>
> https://www.setlistpickem.com/embed/stats?utm_source=relix&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
>
> This is not a paid placement. One-page kit on request. Contact: support@setlistpickem.com.

### JamBase

**Needs owner approval.** Do not send, post, or submit this message.

Use General Inquiries on https://www.jambase.com/contact. Do not use Ad Sales.

> Setlist Pick'Em is a free Phish prediction game: six slots locked before the show, and the slot you called scores more than the same song in the wrong slot.
>
> January 2, 2027 is the 100th Phish show at Madison Square Garden. The public page is aggregates (most-played songs, openers, New Year's Eve counts). No night's setlist. Data courtesy of Phish.net / The Mockingbird Foundation.
>
> https://www.setlistpickem.com/phish-at-msg?utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th
>
> Standings card for a fan page (not Phish.net numbers): https://www.setlistpickem.com/embed/stats?utm_source=jambase&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats
>
> Not a paid placement. Contact: support@setlistpickem.com.

### Phishcord (Discord)

**Needs owner approval.** Do not send, post, or submit this message.

Do not DM anyone. Do not post until a person has read the current channel rules and found a channel that allows a link. The invite page was live on 2026-11-09 (title Phishcord). Invites get revoked. Re-check the invite before joining, and do not join from an agent.

> Garden aggregates, no setlist, data courtesy of Phish.net: https://www.setlistpickem.com/phish-at-msg?utm_source=discord&utm_medium=social&utm_campaign=seo_geo&utm_content=phish-at-msg
>
> January 2, 2027 is the 100th show at MSG. Six slots in Setlist Pick'Em. The slot you called scores more than the same song in a different slot. Run page and a pool (name on the form is NYE Run):
>
> https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=discord&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th
>
> https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=discord&utm_medium=social&utm_campaign=seo_geo&utm_content=predict-100th

## Verification log (2026-11-09)

A URL is in the Verified URL column only when a fetch in this session returned the real page. Direct HTTP 403 or an empty response is not enough on its own. "to verify" means this session did not confirm that path.

| URL | Result |
| --- | --- |
| https://phish.net/ | HTTP 200, title Phish.net |
| https://phish.net/contact | HTTP 200, title Contact Us - Phish.net. Form, no public inbox in the HTML. |
| https://phish.net/venue/157/Madison_Square_Garden.html | HTTP 200, title Madison Square Garden- Phish.net |
| https://mbird.org/ | HTTP 200, title The Mockingbird Foundation |
| https://mbird.org/contact-us/ | HTTP 200, title Contact Us. Redirects from `/contact`. No inbox copied into this tracker. |
| https://phish.in/ | HTTP 200, title Phish.in. No contact link in the HTML shell. |
| https://www.reddit.com/r/phish/ | Readable fetch returned the community (created Aug 12, 2008, four MSG dates, partial rules). Direct HTTP from this environment returned 403. |
| https://www.phantasytour.com/ | Readable fetch returned the title "Jam band concerts, tour dates, setlists, stats, games and discussion - Phantasy Tour". Direct HTTP returned 403. |
| https://www.phantasytour.com/phish | 404. Forum path not confirmed. |
| https://www.osirispod.com/podcasts/helping-friendly-podcast/ | HTTP 200, title Helping Friendly Podcast ON TOUR - Osiris |
| https://www.osirispod.com/podcasts/undermine/ | Readable fetch returned the Undermine show page (hosts listed). Direct HTTP returned an empty 202. |
| https://www.osirispod.com/podcasts/after-midnight-phishs-big-cypress-festival/ | Readable fetch returned the show page (host Jesse Jarnow, Big Cypress). |
| https://www.osirispod.com/contact/ | HTTP 500. Contact not verified. |
| https://relix.com/ | HTTP 200, title Relix |
| https://relix.com/about | HTTP 200. Assistance line `support@relix.com`. Advertising address present and out of scope. Staff directory not copied. |
| https://relix.com/contact | HTTP 404 |
| https://www.jambase.com/ | Readable fetch returned "JamBase - Go See Live Music". Direct HTTP returned 403. |
| https://www.jambase.com/contact | Readable fetch returned Contact JamBase, including General Inquiries and Ad Sales. Use General Inquiries only. |
| https://discord.com/invite/dcA56cA | HTTP 200, title Phishcord, og "Join the Phishcord Discord Server!". Not joined. |
| https://www.setlistpickem.com/phish-at-msg | HTTP 200, homepage shell (canonical `/`). Not the Garden page. |
| https://www.setlistpickem.com/embed/stats | HTTP 200, homepage shell. |
| https://www.setlistpickem.com/tour-stats/2026-2027-nye-run | HTTP 200, homepage shell. |
| https://www.setlistpickem.com/tour-stats/msg | HTTP 200, Garden page. Legacy route. |
| https://phish.com/news/phish-100-at-the-garden | Direct HTTP 403. Announcement URL in the product (`NYE_RUN_PHISH_URL`). Treat as to verify before quoting it in a send. |
| https://forum.phish.net/ | Direct HTTP 403. Not used as a contact. |

Older Discord invite codes found in old posts were not rechecked and are not listed.

## Owner decisions

- Approve, rewrite, or kill each template. Approval is per message, not for the whole file.
- Do not start the December 1 window until production serves `/phish-at-msg`, `/embed/stats`, and `/tour-stats/2026-2027-nye-run`.
- Replace the screenshot placeholders in the media kit.
- Confirm contacts still marked to verify, the Phantasy Tour Phish board, full r/phish rules, and which Phishcord channel allows a link.
- Skip After Midnight unless you want that pitch.
- In January 2027, check GSC Links and fill the Link earned column.
