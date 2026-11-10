# Release train - Sprint 9

**Goal:** Ship Sprint 9 as many small PRs into `staging`, then one `staging` -> `main` promote after the train is green.

**Theme:** Stats and personalization: picks heatmap, richer profile averages, public/private tour stats explorer, profile avatars/badges, setlist nerd signals, and comms optimization follow-through.

**Baseline:** `main` and `staging` are aligned at **1.23.0** on 2026-07-16. The train starts from `v1.23.0`; hold all Sprint 9 PRs in `staging` until promote freeze.

**Pattern:** Continuous merges to `staging`, no direct feature PRs to `main`, no `staging` -> `main` promote PR until the train acceptance checklist passes.

---

## In train vs out of train

### IN - ship in this train

| Issue | Type | Notes |
|-------|------|-------|
| [#566](https://github.com/pat792/set-picks/issues/566) | Docs / product spec | Milestone badge engagement matrix, required before badge implementation |
| [#584](https://github.com/pat792/set-picks/issues/584) | Fix | Dedupe venue/location in `tour_rankings_daily` copy |
| [#587](https://github.com/pat792/set-picks/issues/587) Phase A | UI fix | Bustout badge on Standings setlist rows without new schema |
| [#553](https://github.com/pat792/set-picks/issues/553) | Feature / design spike | Personalized picks heatmap; watch Firestore read cost |
| [#554](https://github.com/pat792/set-picks/issues/554) | Feature / spec + UI | Profile averages and song vintage source decision |
| [#567](https://github.com/pat792/set-picks/issues/567) | Feature | Selectable avatar set on Profile and public profile |
| [#568](https://github.com/pat792/set-picks/issues/568) | Feature | Milestone badge awards and custom badge icons; depends on #566 |
| [#555](https://github.com/pat792/set-picks/issues/555) | Feature | Public/private tour stats explorer; likely MINOR if new routes or aggregate docs ship |
| [#587](https://github.com/pat792/set-picks/issues/587) Phase B | Feature / schema | Frozen per-song gap/last-played data; MINOR with `docs/API.md` + schema docs |
| [#573](https://github.com/pat792/set-picks/issues/573) Phase 0/1 | Comms ops | Optimize playbook + first on-demand pack; draft-only, PM-gated ship |

### STRETCH - land on `staging` if capacity; do not block promote

| Issue | Notes |
|-------|-------|
| Follow-up children from #573 | Accepted Optimize recommendations may become new child issues or planned comms rows |
| Backfill tooling for #587 Phase B | Optional if forward-only gap snapshots are enough for promote |

### OUT - explicit defer

| Issue | Why |
|-------|-----|
| [#565](https://github.com/pat792/set-picks/issues/565) | Epic remains open until all avatar + badge phases ship; close only if #566/#567/#568 meet epic AC |
| [#510](https://github.com/pat792/set-picks/issues/510), [#512](https://github.com/pat792/set-picks/issues/512), [#513](https://github.com/pat792/set-picks/issues/513) | Deferred to Sprint 10. #573 Phase 0/1 shipped enough comms autonomy groundwork for this release; #512 needs reliable open/click signal clarity before non-opener automation; #510/#513 are independent feature surfaces and should not hold the stats/personalization promote. |
| #573 L2+ follow-up children | Deferred to Sprint 10 comms planning after PM review of the first `optimize_for=picks_lock` pack. |
| [#300](https://github.com/pat792/set-picks/issues/300), [#301](https://github.com/pat792/set-picks/issues/301), [#605](https://github.com/pat792/set-picks/issues/605) | Sprint 10 multi-band train |
| Ads backlog (#419-#422) | Not part of stats/personalization train unless a sponsor-slot follow-up is explicitly pulled in |

---

## Merge order (waves)

Merge each wave to **`staging` only**. Keep PRs small enough to review independently.

```text
Wave 0  Train manifest
        * This manifest
        * Confirm staging/main fast-forward baseline at v1.23.0

Wave 1  Low-risk docs + copy fixes
        * #566 milestone badge matrix
        * #584 tour_rankings_daily venue/location dedupe
        * #587 Phase A bustout badge only, no schema

Wave 2  Profile stats foundation
        * #553 heatmap design spike + first personal stats surface
        * #554 profile averages + song vintage source decision

Wave 3  Profile identity layer
        * #567 avatar picker
        * #568 badge awards/icons after #566 rules are locked

Wave 4  Stats explorer + setlist schema
        * #555 public/private stats explorer
        * #587 Phase B frozen gap / last-played snapshot fields

Wave 5  Comms Optimize and account inbox
        * #573 Phase 0/1 playbook + first on-demand pack
        * #510 tour_recap trigger (waived to Sprint 10)
        * #512 non-opener follow-up / open-tracking path (waived to Sprint 10)
        * #513 Account Preferences hub + Messages inbox-only (waived to Sprint 10)

Wave 6  Promote freeze
        * Staging soak + QA checklist
        * One staging -> main PR
        * Release gate on staging tip
        * Release tag after promote when user requests (`release:publish`)
```

**Hotfix rule:** If production needs a fix mid-train, branch from `main`, ship the hotfix, then fast-forward or merge `main` back into `staging` before continuing train PRs.

---

## Versioning for the train

1. Each feature PR follows the repo SemVer rules and may bump `package.json` + `CHANGELOG.md` on `staging`.
2. Docs-only train planning changes do **not** require a version bump.
3. New public routes, Firestore fields, callable surfaces, or env vars require `docs/API.md` updates in the same PR.
4. Expected train promote bump is **MINOR** because #555 and #587 Phase B shipped new dashboard/schema surface. #510/#512/#513 are deferred and do not affect the Sprint 9 promote version.
5. On promote day, write one production changelog entry that summarizes the full train.
6. After `staging` -> `main` promote, agents MAY publish the release tag when the user explicitly requests it (`npm run release:publish -- --confirm` on `main`).

---

## Gates and risk notes

| Area | Gate |
|------|------|
| Dashboard routes/meta | If #555 or #513 adds dashboard routes, update dashboard meta/nav active-state logic, extend `scripts/verify-dashboard-meta.mjs`, and run `npm run verify:dashboard-meta` |
| Firestore reads | #553/#554/#555 must document read-cost budget and prefer rollups/pre-aggregates over unbounded history scans |
| Firestore schema | #587 Phase B must update `docs/OFFICIAL_SETLISTS_SCHEMA.md` and `docs/API.md` |
| Comms delivery | #573/#510/#512 remain PM-gated for merge/deploy; no ad-hoc production sends |
| Dependabot | Existing Dependabot PRs to `staging` are maintenance train cars; merge only when green and do not version-bump those branches |

Incomplete features must land dark, behind absent UX, flags, or forward-only fields rather than blocking staging.

---

## Promote-day checklist

- [ ] All **IN** issues merged to `staging` or explicitly waived here
- [ ] Open Dependabot PRs either merged green or deferred without blocking the train
- [ ] `npm run lint` green on staging tip
- [ ] `npm test` green on staging tip
- [ ] `npm run verify:dashboard-meta` green if route/meta changed
- [ ] `npm run verify:dashboard-ui` green if dashboard UI changed
- [ ] Functions tests green if Functions/comms delivery code changed
- [ ] Firestore rules tests green if rules changed
- [ ] Manual QA checklist captured for profile stats, setlist gap/bustout, stats explorer, and comms preview/canary paths
- [ ] One `staging` -> `main` promote PR opened and merged
- [x] Release tag published after promote (`v1.30.0`) when user requested
- [x] Sprint 9 epics/issues closed or updated with residual follow-ups

---

## PR hygiene

- Branch: `feat/<issue#>-<kebab-slug>` for issue work; docs/train branches may use `feat/sprint9-release-train`.
- Base: **`staging`**.
- PR bodies include `Closes #<issue>` for issue PRs, plus `## Summary` and `## Test plan`.
- Do not open promote PRs until Wave 6.
- Agents may comment/review when asked, but may not approve, request changes, merge, or force-push without explicit user command. Tagging/`release:publish` requires an explicit user promote/tag/release request after `main` is updated.

---

## Work log

| Date | Wave | PR / action | Notes |
|------|------|-------------|-------|
| 2026-07-16 | Baseline | Fast-forward `staging` to `main` | `main` and `staging` aligned at `v1.23.0` |
| 2026-07-16 | 0 | Manifest authored | Train defined; first PR targets `staging` |
| 2026-07-16 | 0–1 | PRs #613–#616 merged | Manifest, #566 matrix, #584 place dedupe (1.23.1), #587 Phase A bustout badge (1.24.0); staging tip **1.24.0** |
| 2026-07-16 | 2 | #617–#620 merged | Foundation + avg points (1.24.1) + debut/vintage helpers (1.25.0) + avg correct rollup / self top-picks / alignment fix (1.26.0); staging tip **1.26.0**; careerCorrectSlots backfilled |
| 2026-07-16 | 3 | #621 merged | Curated avatar picker + public mark (**1.27.0**) |
| 2026-07-16 | 3 | #622 merged | Milestone badges v1 + standings pins / unset-avatar chip (**1.28.1**) |
| 2026-07-16 | 4 | #587 Phase B in flight (#623) | Frozen per-song `official_setlists.songGaps` + Standings gap grid → **1.29.0**. #555 next: dashboard-first, on-demand tour-setlist aggregation |
| 2026-07-17 | 3–4 | #622 + #623 merged | Badges/avatars (**1.28.1**) + setlist gaps (**1.29.0**); staging tip **1.29.0** |
| 2026-07-17 | 4 | #555 in flight | Dashboard Tour stats explorer → **1.30.0** |
| 2026-07-17 | 4 | #625 merged | Tour stats explorer + Stats tab (**1.30.0**); staging tip **1.30.0**. Wave 4 complete. Follow-up scrub: #626. |
| 2026-07-17 | 5 | #573 Phase 0 merged (#628) | Optimize autonomy L0 playbook + skills; Phase 1 (on-demand pack) next |
| 2026-07-17 | 5 | #573 L1 pack posted | First on-demand Optimize pack (`optimize_for=picks_lock`) on epic; #584 closed (shipped #615) |
| 2026-07-17 | 6 | Promote freeze started | Waived #510/#512/#513 and #573 L2+ to Sprint 10; Sprint 9 release promotes shipped stats/personalization + #573 Phase 0/1 as **1.30.0**. |
| 2026-07-17 | 6 | #632 merged + prod READY | `staging` → `main` promote; Vercel production READY. Release tag `v1.30.0` published on request. |
