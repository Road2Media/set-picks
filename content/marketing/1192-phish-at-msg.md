# Phish at MSG: own route and fan copy (#1192)

**Status:** EiC-approved (2026-11-07)
**Issue:** [#1192](https://github.com/Road2Media/set-picks/issues/1192)
**Roles:** CTO, software architect, comms drafter, editor in chief, product design lead

## Route

**Canonical:** `/phish-at-msg`
**Legacy:** `/tour-stats/msg` and `/tour-stats/msg/` permanently redirect (`vercel.json` `permanent: true`, HTTP 308). Vite has no `vercel.json`, so the SPA uses `<Navigate replace>`.

### Why this path

Phish at MSG is 96 Garden shows added together. It is not a tour slug, and it should not live under `/tour-stats`, where `:tourSlug` and the archive line treat a path as a tour.

`/phish-at-msg` sits with the other public pages (`/how-it-works`, `/about`, `/phish-setlist-prediction-game`). The words are the ones fans use, and they match the nav label. A `/venues/msg` namespace would invent a venue model this issue does not have. `/msg` is short and easy to confuse with a future New Year's Run URL.

The `msg` slug stays reserved so tour auto-expand cannot publish `/tour-stats/msg` as a tour page on top of the redirect.

### Navigation

Header and footer primary nav, after Tour stats: **Phish at MSG**. The hamburger uses the same list. Below the xl breakpoint the desktop links sit slightly left of center, with a tighter gap, so the extra item does not cover Sign In at 1024px. At xl the nav is centered again. The tour stats archive line no longer links here. The Garden page links to Tour stats as a different page, not as its parent. JSON-LD breadcrumb is Home → Phish at MSG.

### Version

**1.98.0 (minor).** A new public route is a minor bump. `/tour-stats/msg` is not removed: it still resolves, as a permanent redirect. That is the same pattern as the summer slug in 1.59.0. Copy alone would be a patch. Not `skip-version-bump`. Not 2.0.0, because the old URL still lands on the page. Say so before merge if this should be a major.

## Copy (before → after)

EiC pass against `content/marketing/voice-guide.md`. No em dashes. No “unlock”. No explanation of how the totals are built.

### Tour stats hub

| Surface | Before | After |
| --- | --- | --- |
| Title | Phish Tour Statistics & Insights \| Setlist Pick'Em | Phish Tour Stats \| Setlist Pick'Em |
| H1 | Phish tour setlist statistics | What Phish is playing this tour |
| Meta | Tour Insights: the latest Phish tour setlist statistics—most-played songs, bustouts by tour, and gap highlights. Updated every night the band plays live. Play Setlist Pick'Em to unlock personal stats. | See the songs Phish is playing most this tour, the bustouts, and the long gaps. Updated after every show. |
| Live lede | Phish tour setlist statistics: most-played songs, song frequency, bustouts by tour, and gap highlights that keep you sharp between shows. Updated every night the band plays. | The songs Phish keeps playing, the bustouts, and the long gaps. Updated after every show. |
| Finished lede | Phish tour setlist statistics for a finished run: most-played songs, song frequency, bustouts by tour, and gap highlights. | This run is done. The songs Phish played most, the bustouts, and the long gaps. |
| Footnote | Tour-wide trends only, not a night-by-night archive. Play and your personal stats start counting. | The songs that shaped the tour. Lock a card for the next show. |
| Archive | 2026 Sphere · 2026 tours · Phish at MSG | 2026 Sphere · 2026 tours |

The live and finished ledes are the shared panel, so a tour page shows the new sentence too. Sphere, Summer, and `/tour-stats/2026` keep their own headings and prerender paragraphs. The 2026 page still says how its totals add up. That sentence was left alone.

### Phish at MSG

Opening paragraphs under the heading (2026-11-07). The same three paragraphs are in the prerender facts, the page JSON-LD, and `llms.txt`.

Phish has played Madison Square Garden 96 times over an incredible 32 years, from December 30, 1994 through July 29, 2026.

July 29, 2026 was the band’s 96th performance at MSG, capping a 5-show run that transported us back to the 90’s, complete with cut-off tees and vacuum antics.

This New Year’s run, Phish returns to the Garden for 4 nights, ending with their 100th performance at the venue on January 2, 2027.

| Surface | Before | After |
| --- | --- | --- |
| Title | Phish at MSG: 96 Shows by the Numbers \| Setlist Pick'Em | Phish at MSG \| Setlist Pick'Em |
| Eyebrow | Tour Insights | The Garden |
| H1 | Phish at MSG, by the numbers | Phish at MSG |
| Meta | Phish at Madison Square Garden by the numbers: 96 shows through July 29, 2026, most-played songs, debuts, gaps, and New Year's Eve facts. January 2, 2027 is the 100th show. | Phish at the Garden: the songs they play most, what opens the night, debuts, long gaps, and New Year's Eve. |
| Under the H1 | Tour Insights · {n} different songs in {n} shows. Aggregates only, not a night-by-night archive. | {n} different songs across {n} shows at the Garden. One tour at a time. |
| Openers | These are how often each song has opened a Phish show at MSG… Frequencies, not a pick tip. | Songs that have opened a show at the Garden, and how many times, across {n} shows. |
| New Year's Eve | New Year's Eve shows in this count: {n}. Most frequent NYE openers: … | Phish has played New Year's Eve at the Garden {n} times. Those nights opened most often with … |
| Provenance line | Setlist pages checked {date}. | Removed. The opening sentence already names the last show. Phish.net credit stays. |

## Mobile scroll

Checked 2026-11-07.

Production `https://www.setlistpickem.com/tour-stats` (iPhone Safari user agent) is our marketing document only: one module script, the 3px boot progress bar, no Vercel toolbar script. The `overflow: hidden` in that HTML is the progress bar, not the page.

The staging alias `https://set-picks-git-staging-pat-4867s-projects.vercel.app/tour-stats` returns 302 to Vercel SSO before any app HTML. Logged-in preview sessions get the Vercel Toolbar from the platform. That toolbar is not in this repo and does not load on `www.setlistpickem.com`.

The marketing header is `sticky` with `backdrop-blur` in both environments. Nothing in this app locks body scroll, calls `preventDefault` on touchmove, or sets scroll-snap on these pages. No staging-only script in our code.

**Finding:** the sticky feel Patrick hit on staging is the preview chrome (SSO plus the Vercel Toolbar), not a scroll lock in our CSS. Production serves the same page without that chrome. No CSS change in this PR. A blur removal on the shared header would restyle every marketing page without a reproduced bug.

## Viewport

iPhone and Android screenshots are on the pull request. Checks: no horizontal overflow, the page scrolls, the new nav item is present, MSG is absent from the tour archive line.
