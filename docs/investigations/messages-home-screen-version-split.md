# Messages looks old on one home-screen app and new on the other

**Status:** investigated 2026-10-13. Not a per-account renderer.  
**Accounts checked against:** `pat@road2media` (Chrome add to home screen) vs `pahea79@gmail` (Safari add to home screen).

## What is true

The Messages screen does not branch on admin, email, or uid. Both accounts mount the same `CommsInboxSection` and the same template registry. Inbox docs only supply `templateId` plus `payload`. The sentences, eyebrows, and date format are painted by the JavaScript that the home-screen icon loaded.

Those two icons are not required to load the same JavaScript.

## The two builds

| | Production | Staging (not promoted) |
|---|---|---|
| Git | `main` `9290314` | `staging` `77c1909` |
| App version | **1.81.2** (promoted 2026-10-09) | **1.81.7** (2026-10-10) |
| Live host | `https://www.setlistpickem.com` | the staging-branch Vercel preview (no custom domain) |
| Message chrome | Eyebrow is the bare label (`Show recap`, `Picks locked`, `Tour standings`). Place lines still glue on the stored date (`2026-10-11 — Venue, City`). | Eyebrow is `10/11/26 · Show recap`. Dates in sentences are `10/11/26`. The morning rankings note leads with “here's how last night at {venue} went.” |

Confirmed on the production notifications chunk ` /assets/notifications-xQ1g2Q1s.js `: the show-recap eyebrow string is the literal `` `Show recap` ``. The staging-only helpers (`eyebrowWithDate`, `formatFanShowDate`, the “last night at” lead) are in `src/features/notifications/ui/commsTemplates/commsTemplateRegistry.jsx` on `staging` and are absent from `main`.

There is no staging custom domain. `www.setlistpickem.com`, the apex, and the project's `vercel.app` alias all serve production.

## Why a home-screen icon can stay on one of those builds

`public/favicon/site.webmanifest` sets `display: standalone` and does not set `start_url`, `scope`, or `id`. Add to Home Screen then saves the URL of the tab that was open.

- A Chrome icon added from `www.setlistpickem.com` keeps opening production 1.81.2. That is the old message rendering.
- A Safari icon added from a staging or pull-request preview keeps opening that preview. That is the new message rendering, including for a different Firebase user.

Quitting and reopening does not retarget the icon. The saved URL stays until the icon is deleted and added again from the host you want.

The signed-in account is not the switch. Signing the admin into the Safari icon would still paint the new templates, and signing the other account into the Chrome icon would still paint the old ones.

## How to confirm on each icon

Open Messages from the icon and check the host, not the account.

- Safari: hold the icon, look at the page URL (or the tab Safari opens if it is not standalone). A `vercel.app` host means the new templates.
- Chrome: site information on the installed window. `www.setlistpickem.com` means production.

Visual check, same inbox payload:

- Old (production): eyebrow `Show recap`, body contains a `2026-…` date.
- New (staging): eyebrow `MM/DD/YY · Show recap`, no storage date in the sentence, morning note names the venue in the first line.

If both icons are `www.setlistpickem.com` and Chrome is still older than that, Chrome is restoring a document from before the 2026-10-09 promote. Force-quit the installed app and open it again. The service worker does not precache the app shell, so a real navigation revalidates `dashboard/index.html` (`Cache-Control: public, max-age=0, must-revalidate`) and loads the current hashed chunks.

## Separate cache note

Production currently returns `Cache-Control: public, max-age=14400, must-revalidate` for `/firebase-messaging-sw.js`. `vercel.json` asks for `max-age=0`. The worker has no fetch handler, so this does not serve an old Messages bundle. It can delay a service-worker script update by up to four hours. HTML for `/dashboard` is still `max-age=0, must-revalidate`.

## What closes the gap

Promote `staging` (1.81.7) to `main`. Until that lands, `www.setlistpickem.com` will keep the old message rendering. To make the Safari icon match production before that, delete it and add it again from `https://www.setlistpickem.com`.
