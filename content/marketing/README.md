# Marketing content drafts

Editable reference copy for public marketing / SEO surfaces (not lifecycle comms).

| Doc | Epic / issues | Status |
|-----|---------------|--------|
| [`voice-guide.md`](./voice-guide.md) | epic #972 | **Active** (2026-09-27) — Do / Do-not prose rules for marketing, editorial, and comms body copy; enforced by `npm run verify:marketing-voice` |
| [`marketing-voice-pass-2026-09.md`](./marketing-voice-pass-2026-09.md) | epic #972 · #973 · #940 · #941 · #937 | **Shipped 1.75.3** (2026-09-28) — site-wide AI-tell removal (em dashes ~50 → 3); titles / meta descriptions deliberately untouched |
| [`keyword-page-comms-review-2026-09.md`](./keyword-page-comms-review-2026-09.md) | #973 · epic #972 | **Shipped 1.75.3** (2026-09-28) — `/phish-setlist-prediction-game` reader-first rewrite; partly superseded by the voice pass |
| [`pickem-search-plan-2026-08.md`](./pickem-search-plan-2026-08.md) | #972 · #970 · #973 · #974 · #975 · #926 · #657 | **EiC-approved** (2026-08-21) — docs-only north star; Next/A execution via sibling issues, not this file |
| [`974-owned-social-cadence-brief.md`](./974-owned-social-cadence-brief.md) | #974 · epic #972 | **EiC-approved** (2026-09-23) — owned IG/X show-week + always-on cadence; UTMs `seo_geo`; first L2 post still open |
| [`974-owned-social-profile-pack.md`](./974-owned-social-profile-pack.md) | #974 · epic #972 | **EiC-approved** (2026-09-08) — paste-ready IG/X/Threads/FB name, handle, bio, category, highlights, UTM links |
| [`974-social-account-autonomy.md`](./974-social-account-autonomy.md) | #974 · epic #972 · #695 | **Draft** (ops) — create vs manage; Phase 0 human bootstrap; bios paste from the profile pack |
| [`974-execution-next-2026-09-11.md`](./974-execution-next-2026-09-11.md) | #974 · epic #972 · #695 | **Draft** (updated 2026-09-23) — IG/Threads/FB live; X deferred; remaining AC is kit, EiC brief, first L2 post |
| [`974-social-creative-path.md`](./974-social-creative-path.md) | #974 · epic #972 · #695 | **Draft** (2026-09-23) — Canva remote MCP + locked templates; Brand Systems owns the frame, Demand Gen still owns copy |
| [`974-social-template-menu.md`](./974-social-template-menu.md) | #974 · epic #972 · #695 | **Draft** (2026-09-23) — Brand Systems menu of five layouts from `docs/design.md`; first build is `slot-card` |
| [`974-social-template-masters-2026-09-24.md`](./974-social-template-masters-2026-09-24.md) | #974 · #1046 · epic #972 | **Draft** (2026-09-24) — Canva masters `score` / `stat` / `line` copied from `slot-card`; PNGs beside this brief. Sibling of PR #1047. Not posted |
| [`974-social-post-loop.md`](./974-social-post-loop.md) | #974 · epic #972 · #695 | **Draft** (2026-09-23) — “run the social loop”: Social → Brand Systems → Demand Gen → EiC. No live post. |
| [`974-social-phase1-calendar.md`](./974-social-phase1-calendar.md) | #974 · epic #972 | **Draft** (2026-09-23) — Phase 1 paste calendar, Sep 25–Oct 14. No autonomy. |
| [`974-pack-fall-tour-opener.md`](./974-pack-fall-tour-opener.md) | #974 | **Ready to paste after save** (2026-09-25) — Fall Tour opener, gradient question, IG + Threads drafts still unapproved |
| [`973-c6-c7-keyword-bridge.md`](./973-c6-c7-keyword-bridge.md) | #973 · epic #972 | EiC-facing — C6/C7 title/H1/FAQ on `/phish-setlist-prediction-game` (v1.62.2) |
| [`933-competitor-title-h1-gap-brief.md`](./933-competitor-title-h1-gap-brief.md) | #933 · epic #926 · refs #973 / #975 | **Draft** (2026-09-03) — allowlisted title/H1 gap vs keyword + tour-stats; no `/phish-picks` |
| [`942-content-ia-drafts.md`](./942-content-ia-drafts.md) | [#942](https://github.com/pat792/set-picks/issues/942) — [#937](https://github.com/pat792/set-picks/issues/937), [#940](https://github.com/pat792/set-picks/issues/940), [#941](https://github.com/pat792/set-picks/issues/941) | EiC-approved L0 draft. **#940/#941** v1.56.0; **#937** v1.56.1 |
| [`944-chrome-rule-review.md`](./944-chrome-rule-review.md) | [#944](https://github.com/pat792/set-picks/issues/944) | **APPROVED** — editorial light / product dark; Scoring `surface="light"`; title tokens in `src/shared/ui/marketingEditorialChrome.js` |
| [`968-editorial-viewport-tokens.md`](./968-editorial-viewport-tokens.md) | #968 | Viewport tokens (`--page-gutter`, `--header-height`, light type roles). Extends #944; do not reopen splash 100svh or dashboard type |
| [`tour-stats-above-fold-copy.md`](./tour-stats-above-fold-copy.md) | Tour Insights above-fold tighten | Shipped **v1.61.2** — short lede + filter up; SEO body stays in prerender |
| [`tour-stats-finished-wrap.md`](./tour-stats-finished-wrap.md) | #1140 · parent #1137 · #974 | **Shipped in code 1.88.0** (2026-10-22) — finished-tour wrap on `/tour-stats/{slug}`; winner line waits on a functions refresh |

## Chrome rule (short)

- **Editorial / SEO prose** → light main (`how-it-works`, keyword, `about`, marketing Scoring).
- **Product / data** → dark (`tour-stats*`). Do not light-theme Tour stats.
- Dark sticky header/footer over light main is intentional (venue frame).
- **Viewport tokens (#968):** use `--page-gutter` / `--header-height` and editorial type roles from `src/shared/ui/marketingEditorialChrome.js`. Do not add a new `px-4 sm:px-6 lg:px-8` on those surfaces.

## Conventions

- **Drafts live here** (or under `crew/output/` for ephemeral pipeline artifacts). Chat-only drafts are not enough.
- Production strings ship in `src/features/landing/ui/*` (+ `seoRoutes.js` / prerender as needed).
- Lifecycle email/push/inbox copy stays under [`content/comms/`](../comms/README.md).
- Leadership Ops: [`docs/LEADERSHIP_CREW.md`](../../docs/LEADERSHIP_CREW.md) — draft artifacts must be written to disk.
