# Decision: layout-owned chrome slot API (#708)

**Status:** Declined (no-go). No prototype code.
**Date:** 2026-11-10
**Epic:** [#704](https://github.com/Road2Media/set-picks/issues/704) Phase 4
**Prerequisites:** [#705](https://github.com/Road2Media/set-picks/issues/705) merged (PR #1260). [#707](https://github.com/Road2Media/set-picks/issues/707) merged to `staging` (PR #1261).

## Decision

Keep the current portal contract. Do not add `useDashboardChrome` or a `<DashboardChrome>` element, and do not migrate the tabs onto one.

#707 already removed the duplication that was drifting: one handler path for scope controls (`DashboardAdaptiveScope`), one Standings mount (`StandingsChrome`), and one padding variable (`--dashboard-mobile-chrome-h`). What is left is placement JSX around shared primitives, plus two bands (Make Picks status, Stats quaternary) that a four-field slot cannot own. No new primary tab is queued. The migration (every player tab, `docs/DASHBOARD_IA.md`, the scroll and padding contract) costs more than the JSX it would delete.

## What a slot API would have to express

The issue named four chrome components. Stats is a fifth surface on the same contract. A hook shaped as `{ title, primaryControl, trailingAction, expandable }` covers the first three columns for Pools and Account and stops there.

| Surface | Primary control | Trailing action | Extra band | Who owns it | Height tier |
|---------|-----------------|-----------------|------------|-------------|-------------|
| Standings | Controlled `StandingsViewToggle` (`tablist`: Show / Tour / Year / Pools) | Scale. Mobile: portal into `#dashboard-mobile-context-trailing-root`. Desktop: title row of `DashboardStickyPageChrome` | None | `StandingsChrome` already picks one widget with `useDashboardDeskMedia` | Standard fixed: `11.75rem` (`7.75rem` on `short`) |
| Pools | `ChromeSegmentedControl` NavLinks (My Pools / Create / Join). The item list is copied in `PoolsClusterLayout` and `PoolsMobileFixedChrome` | BookOpen “How pools work”. Same mobile-trailing / desktop-title split as Scale | None | Cluster layout portals both trees on every viewport | Standard fixed |
| Account | Same NavLink tray (Profile / Messages / Preferences). Item list copied in `ProfileClusterLayout` and `ProfileMobileFixedChrome` | None | None | Cluster layout, both trees | Standard fixed |
| Picks | Cluster tray (Make Picks / Lab / Scorecard, Rewind when flagged). Phish IQ is a child route, not a segment (#1258) | Scale on the **desktop title row for every Picks route**. On mobile, Scale is mounted only by `PicksPage` (`PicksMobileFixedChrome`), so Lab, Scorecard, Rewind, and Phish IQ have no mobile Scale | Mobile-only collapsible “Picks saved” / “Picks locked” pill. The expanded copy stays in the page (`hidden` until expanded, `desk:block`). The pill portals into `#picks-cluster-mobile-tools-root`, a node the cluster chrome renders under the tray | Split: cluster owns the tray and the desktop Scale; the page owns the pill and the mobile Scale | Picks cluster: `15.25rem` (`11.25rem` on `short`) for **every** Picks route, including when the pill is absent |
| Stats | NavLink tray (Personal / Global / Band) plus an optional New badge and click handler on Band | None on the tray | Quaternary filters (`StatsQuaternaryChrome` render prop). Desktop wrapper is `border-t` inside `#dashboard-desktop-quaternary-chrome-root`. Mobile wrapper is `border-b` inside a node the tertiary chrome creates one commit later (`useDashboardMobileQuaternaryChromePortal` uses a `MutationObserver`) | Cluster owns the tray; the stats page owns the filter render | Quaternary routes: `17.75rem` (`13.75rem` on `short`) |

Shared pieces a slot would wrap, and that already exist:

- `DashboardMobileChromeBar` — mobile tools band, sr-only heading, `min-h-[3.5rem]`
- `DashboardStickyPageChrome` — desktop title, trailing, tray
- `ChromeSegmentedControl` / `ChromeIconButton`
- Portal targets in `useDashboardMobileChromePortal.js`
- `resolveDashboardMobileChromeHeight` — the four tiers above, including the 4rem `short` drop when the brand row hides

Title is not a page slot. On mobile the H2 is `dashboardPageMeta.contextTitle` inside `DashboardMobileContextBar`. On desktop the cluster chrome supplies the H2, and the layout H2 stays only for War Room (`ownsDesktopStickyChrome`).

## Scroll-away and `--dashboard-mobile-chrome-h`

The mobile fixed stack is one absolute wrapper under the brand bar (`DashboardLayout`). It contains the context bar (scope slot and trailing slot) and, on routes with fixed chrome, `#dashboard-mobile-fixed-chrome-root`. `scrollDirection === 'down'` applies `-translate-y-full` to that whole wrapper, so a tools band portaled into the root and a trailing icon portaled into the context bar move together. A slot rendered outside that wrapper would desync from the context bar.

The padding variable does not follow that transform or the slot contents. The shell sets `--dashboard-mobile-chrome-h` from the route (`fixedChrome`, `picksCluster`, `statsQuaternary`, `short`). `main` uses `mob:pt-[calc(env(safe-area-inset-top,0px)+var(--dashboard-mobile-chrome-h,9rem))]`. Transform does not change layout size, so the reserve stays put while the stack translates and the scrollport does not jump. A slot API that measured the portal root and wrote the variable would still see the untransformed height. A slot API that unmounted the band on scroll-down would collapse the reserve and jump the page.

`useScrollDirection` listens to `window` `scroll` and reads `window.pageYOffset`. The dashboard shell is `h-[100dvh] overflow-hidden`, and content scrolls in `#dashboard-scrollport` (`ScrollToTop` documents that split). Window offset stays 0 while the player scrolls a tab, so the listener keeps `'up'` and the transform stays `translate-y-0` for in-app scrolling. Scroll-away is inert on the dashboard today. A slot migration must leave that listener alone. Wiring it to the scrollport is a separate behavior change.

The Picks and Stats tiers are route flags, not “whatever bands are mounted.” Make Picks with no saved card still reserves `15.25rem`. A slot that added a band would still need a declared tier in `resolveDashboardMobileChromeHeight`, which is the layout special case the API was meant to remove.

## Full migration cost

Touched if a later change reverses this decision:

| Area | Work |
|------|------|
| Pools, Account | Mechanical. One declaration of the NavLink items, one portal branch on `useDashboardDeskMedia`, delete the duplicated `*MobileFixedChrome` files. |
| Standings | Already one mount. The slot would delete `StandingsMobileFixedChrome` and `StandingsStickyChrome` and keep the toggle plus the Scale button. |
| Picks | The hard case. The API needs a nested tools target, a mobile-only trailing action that must **not** appear on Lab / Scorecard / Rewind / Phish IQ, and a collapsible pill whose body stays in the page. Height stays the picks tier for the whole cluster. |
| Stats | Second slot with two wrappers and the late-mounted mobile root (`MutationObserver`). Band badge stays on the tray items. Height stays the quaternary tier only on Personal / Global filter routes. |
| Layout | `DashboardLayout` keeps owning the translating wrapper and the CSS variable. Portal ids stay. `dashboardPageMeta` routes do not change, so `verify:dashboard-meta` stays as it is. |
| Docs | `docs/DASHBOARD_IA.md` placement table, the landscape paragraph, and checklist step 6 (today: “mobile portal chrome + desktop sticky tray”). |
| Proof | Portrait phone, landscape phone, desktop, for all five primaries, plus Make Picks with and without the status pill, Stats with quaternary trays, and the keyboard overlap in `docs/investigations/mobile-chrome-keyboard-picks-chrome.md`. |

That is about ten chrome modules, `PicksPage`, the height helper, and the IA doc. Pools and Account are small. Picks and Stats are where a generic slot grows escape hatches and becomes a second portal system. No route, callable, or Firestore field moves, so SemVer would have been MINOR only because the issue said so for an implementation; this decline changes no API surface.

## Why the go criteria fail

- **New tabs.** The IA is five primaries. [#300](https://github.com/Road2Media/set-picks/issues/300) does not add a dashboard tab. #1258 took Phish IQ off the Picks tray instead of adding a segment. Nothing queued would be cheaper because a slot API existed.
- **Duplication left by #707.** Scope controls and Standings are one mount. The four cluster layouts still portal a mobile bar and a desktop sticky block on every viewport, and CSS hides one tree (`hidden desk:block` on the sticky stack, `desk:hidden` on the mobile header). That is real, and it is shallow: the same `ChromeSegmentedControl` items, the same bar primitives. Screen readers can meet the hidden tree. Closing that is an `isDesk` gate like `StandingsChrome`, not a new layout API.
- **Churn.** Five tabs, the IA doc, and the padding tiers, for a maintenance win the shared primitives already provide. The checklist in `docs/DASHBOARD_IA.md` is the recipe for the next cluster.

## What stays

- Pages and cluster layouts portal into the layout roots.
- `StandingsChrome` remains the pattern for “one mount, viewport picks the widget.”
- `--dashboard-mobile-chrome-h` stays a route-keyed constant, including the `short` drop.
- Scroll-away stays the transform on the existing absolute stack.
